-- ============================================================================
-- KanakkuFlow ERP — Phase 9: Reports, Hardening & Production Indexes
-- Migration: 20261125000001_phase9_reports_hardening.sql
-- ============================================================================

-- 1. PERFORMANCE & REPORTING COMPOSITE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_so_company_date_status 
    ON public.sales_orders (company_id, order_date DESC, status);

CREATE INDEX IF NOT EXISTS idx_inv_company_date_status 
    ON public.sales_invoices (company_id, invoice_date DESC, status);

CREATE INDEX IF NOT EXISTS idx_pay_company_date_status 
    ON public.customer_payments (company_id, payment_date DESC, status);

CREATE INDEX IF NOT EXISTS idx_sm_company_date_type 
    ON public.stock_movements (company_id, created_at DESC, movement_type);

CREATE INDEX IF NOT EXISTS idx_po_company_date_status 
    ON public.production_orders (company_id, planned_start_date DESC, status);

CREATE INDEX IF NOT EXISTS idx_batches_company_expiry 
    ON public.inventory_batches (company_id, expiry_date ASC, batch_status);

CREATE INDEX IF NOT EXISTS idx_crl_company_trans_date 
    ON public.customer_receivables_ledger (company_id, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_sol_company_order 
    ON public.sales_order_lines (company_id, sales_order_id);

CREATE INDEX IF NOT EXISTS idx_sil_company_invoice 
    ON public.sales_invoice_lines (company_id, sales_invoice_id);

CREATE INDEX IF NOT EXISTS idx_sr_company_batch_status 
    ON public.stock_reservations (company_id, batch_id, status);

CREATE INDEX IF NOT EXISTS idx_sm_company_batch 
    ON public.stock_movements (company_id, batch_id);

CREATE INDEX IF NOT EXISTS idx_po_company_order_date 
    ON public.purchase_orders (company_id, order_date DESC, status);

CREATE INDEX IF NOT EXISTS idx_grn_company_date 
    ON public.goods_receipt_notes (company_id, grn_date DESC, status);

CREATE INDEX IF NOT EXISTS idx_cust_company_status 
    ON public.customers (company_id, status);

CREATE INDEX IF NOT EXISTS idx_items_company_active 
    ON public.items (company_id, is_active);

CREATE INDEX IF NOT EXISTS idx_audit_logs_company_created 
    ON public.audit_logs (company_id, created_at DESC);

-- 2. MANAGEMENT DASHBOARD ANALYTICS RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_management_dashboard_metrics(
    p_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
    p_end_date DATE DEFAULT CURRENT_DATE,
    p_branch_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_cid UUID;
    v_role user_role;
    v_sales_today BIGINT := 0;
    v_sales_month BIGINT := 0;
    v_sales_total BIGINT := 0;
    v_outstanding_total BIGINT := 0;
    v_payments_received BIGINT := 0;
    v_purchases_total BIGINT := 0;
    v_stock_valuation BIGINT := 0;
    v_low_stock_count INT := 0;
    v_expiring_batches_count INT := 0;
    v_pending_orders_count INT := 0;
    v_active_production_runs INT := 0;
    v_completed_production_runs INT := 0;
    v_recent_orders JSONB;
    v_top_products JSONB;
BEGIN
    v_cid := public.current_company_id();
    IF v_cid IS NULL THEN
        RAISE EXCEPTION 'Unauthorized session.';
    END IF;

    v_role := public.current_user_role();
    IF p_branch_id IS NOT NULL AND NOT public.has_branch_access(p_branch_id) THEN
        RAISE EXCEPTION 'Access Denied: You do not have access to branch %.', p_branch_id;
    END IF;

    -- 1. Sales Metrics (Excludes CANCELLED orders)
    SELECT 
        COALESCE(SUM(CASE WHEN order_date = CURRENT_DATE THEN total_amount_paisa ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN DATE_TRUNC('month', order_date) = DATE_TRUNC('month', CURRENT_DATE) THEN total_amount_paisa ELSE 0 END), 0),
        COALESCE(SUM(total_amount_paisa), 0)
    INTO v_sales_today, v_sales_month, v_sales_total
    FROM public.sales_orders
    WHERE company_id = v_cid
      AND status NOT IN ('CANCELLED', 'REJECTED')
      AND (p_branch_id IS NULL OR branch_id = p_branch_id)
      AND (order_date BETWEEN p_start_date AND p_end_date);

    -- 2. Pending Sales Orders (APPROVED, ALLOCATED, READY_FOR_DISPATCH)
    SELECT COUNT(*) INTO v_pending_orders_count
    FROM public.sales_orders
    WHERE company_id = v_cid
      AND status IN ('SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'ALLOCATED', 'READY_FOR_DISPATCH')
      AND (p_branch_id IS NULL OR branch_id = p_branch_id);

    -- 3. Customer Outstanding & Collections (From Authoritative Receivables Ledger & Payments)
    SELECT 
        COALESCE(SUM(debit_paisa) - SUM(credit_paisa), 0)
    INTO v_outstanding_total
    FROM public.customer_receivables_ledger
    WHERE company_id = v_cid
      AND (p_branch_id IS NULL OR branch_id = p_branch_id);

    SELECT 
        COALESCE(SUM(amount_paisa), 0)
    INTO v_payments_received
    FROM public.customer_payments
    WHERE company_id = v_cid
      AND (payment_date BETWEEN p_start_date AND p_end_date)
      AND (p_branch_id IS NULL OR branch_id = p_branch_id);

    -- 4. Purchases Total (Approved/Received POs)
    SELECT 
        COALESCE(SUM(total_paisa), 0)
    INTO v_purchases_total
    FROM public.purchase_orders
    WHERE company_id = v_cid
      AND status NOT IN ('CANCELLED', 'REJECTED')
      AND (order_date BETWEEN p_start_date AND p_end_date)
      AND (p_branch_id IS NULL OR branch_id = p_branch_id);

    -- 5. Inventory Valuation & Batch Alerts
    SELECT 
        COALESCE(SUM(current_qty * unit_cost_paisa), 0)
    INTO v_stock_valuation
    FROM public.inventory_batches
    WHERE company_id = v_cid
      AND batch_status = 'ACTIVE'
      AND current_qty > 0
      AND (p_branch_id IS NULL OR branch_id = p_branch_id);

    -- Expiring batches within 30 days
    SELECT COUNT(*) INTO v_expiring_batches_count
    FROM public.inventory_batches
    WHERE company_id = v_cid
      AND batch_status = 'ACTIVE'
      AND current_qty > 0
      AND expiry_date IS NOT NULL
      AND expiry_date <= (CURRENT_DATE + INTERVAL '30 days')
      AND (p_branch_id IS NULL OR branch_id = p_branch_id);

    -- Low stock items (Items where total on-hand < reorder_level)
    SELECT COUNT(*) INTO v_low_stock_count
    FROM (
        SELECT i.id
        FROM public.items i
        LEFT JOIN public.inventory_batches b 
            ON b.item_id = i.id 
            AND b.company_id = i.company_id 
            AND b.batch_status = 'ACTIVE'
            AND (p_branch_id IS NULL OR b.branch_id = p_branch_id)
        WHERE i.company_id = v_cid
          AND i.is_active = TRUE
          AND i.reorder_level IS NOT NULL
        GROUP BY i.id, i.reorder_level
        HAVING COALESCE(SUM(b.current_qty), 0) <= i.reorder_level
    ) low_items;

    -- 6. Production Order Summary
    SELECT 
        COALESCE(SUM(CASE WHEN status IN ('SUBMITTED', 'APPROVED', 'MATERIAL_RESERVED', 'IN_PROGRESS') THEN 1 ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END), 0)
    INTO v_active_production_runs, v_completed_production_runs
    FROM public.production_orders
    WHERE company_id = v_cid
      AND (planned_start_date BETWEEN p_start_date AND p_end_date)
      AND (p_branch_id IS NULL OR branch_id = p_branch_id);

    -- 7. Recent Sales Orders (Latest 5)
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', so.id,
                'order_number', so.order_number,
                'customer_name', COALESCE(c.shop_name, c.owner_name),
                'order_date', so.order_date,
                'total_amount_paisa', so.total_amount_paisa,
                'status', so.status
            ) ORDER BY so.created_at DESC
        ),
        '[]'::jsonb
    ) INTO v_recent_orders
    FROM (
        SELECT * FROM public.sales_orders
        WHERE company_id = v_cid
          AND (p_branch_id IS NULL OR branch_id = p_branch_id)
        ORDER BY created_at DESC
        LIMIT 5
    ) so
    LEFT JOIN public.customers c ON c.id = so.customer_id;

    -- 8. Top Selling Products (Top 5 by quantity)
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'item_id', tp.item_id,
                'item_name', tp.name,
                'sku', tp.sku,
                'total_qty', tp.total_qty,
                'total_revenue_paisa', tp.total_rev
            )
        ),
        '[]'::jsonb
    ) INTO v_top_products
    FROM (
        SELECT 
            sol.item_id,
            i.name,
            sol.sku,
            SUM(sol.ordered_qty) AS total_qty,
            SUM(sol.line_total_paisa) AS total_rev
        FROM public.sales_order_lines sol
        JOIN public.sales_orders so ON so.id = sol.sales_order_id
        JOIN public.items i ON i.id = sol.item_id
        WHERE so.company_id = v_cid
          AND so.status NOT IN ('CANCELLED', 'REJECTED')
          AND (p_branch_id IS NULL OR so.branch_id = p_branch_id)
          AND (so.order_date BETWEEN p_start_date AND p_end_date)
        GROUP BY sol.item_id, i.name, sol.sku
        ORDER BY total_qty DESC
        LIMIT 5
    ) tp;

    RETURN jsonb_build_object(
        'success', TRUE,
        'period', jsonb_build_object('start_date', p_start_date, 'end_date', p_end_date),
        'sales', jsonb_build_object(
            'sales_today_paisa', v_sales_today,
            'sales_month_paisa', v_sales_month,
            'sales_total_paisa', v_sales_total,
            'pending_orders_count', v_pending_orders_count
        ),
        'finance', jsonb_build_object(
            'outstanding_receivables_paisa', v_outstanding_total,
            'payments_received_paisa', v_payments_received
        ),
        'procurement', jsonb_build_object(
            'purchases_total_paisa', v_purchases_total
        ),
        'inventory', jsonb_build_object(
            'stock_valuation_paisa', v_stock_valuation,
            'expiring_batches_count', v_expiring_batches_count,
            'low_stock_items_count', v_low_stock_count
        ),
        'production', jsonb_build_object(
            'active_runs_count', v_active_production_runs,
            'completed_runs_count', v_completed_production_runs
        ),
        'recent_orders', v_recent_orders,
        'top_products', v_top_products
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_management_dashboard_metrics(DATE, DATE, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_management_dashboard_metrics(DATE, DATE, UUID) TO authenticated;

-- 3. SALES ANALYTICS & BREAKDOWN RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_sales_analytics(
    p_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
    p_end_date DATE DEFAULT CURRENT_DATE,
    p_branch_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_cid UUID;
    v_by_customer JSONB;
    v_by_product JSONB;
    v_by_salesman JSONB;
    v_by_status JSONB;
    v_by_branch JSONB;
    v_daily_trend JSONB;
BEGIN
    v_cid := public.current_company_id();
    IF v_cid IS NULL THEN
        RAISE EXCEPTION 'Unauthorized session.';
    END IF;

    IF p_branch_id IS NOT NULL AND NOT public.has_branch_access(p_branch_id) THEN
        RAISE EXCEPTION 'Access Denied: Branch access violation.';
    END IF;

    -- 1. Sales by Customer (Top 10)
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'customer_id', agg.customer_id,
                'customer_name', COALESCE(c.shop_name, c.owner_name),
                'order_count', agg.orders_count,
                'total_revenue_paisa', agg.total_revenue
            )
        ), '[]'::jsonb
    ) INTO v_by_customer
    FROM (
        SELECT customer_id, COUNT(*) AS orders_count, SUM(total_amount_paisa) AS total_revenue
        FROM public.sales_orders
        WHERE company_id = v_cid
          AND status NOT IN ('CANCELLED', 'REJECTED')
          AND (p_branch_id IS NULL OR branch_id = p_branch_id)
          AND (order_date BETWEEN p_start_date AND p_end_date)
        GROUP BY customer_id
        ORDER BY total_revenue DESC
        LIMIT 10
    ) agg
    LEFT JOIN public.customers c ON c.id = agg.customer_id;

    -- 2. Sales by Product (Top 10)
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'item_id', agg.item_id,
                'item_name', i.name,
                'sku', agg.sku,
                'total_qty', agg.total_qty,
                'total_revenue_paisa', agg.total_revenue
            )
        ), '[]'::jsonb
    ) INTO v_by_product
    FROM (
        SELECT sol.item_id, sol.sku, SUM(sol.ordered_qty) AS total_qty, SUM(sol.line_total_paisa) AS total_revenue
        FROM public.sales_order_lines sol
        JOIN public.sales_orders so ON so.id = sol.sales_order_id
        WHERE so.company_id = v_cid
          AND so.status NOT IN ('CANCELLED', 'REJECTED')
          AND (p_branch_id IS NULL OR so.branch_id = p_branch_id)
          AND (so.order_date BETWEEN p_start_date AND p_end_date)
        GROUP BY sol.item_id, sol.sku
        ORDER BY total_revenue DESC
        LIMIT 10
    ) agg
    JOIN public.items i ON i.id = agg.item_id;

    -- 3. Sales by Salesman
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'salesman_id', agg.assigned_salesman_id,
                'salesman_name', COALESCE(up.full_name, 'Unassigned'),
                'order_count', agg.orders_count,
                'total_revenue_paisa', agg.total_revenue
            )
        ), '[]'::jsonb
    ) INTO v_by_salesman
    FROM (
        SELECT assigned_salesman_id, COUNT(*) AS orders_count, SUM(total_amount_paisa) AS total_revenue
        FROM public.sales_orders
        WHERE company_id = v_cid
          AND status NOT IN ('CANCELLED', 'REJECTED')
          AND (p_branch_id IS NULL OR branch_id = p_branch_id)
          AND (order_date BETWEEN p_start_date AND p_end_date)
        GROUP BY assigned_salesman_id
        ORDER BY total_revenue DESC
    ) agg
    LEFT JOIN public.user_profiles up ON up.id = agg.assigned_salesman_id;

    -- 4. Sales by Order Status
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'status', status,
                'order_count', COUNT(*),
                'total_amount_paisa', SUM(total_amount_paisa)
            )
        ), '[]'::jsonb
    ) INTO v_by_status
    FROM public.sales_orders
    WHERE company_id = v_cid
      AND (p_branch_id IS NULL OR branch_id = p_branch_id)
      AND (order_date BETWEEN p_start_date AND p_end_date)
    GROUP BY status;

    -- 5. Sales by Branch
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'branch_id', agg.branch_id,
                'branch_name', b.name,
                'order_count', agg.orders_count,
                'total_revenue_paisa', agg.total_revenue
            )
        ), '[]'::jsonb
    ) INTO v_by_branch
    FROM (
        SELECT branch_id, COUNT(*) AS orders_count, SUM(total_amount_paisa) AS total_revenue
        FROM public.sales_orders
        WHERE company_id = v_cid
          AND status NOT IN ('CANCELLED', 'REJECTED')
          AND (p_branch_id IS NULL OR branch_id = p_branch_id)
          AND (order_date BETWEEN p_start_date AND p_end_date)
        GROUP BY branch_id
        ORDER BY total_revenue DESC
    ) agg
    JOIN public.branches b ON b.id = agg.branch_id;

    -- 6. Daily Sales Trend
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'date', order_date,
                'order_count', COUNT(*),
                'total_revenue_paisa', SUM(total_amount_paisa)
            ) ORDER BY order_date ASC
        ), '[]'::jsonb
    ) INTO v_daily_trend
    FROM public.sales_orders
    WHERE company_id = v_cid
      AND status NOT IN ('CANCELLED', 'REJECTED')
      AND (p_branch_id IS NULL OR branch_id = p_branch_id)
      AND (order_date BETWEEN p_start_date AND p_end_date)
    GROUP BY order_date;

    RETURN jsonb_build_object(
        'success', TRUE,
        'by_customer', v_by_customer,
        'by_product', v_by_product,
        'by_salesman', v_by_salesman,
        'by_status', v_by_status,
        'by_branch', v_by_branch,
        'daily_trend', v_daily_trend
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_sales_analytics(DATE, DATE, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_sales_analytics(DATE, DATE, UUID) TO authenticated;

-- 4. INVENTORY ANALYTICS & STOCK BREAKDOWN RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_inventory_analytics(
    p_branch_id UUID DEFAULT NULL,
    p_warehouse_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_cid UUID;
    v_by_warehouse JSONB;
    v_by_category JSONB;
    v_expiring_schedule JSONB;
    v_stock_summary JSONB;
BEGIN
    v_cid := public.current_company_id();
    IF v_cid IS NULL THEN
        RAISE EXCEPTION 'Unauthorized session.';
    END IF;

    IF p_branch_id IS NOT NULL AND NOT public.has_branch_access(p_branch_id) THEN
        RAISE EXCEPTION 'Access Denied: Branch access violation.';
    END IF;

    -- 1. Stock Valuation & Aggregate Breakdown
    SELECT jsonb_build_object(
        'total_batches', COUNT(*),
        'total_physical_qty', COALESCE(SUM(current_qty), 0),
        'total_reserved_qty', COALESCE(SUM(reserved_qty), 0),
        'total_available_qty', COALESCE(SUM(current_qty - reserved_qty), 0),
        'total_valuation_paisa', COALESCE(SUM(current_qty * unit_cost_paisa), 0)
    ) INTO v_stock_summary
    FROM public.inventory_batches
    WHERE company_id = v_cid
      AND batch_status = 'ACTIVE'
      AND (p_branch_id IS NULL OR branch_id = p_branch_id)
      AND (p_warehouse_id IS NULL OR warehouse_id = p_warehouse_id);

    -- 2. Stock by Warehouse
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'warehouse_id', agg.warehouse_id,
                'warehouse_name', w.name,
                'batches_count', agg.batches_count,
                'total_qty', agg.total_qty,
                'total_valuation_paisa', agg.total_valuation
            )
        ), '[]'::jsonb
    ) INTO v_by_warehouse
    FROM (
        SELECT warehouse_id, COUNT(*) AS batches_count, SUM(current_qty) AS total_qty, SUM(current_qty * unit_cost_paisa) AS total_valuation
        FROM public.inventory_batches
        WHERE company_id = v_cid
          AND batch_status = 'ACTIVE'
          AND (p_branch_id IS NULL OR branch_id = p_branch_id)
          AND (p_warehouse_id IS NULL OR warehouse_id = p_warehouse_id)
        GROUP BY warehouse_id
    ) agg
    JOIN public.warehouses w ON w.id = agg.warehouse_id;

    -- 3. Stock by Item Category
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'category_name', COALESCE(ic.name, 'Uncategorized'),
                'batches_count', COUNT(b.id),
                'total_qty', SUM(b.current_qty),
                'total_valuation_paisa', SUM(b.current_qty * b.unit_cost_paisa)
            )
        ), '[]'::jsonb
    ) INTO v_by_category
    FROM public.inventory_batches b
    JOIN public.items i ON i.id = b.item_id
    LEFT JOIN public.item_categories ic ON ic.id = i.category_id
    WHERE b.company_id = v_cid
      AND b.batch_status = 'ACTIVE'
      AND (p_branch_id IS NULL OR b.branch_id = p_branch_id)
      AND (p_warehouse_id IS NULL OR b.warehouse_id = p_warehouse_id)
    GROUP BY ic.name;

    -- 4. Expiry Breakdown Schedule (Expired, 0-30 days, 31-60 days, 61-90 days, >90 days)
    SELECT jsonb_build_object(
        'expired_qty', COALESCE(SUM(CASE WHEN expiry_date <= CURRENT_DATE THEN current_qty ELSE 0 END), 0),
        'expiring_30_days_qty', COALESCE(SUM(CASE WHEN expiry_date > CURRENT_DATE AND expiry_date <= (CURRENT_DATE + INTERVAL '30 days') THEN current_qty ELSE 0 END), 0),
        'expiring_60_days_qty', COALESCE(SUM(CASE WHEN expiry_date > (CURRENT_DATE + INTERVAL '30 days') AND expiry_date <= (CURRENT_DATE + INTERVAL '60 days') THEN current_qty ELSE 0 END), 0),
        'expiring_90_days_qty', COALESCE(SUM(CASE WHEN expiry_date > (CURRENT_DATE + INTERVAL '60 days') AND expiry_date <= (CURRENT_DATE + INTERVAL '90 days') THEN current_qty ELSE 0 END), 0),
        'good_condition_qty', COALESCE(SUM(CASE WHEN expiry_date > (CURRENT_DATE + INTERVAL '90 days') OR expiry_date IS NULL THEN current_qty ELSE 0 END), 0)
    ) INTO v_expiring_schedule
    FROM public.inventory_batches
    WHERE company_id = v_cid
      AND batch_status = 'ACTIVE'
      AND current_qty > 0
      AND (p_branch_id IS NULL OR branch_id = p_branch_id)
      AND (p_warehouse_id IS NULL OR warehouse_id = p_warehouse_id);

    RETURN jsonb_build_object(
        'success', TRUE,
        'summary', v_stock_summary,
        'by_warehouse', v_by_warehouse,
        'by_category', v_by_category,
        'expiry_schedule', v_expiring_schedule
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_inventory_analytics(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_inventory_analytics(UUID, UUID) TO authenticated;

-- 5. PRODUCTION ANALYTICS & COSTING RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_production_analytics(
    p_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
    p_end_date DATE DEFAULT CURRENT_DATE,
    p_branch_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_cid UUID;
    v_summary JSONB;
    v_by_product JSONB;
    v_material_consumption JSONB;
BEGIN
    v_cid := public.current_company_id();
    IF v_cid IS NULL THEN
        RAISE EXCEPTION 'Unauthorized session.';
    END IF;

    IF p_branch_id IS NOT NULL AND NOT public.has_branch_access(p_branch_id) THEN
        RAISE EXCEPTION 'Access Denied: Branch access violation.';
    END IF;

    -- 1. Production Runs Summary
    SELECT jsonb_build_object(
        'total_orders', COUNT(*),
        'completed_orders', COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END), 0),
        'in_progress_orders', COALESCE(SUM(CASE WHEN status IN ('IN_PROGRESS', 'MATERIAL_RESERVED') THEN 1 ELSE 0 END), 0),
        'planned_qty_total', COALESCE(SUM(planned_output_qty), 0),
        'actual_qty_total', COALESCE(SUM(actual_output_qty), 0)
    ) INTO v_summary
    FROM public.production_orders
    WHERE company_id = v_cid
      AND (planned_start_date BETWEEN p_start_date AND p_end_date)
      AND (p_branch_id IS NULL OR branch_id = p_branch_id);

    -- 2. Output by Product (Finished Goods vs Bulk WIP)
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'product_id', po.product_id,
                'product_name', i.name,
                'sku', i.sku,
                'runs_count', COUNT(po.id),
                'planned_qty', SUM(po.planned_output_qty),
                'actual_qty', SUM(po.actual_output_qty),
                'yield_pct', CASE WHEN SUM(po.planned_output_qty) > 0 
                             THEN ROUND((SUM(po.actual_output_qty) / SUM(po.planned_output_qty)) * 100, 2)
                             ELSE 100 END
            )
        ), '[]'::jsonb
    ) INTO v_by_product
    FROM public.production_orders po
    JOIN public.items i ON i.id = po.product_id
    WHERE po.company_id = v_cid
      AND po.status = 'COMPLETED'
      AND (po.planned_start_date BETWEEN p_start_date AND p_end_date)
      AND (p_branch_id IS NULL OR po.branch_id = p_branch_id)
    GROUP BY po.product_id, i.name, i.sku;

    -- 3. Top Consumed Raw & Packaging Materials
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'item_id', pol.component_item_id,
                'item_name', i.name,
                'component_type', pol.component_type,
                'required_qty', SUM(pol.required_qty),
                'consumed_qty', SUM(pol.consumed_qty),
                'wastage_qty', SUM(pol.wastage_qty)
            )
        ), '[]'::jsonb
    ) INTO v_material_consumption
    FROM public.production_order_lines pol
    JOIN public.production_orders po ON po.id = pol.production_order_id
    JOIN public.items i ON i.id = pol.component_item_id
    WHERE po.company_id = v_cid
      AND po.status = 'COMPLETED'
      AND (po.planned_start_date BETWEEN p_start_date AND p_end_date)
      AND (p_branch_id IS NULL OR po.branch_id = p_branch_id)
    GROUP BY pol.component_item_id, i.name, pol.component_type
    ORDER BY SUM(pol.consumed_qty) DESC
    LIMIT 10;

    RETURN jsonb_build_object(
        'success', TRUE,
        'summary', v_summary,
        'by_product', v_by_product,
        'material_consumption', v_material_consumption
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_production_analytics(DATE, DATE, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_production_analytics(DATE, DATE, UUID) TO authenticated;
