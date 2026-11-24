-- ============================================================================
-- KanakkuFlow ERP - Migration 20261124000004_phase6_sales_order_management.sql
-- Phase 6: Sales & Order Management
-- ============================================================================

-- 1. ENUMS & EXTENSIONS
-- ============================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sales_order_status') THEN
        CREATE TYPE public.sales_order_status AS ENUM (
            'DRAFT',
            'SUBMITTED',
            'PENDING_APPROVAL',
            'APPROVED',
            'PARTIALLY_ALLOCATED',
            'ALLOCATED',
            'READY_FOR_DISPATCH',
            'PARTIALLY_DISPATCHED',
            'DISPATCHED',
            'REJECTED',
            'CANCELLED'
        );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sales_order_approval_status') THEN
        CREATE TYPE public.sales_order_approval_status AS ENUM (
            'NOT_REQUIRED',
            'PENDING',
            'APPROVED',
            'REJECTED'
        );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'price_list_type') THEN
        CREATE TYPE public.price_list_type AS ENUM (
            'STANDARD',
            'CUSTOMER_SPECIAL',
            'DISTRIBUTOR',
            'SEASONAL'
        );
    END IF;
END $$;

-- 2. PRICE LISTS & CUSTOMER PRICING
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.price_lists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    list_type public.price_list_type NOT NULL DEFAULT 'STANDARD',
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to DATE NULL,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_price_lists_company_code UNIQUE (company_id, code),
    CONSTRAINT uq_price_lists_company_id UNIQUE (company_id, id),
    CONSTRAINT chk_price_lists_valid_dates CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE TABLE IF NOT EXISTS public.price_list_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    price_list_id UUID NOT NULL,
    item_id UUID NOT NULL,
    unit_id UUID NOT NULL,
    price_paisa BIGINT NOT NULL CHECK (price_paisa >= 0),
    min_selling_price_paisa BIGINT NOT NULL DEFAULT 0 CHECK (min_selling_price_paisa >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_price_list_items_unique UNIQUE (company_id, price_list_id, item_id, unit_id),
    CONSTRAINT uq_price_list_items_id UNIQUE (company_id, id),
    CONSTRAINT fk_price_list_items_list FOREIGN KEY (company_id, price_list_id) REFERENCES public.price_lists(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_price_list_items_item FOREIGN KEY (company_id, item_id) REFERENCES public.items(company_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_price_list_items_unit FOREIGN KEY (company_id, unit_id) REFERENCES public.units(company_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.customer_pricing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    item_id UUID NOT NULL,
    unit_id UUID NOT NULL,
    special_price_paisa BIGINT NOT NULL CHECK (special_price_paisa >= 0),
    min_selling_price_paisa BIGINT NOT NULL DEFAULT 0 CHECK (min_selling_price_paisa >= 0),
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to DATE NULL,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_customer_pricing_unique UNIQUE (company_id, customer_id, item_id, unit_id),
    CONSTRAINT uq_customer_pricing_id UNIQUE (company_id, id),
    CONSTRAINT fk_customer_pricing_customer FOREIGN KEY (company_id, customer_id) REFERENCES public.customers(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_customer_pricing_item FOREIGN KEY (company_id, item_id) REFERENCES public.items(company_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_customer_pricing_unit FOREIGN KEY (company_id, unit_id) REFERENCES public.units(company_id, id) ON DELETE RESTRICT,
    CONSTRAINT chk_customer_pricing_dates CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

-- 3. SALES ORDERS & SALES ORDER LINES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sales_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL,
    order_number VARCHAR(50) NOT NULL,
    customer_id UUID NOT NULL,
    delivery_address_id UUID NOT NULL,
    assigned_salesman_id UUID NULL REFERENCES auth.users(id),
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    requested_delivery_date DATE NOT NULL,
    payment_terms_days INT NOT NULL DEFAULT 7 CHECK (payment_terms_days >= 0),
    price_list_id UUID NULL,
    status public.sales_order_status NOT NULL DEFAULT 'DRAFT',
    approval_status public.sales_order_approval_status NOT NULL DEFAULT 'NOT_REQUIRED',
    approval_required_reason TEXT NULL,
    approved_by UUID NULL REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ NULL,
    approval_notes TEXT NULL,
    subtotal_paisa BIGINT NOT NULL DEFAULT 0 CHECK (subtotal_paisa >= 0),
    discount_paisa BIGINT NOT NULL DEFAULT 0 CHECK (discount_paisa >= 0),
    tax_paisa BIGINT NOT NULL DEFAULT 0 CHECK (tax_paisa >= 0),
    total_amount_paisa BIGINT NOT NULL DEFAULT 0 CHECK (total_amount_paisa >= 0),
    notes TEXT NULL,
    cancellation_reason TEXT NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_sales_orders_company_number UNIQUE (company_id, order_number),
    CONSTRAINT uq_sales_orders_company_id UNIQUE (company_id, id),
    CONSTRAINT fk_sales_orders_branch FOREIGN KEY (company_id, branch_id) REFERENCES public.branches(company_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_sales_orders_customer FOREIGN KEY (company_id, customer_id) REFERENCES public.customers(company_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_sales_orders_address FOREIGN KEY (company_id, delivery_address_id) REFERENCES public.customer_addresses(company_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_sales_orders_price_list FOREIGN KEY (company_id, price_list_id) REFERENCES public.price_lists(company_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.sales_order_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    sales_order_id UUID NOT NULL,
    item_id UUID NOT NULL,
    sku VARCHAR(50) NOT NULL,
    ordered_qty NUMERIC(14, 4) NOT NULL CHECK (ordered_qty > 0),
    allocated_qty NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (allocated_qty >= 0),
    dispatched_qty NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (dispatched_qty >= 0),
    unit_id UUID NOT NULL,
    conversion_rate NUMERIC(12, 6) NOT NULL DEFAULT 1.0 CHECK (conversion_rate > 0),
    base_ordered_qty NUMERIC(14, 4) NOT NULL CHECK (base_ordered_qty > 0),
    base_allocated_qty NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (base_allocated_qty >= 0),
    unit_price_paisa BIGINT NOT NULL CHECK (unit_price_paisa >= 0),
    discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
    discount_amount_paisa BIGINT NOT NULL DEFAULT 0 CHECK (discount_amount_paisa >= 0),
    tax_rate_id UUID NULL,
    tax_rate_percent NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (tax_rate_percent >= 0),
    taxable_amount_paisa BIGINT NOT NULL DEFAULT 0 CHECK (taxable_amount_paisa >= 0),
    cgst_paisa BIGINT NOT NULL DEFAULT 0 CHECK (cgst_paisa >= 0),
    sgst_paisa BIGINT NOT NULL DEFAULT 0 CHECK (sgst_paisa >= 0),
    igst_paisa BIGINT NOT NULL DEFAULT 0 CHECK (igst_paisa >= 0),
    line_total_paisa BIGINT NOT NULL DEFAULT 0 CHECK (line_total_paisa >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_sales_order_lines_id UNIQUE (company_id, id),
    CONSTRAINT fk_sol_order FOREIGN KEY (company_id, sales_order_id) REFERENCES public.sales_orders(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_sol_item FOREIGN KEY (company_id, item_id) REFERENCES public.items(company_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_sol_unit FOREIGN KEY (company_id, unit_id) REFERENCES public.units(company_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_sol_tax_rate FOREIGN KEY (company_id, tax_rate_id) REFERENCES public.tax_rates(company_id, id) ON DELETE SET NULL
);

-- 4. SALES ORDER ALLOCATIONS (TRACEABILITY TO BATCHES & RESERVATIONS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sales_order_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    sales_order_id UUID NOT NULL,
    sales_order_line_id UUID NOT NULL,
    reservation_id UUID NOT NULL REFERENCES public.stock_reservations(id) ON DELETE CASCADE,
    batch_id UUID NOT NULL,
    warehouse_id UUID NOT NULL,
    allocated_qty NUMERIC(14, 4) NOT NULL CHECK (allocated_qty > 0),
    status VARCHAR(50) NOT NULL DEFAULT 'RESERVED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_sales_order_allocations_id UNIQUE (company_id, id),
    CONSTRAINT fk_soa_order FOREIGN KEY (company_id, sales_order_id) REFERENCES public.sales_orders(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_soa_line FOREIGN KEY (company_id, sales_order_line_id) REFERENCES public.sales_order_lines(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_soa_batch FOREIGN KEY (company_id, batch_id) REFERENCES public.inventory_batches(company_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_soa_warehouse FOREIGN KEY (company_id, warehouse_id) REFERENCES public.warehouses(company_id, id) ON DELETE RESTRICT
);

-- 5. PERFORMANCE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_so_company_status ON public.sales_orders(company_id, status);
CREATE INDEX IF NOT EXISTS idx_so_company_customer ON public.sales_orders(company_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_so_company_branch ON public.sales_orders(company_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_so_salesman ON public.sales_orders(company_id, assigned_salesman_id);
CREATE INDEX IF NOT EXISTS idx_so_order_date ON public.sales_orders(company_id, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_sol_order ON public.sales_order_lines(company_id, sales_order_id);
CREATE INDEX IF NOT EXISTS idx_sol_item ON public.sales_order_lines(company_id, item_id);
CREATE INDEX IF NOT EXISTS idx_soa_order ON public.sales_order_allocations(company_id, sales_order_id);
CREATE INDEX IF NOT EXISTS idx_soa_line ON public.sales_order_allocations(company_id, sales_order_line_id);
CREATE INDEX IF NOT EXISTS idx_soa_batch ON public.sales_order_allocations(company_id, batch_id);
CREATE INDEX IF NOT EXISTS idx_pli_list_item ON public.price_list_items(company_id, price_list_id, item_id);
CREATE INDEX IF NOT EXISTS idx_cust_price ON public.customer_pricing(company_id, customer_id, item_id);

-- 6. RPC: DETERMINE SELLING PRICE ACCORDING TO PRIORITY
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_item_selling_price(
    p_company_id UUID,
    p_customer_id UUID,
    p_item_id UUID,
    p_unit_id UUID,
    p_price_list_id UUID DEFAULT NULL
)
RETURNS TABLE (
    price_paisa BIGINT,
    min_selling_price_paisa BIGINT,
    price_source VARCHAR(50)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_price BIGINT;
    v_min_price BIGINT;
    v_source VARCHAR(50);
BEGIN
    -- 1. Check Customer-specific contract price
    SELECT cp.special_price_paisa, cp.min_selling_price_paisa, 'CUSTOMER_SPECIFIC'
    INTO v_price, v_min_price, v_source
    FROM public.customer_pricing cp
    WHERE cp.company_id = p_company_id
      AND cp.customer_id = p_customer_id
      AND cp.item_id = p_item_id
      AND cp.unit_id = p_unit_id
      AND CURRENT_DATE >= cp.valid_from
      AND (cp.valid_to IS NULL OR CURRENT_DATE <= cp.valid_to)
    LIMIT 1;

    IF v_price IS NOT NULL THEN
        RETURN QUERY SELECT v_price, v_min_price, v_source;
        RETURN;
    END IF;

    -- 2. Check Order's specific Price List
    IF p_price_list_id IS NOT NULL THEN
        SELECT pli.price_paisa, pli.min_selling_price_paisa, 'PRICE_LIST'
        INTO v_price, v_min_price, v_source
        FROM public.price_list_items pli
        JOIN public.price_lists pl ON pl.id = pli.price_list_id
        WHERE pli.company_id = p_company_id
          AND pli.price_list_id = p_price_list_id
          AND pli.item_id = p_item_id
          AND pli.unit_id = p_unit_id
          AND pl.is_active = TRUE
          AND CURRENT_DATE >= pl.valid_from
          AND (pl.valid_to IS NULL OR CURRENT_DATE <= pl.valid_to)
        LIMIT 1;

        IF v_price IS NOT NULL THEN
            RETURN QUERY SELECT v_price, v_min_price, v_source;
            RETURN;
        END IF;
    END IF;

    -- 3. Check Company Default Price List
    SELECT pli.price_paisa, pli.min_selling_price_paisa, 'DEFAULT_PRICE_LIST'
    INTO v_price, v_min_price, v_source
    FROM public.price_list_items pli
    JOIN public.price_lists pl ON pl.id = pli.price_list_id
    WHERE pli.company_id = p_company_id
      AND pl.is_default = TRUE
      AND pl.is_active = TRUE
      AND pli.item_id = p_item_id
      AND pli.unit_id = p_unit_id
      AND CURRENT_DATE >= pl.valid_from
      AND (pl.valid_to IS NULL OR CURRENT_DATE <= pl.valid_to)
    LIMIT 1;

    IF v_price IS NOT NULL THEN
        RETURN QUERY SELECT v_price, v_min_price, v_source;
        RETURN;
    END IF;

    -- 4. Fallback to Item Master Base Price
    SELECT ROUND(i.base_price * 100)::BIGINT, ROUND(i.base_price * 100)::BIGINT, 'ITEM_BASE_PRICE'
    INTO v_price, v_min_price, v_source
    FROM public.items i
    WHERE i.company_id = p_company_id
      AND i.id = p_item_id;

    RETURN QUERY SELECT COALESCE(v_price, 0::BIGINT), COALESCE(v_min_price, 0::BIGINT), COALESCE(v_source, 'NONE'::VARCHAR(50));
END;
$$;

-- 7. RPC: CALCULATE CUSTOMER CREDIT EXPOSURE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calculate_customer_available_credit(
    p_company_id UUID,
    p_customer_id UUID
)
RETURNS TABLE (
    credit_limit_paisa BIGINT,
    pending_orders_exposure_paisa BIGINT,
    available_credit_paisa BIGINT,
    is_credit_exceeded BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_credit_limit NUMERIC(12, 2);
    v_credit_limit_paisa BIGINT;
    v_pending_exposure BIGINT;
    v_available BIGINT;
BEGIN
    SELECT c.credit_limit
    INTO v_credit_limit
    FROM public.customers c
    WHERE c.company_id = p_company_id
      AND c.id = p_customer_id;

    IF v_credit_limit IS NULL THEN
        RAISE EXCEPTION 'Customer not found.';
    END IF;

    v_credit_limit_paisa := ROUND(v_credit_limit * 100)::BIGINT;

    -- Calculate total of approved or allocated orders pending dispatch/invoicing
    SELECT COALESCE(SUM(so.total_amount_paisa), 0)::BIGINT
    INTO v_pending_exposure
    FROM public.sales_orders so
    WHERE so.company_id = p_company_id
      AND so.customer_id = p_customer_id
      AND so.status IN ('APPROVED', 'PARTIALLY_ALLOCATED', 'ALLOCATED', 'READY_FOR_DISPATCH');

    v_available := v_credit_limit_paisa - v_pending_exposure;

    RETURN QUERY SELECT
        v_credit_limit_paisa,
        v_pending_exposure,
        v_available,
        (v_available < 0);
END;
$$;

-- 8. RPC: APPROVE SALES ORDER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.approve_sales_order(
    p_order_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_uid UUID := auth.uid();
    v_order RECORD;
    v_role VARCHAR(50);
BEGIN
    IF v_caller_uid IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User not authenticated.';
    END IF;

    -- Lock Order for update
    SELECT * INTO v_order
    FROM public.sales_orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sales order % not found.', p_order_id;
    END IF;

    -- Verify Caller Role & Branch Access
    SELECT role INTO v_role
    FROM public.company_memberships
    WHERE company_id = v_order.company_id
      AND user_id = v_caller_uid
      AND is_active = TRUE;

    IF v_role IS NULL OR v_role NOT IN ('OWNER', 'ADMIN', 'SUPERVISOR') THEN
        RAISE EXCEPTION 'Access Denied: Only Owner, Admin, or Supervisor can approve sales orders.';
    END IF;

    -- Self-Approval Guard
    IF v_order.created_by = v_caller_uid AND v_role != 'OWNER' THEN
        RAISE EXCEPTION 'Self-Approval Violation: An order cannot be approved by its creator.';
    END IF;

    IF v_order.status NOT IN ('SUBMITTED', 'PENDING_APPROVAL') THEN
        RAISE EXCEPTION 'Invalid State: Order % is not awaiting approval (Current: %).', v_order.order_number, v_order.status;
    END IF;

    -- Update Order Status
    UPDATE public.sales_orders
    SET status = 'APPROVED',
        approval_status = 'APPROVED',
        approved_by = v_caller_uid,
        approved_at = NOW(),
        approval_notes = p_notes,
        updated_at = NOW()
    WHERE id = p_order_id;

    -- Audit Log
    INSERT INTO public.audit_logs (
        company_id,
        user_id,
        action,
        entity_name,
        entity_id,
        new_values
    ) VALUES (
        v_order.company_id,
        v_caller_uid,
        'APPROVE_SALES_ORDER',
        'sales_orders',
        p_order_id,
        jsonb_build_object(
            'order_number', v_order.order_number,
            'approval_notes', p_notes,
            'total_amount_paisa', v_order.total_amount_paisa
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'status', 'APPROVED'
    );
END;
$$;

-- 9. RPC: ALLOCATE SALES ORDER STOCK (FEFO RESERVATION)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.allocate_sales_order_stock(
    p_order_id UUID,
    p_warehouse_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_uid UUID := auth.uid();
    v_order RECORD;
    v_line RECORD;
    v_wh_id UUID;
    v_alloc RECORD;
    v_needed NUMERIC(14, 4);
    v_res_id UUID;
    v_total_lines INT := 0;
    v_fully_allocated_lines INT := 0;
    v_any_allocated BOOLEAN := FALSE;
    v_new_status public.sales_order_status;
BEGIN
    SELECT * INTO v_order
    FROM public.sales_orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sales order % not found.', p_order_id;
    END IF;

    IF v_order.status NOT IN ('APPROVED', 'PARTIALLY_ALLOCATED') THEN
        RAISE EXCEPTION 'Order % cannot be allocated in current status (%). Must be APPROVED or PARTIALLY_ALLOCATED.', v_order.order_number, v_order.status;
    END IF;

    -- Resolve dispatch warehouse (either provided or default finished goods warehouse for branch)
    IF p_warehouse_id IS NOT NULL THEN
        v_wh_id := p_warehouse_id;
    ELSE
        SELECT w.id INTO v_wh_id
        FROM public.warehouses w
        WHERE w.company_id = v_order.company_id
          AND w.branch_id = v_order.branch_id
          AND w.is_active = TRUE
        ORDER BY (w.warehouse_type = 'FINISHED_GOODS') DESC
        LIMIT 1;
    END IF;

    IF v_wh_id IS NULL THEN
        RAISE EXCEPTION 'No active finished goods warehouse found for branch % to allocate stock.', v_order.branch_id;
    END IF;

    -- Iterate through each order line
    FOR v_line IN
        SELECT sol.*, i.is_fefo_tracked, i.name AS item_name
        FROM public.sales_order_lines sol
        JOIN public.items i ON i.id = sol.item_id
        WHERE sol.sales_order_id = p_order_id
        ORDER BY sol.created_at ASC
        FOR UPDATE
    LOOP
        v_total_lines := v_total_lines + 1;
        v_needed := v_line.base_ordered_qty - v_line.base_allocated_qty;

        IF v_needed <= 0 THEN
            v_fully_allocated_lines := v_fully_allocated_lines + 1;
            CONTINUE;
        END IF;

        -- Allocate available stock using FEFO
        FOR v_alloc IN
            SELECT * FROM public.allocate_fefo_stock(
                v_order.company_id,
                v_wh_id,
                v_line.item_id,
                v_needed
            )
        LOOP
            v_any_allocated := TRUE;

            -- 1. Create Stock Reservation
            INSERT INTO public.stock_reservations (
                company_id,
                branch_id,
                warehouse_id,
                item_id,
                batch_id,
                reserved_qty,
                base_unit_id,
                source_document_type,
                source_document_id,
                status,
                notes,
                created_by
            ) VALUES (
                v_order.company_id,
                v_order.branch_id,
                v_wh_id,
                v_line.item_id,
                v_alloc.batch_id,
                v_alloc.allocated_qty,
                v_line.unit_id,
                'SALES_ORDER',
                v_order.id,
                'ACTIVE',
                'FEFO allocation for Sales Order ' || v_order.order_number,
                COALESCE(v_caller_uid, v_order.created_by)
            ) RETURNING id INTO v_res_id;

            -- 2. Update Batch Reserved Qty
            UPDATE public.inventory_batches
            SET reserved_qty = reserved_qty + v_alloc.allocated_qty,
                updated_at = NOW()
            WHERE id = v_alloc.batch_id;

            -- 3. Record Allocation Line
            INSERT INTO public.sales_order_allocations (
                company_id,
                sales_order_id,
                sales_order_line_id,
                reservation_id,
                batch_id,
                warehouse_id,
                allocated_qty,
                status
            ) VALUES (
                v_order.company_id,
                v_order.id,
                v_line.id,
                v_res_id,
                v_alloc.batch_id,
                v_wh_id,
                v_alloc.allocated_qty,
                'RESERVED'
            );

            -- 4. Update Line Allocated Qty
            v_line.base_allocated_qty := v_line.base_allocated_qty + v_alloc.allocated_qty;
            v_needed := v_needed - v_alloc.allocated_qty;
        END LOOP;

        UPDATE public.sales_order_lines
        SET base_allocated_qty = v_line.base_allocated_qty,
            allocated_qty = ROUND(v_line.base_allocated_qty / v_line.conversion_rate, 4),
            updated_at = NOW()
        WHERE id = v_line.id;

        IF v_line.base_allocated_qty >= v_line.base_ordered_qty THEN
            v_fully_allocated_lines := v_fully_allocated_lines + 1;
        END IF;
    END LOOP;

    -- Determine new order status
    IF v_fully_allocated_lines = v_total_lines AND v_total_lines > 0 THEN
        v_new_status := 'READY_FOR_DISPATCH';
    ELSIF v_any_allocated THEN
        v_new_status := 'PARTIALLY_ALLOCATED';
    ELSE
        v_new_status := 'APPROVED';
    END IF;

    UPDATE public.sales_orders
    SET status = v_new_status,
        updated_at = NOW()
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'status', v_new_status,
        'total_lines', v_total_lines,
        'fully_allocated_lines', v_fully_allocated_lines
    );
END;
$$;

-- 10. RPC: CANCEL SALES ORDER & RELEASE RESERVATIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cancel_sales_order(
    p_order_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_uid UUID := auth.uid();
    v_order RECORD;
    v_res RECORD;
BEGIN
    SELECT * INTO v_order
    FROM public.sales_orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sales order % not found.', p_order_id;
    END IF;

    IF v_order.status IN ('DISPATCHED', 'PARTIALLY_DISPATCHED', 'CANCELLED') THEN
        RAISE EXCEPTION 'Order % cannot be cancelled in status %.', v_order.order_number, v_order.status;
    END IF;

    -- Release all active stock reservations for this order
    FOR v_res IN
        SELECT r.id, r.batch_id, r.reserved_qty
        FROM public.stock_reservations r
        WHERE r.company_id = v_order.company_id
          AND r.source_document_type = 'SALES_ORDER'
          AND r.source_document_id = p_order_id
          AND r.status = 'ACTIVE'
        FOR UPDATE
    LOOP
        UPDATE public.inventory_batches
        SET reserved_qty = GREATEST(0, reserved_qty - v_res.reserved_qty),
            updated_at = NOW()
        WHERE id = v_res.batch_id;

        UPDATE public.stock_reservations
        SET status = 'CANCELLED',
            updated_at = NOW()
        WHERE id = v_res.id;
    END LOOP;

    -- Update Order Allocation Status
    UPDATE public.sales_order_allocations
    SET status = 'CANCELLED'
    WHERE company_id = v_order.company_id
      AND sales_order_id = p_order_id;

    -- Reset Line allocated quantities
    UPDATE public.sales_order_lines
    SET allocated_qty = 0,
        base_allocated_qty = 0,
        updated_at = NOW()
    WHERE sales_order_id = p_order_id;

    -- Update Order Status
    UPDATE public.sales_orders
    SET status = 'CANCELLED',
        cancellation_reason = p_reason,
        updated_at = NOW()
    WHERE id = p_order_id;

    -- Audit Log
    INSERT INTO public.audit_logs (
        company_id,
        user_id,
        action,
        entity_name,
        entity_id,
        new_values
    ) VALUES (
        v_order.company_id,
        v_caller_uid,
        'CANCEL_SALES_ORDER',
        'sales_orders',
        p_order_id,
        jsonb_build_object(
            'order_number', v_order.order_number,
            'cancellation_reason', p_reason
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'status', 'CANCELLED'
    );
END;
$$;

-- 11. ROW-LEVEL SECURITY POLICIES
-- ============================================================================

ALTER TABLE public.price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_allocations ENABLE ROW LEVEL SECURITY;

-- 11.1 Price Lists Policies
CREATE POLICY "price_lists_tenant_isolation" ON public.price_lists
    FOR ALL USING (company_id = public.current_company_id());

CREATE POLICY "price_list_items_tenant_isolation" ON public.price_list_items
    FOR ALL USING (company_id = public.current_company_id());

CREATE POLICY "customer_pricing_tenant_isolation" ON public.customer_pricing
    FOR ALL USING (company_id = public.current_company_id());

-- 11.2 Sales Orders Policies
CREATE POLICY "sales_orders_tenant_isolation" ON public.sales_orders
    FOR ALL USING (
        company_id = public.current_company_id()
        AND public.has_branch_access(branch_id)
    );

CREATE POLICY "sales_order_lines_tenant_isolation" ON public.sales_order_lines
    FOR ALL USING (company_id = public.current_company_id());

CREATE POLICY "sales_order_allocations_tenant_isolation" ON public.sales_order_allocations
    FOR ALL USING (company_id = public.current_company_id());

-- 12. PERMISSIONS
-- ============================================================================

GRANT ALL ON public.price_lists TO authenticated;
GRANT ALL ON public.price_list_items TO authenticated;
GRANT ALL ON public.customer_pricing TO authenticated;
GRANT ALL ON public.sales_orders TO authenticated;
GRANT ALL ON public.sales_order_lines TO authenticated;
GRANT ALL ON public.sales_order_allocations TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_item_selling_price(UUID, UUID, UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_customer_available_credit(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_sales_order(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_sales_order_stock(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_sales_order(UUID, TEXT) TO authenticated;
