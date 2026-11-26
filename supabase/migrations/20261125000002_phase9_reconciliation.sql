-- ============================================================================
-- KanakkuFlow ERP — Phase 9: Automated Data Reconciliation Engine & Auditing
-- Migration: 20261125000002_phase9_reconciliation.sql
-- ============================================================================

-- 1. RECONCILIATION RUNS AUDIT TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.reconciliation_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    run_by_user_id UUID NOT NULL REFERENCES auth.users(id),
    category VARCHAR(50) NOT NULL DEFAULT 'ALL',
    status VARCHAR(50) NOT NULL, -- 'CLEAN', 'DISCREPANCIES_FOUND', 'FAILED'
    health_score INT NOT NULL DEFAULT 100 CHECK (health_score BETWEEN 0 AND 100),
    critical_count INT NOT NULL DEFAULT 0,
    error_count INT NOT NULL DEFAULT 0,
    warning_count INT NOT NULL DEFAULT 0,
    summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    findings JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Immutable Trigger on reconciliation_runs
CREATE OR REPLACE FUNCTION public.prevent_reconciliation_runs_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Security Violation: Reconciliation audit records are strictly immutable. UPDATE or DELETE operations are forbidden.';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_reconciliation_runs_mutation ON public.reconciliation_runs;
CREATE TRIGGER trg_prevent_reconciliation_runs_mutation
    BEFORE UPDATE OR DELETE ON public.reconciliation_runs
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_reconciliation_runs_mutation();

-- RLS on reconciliation_runs
ALTER TABLE public.reconciliation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reconciliation_runs_select_policy"
    ON public.reconciliation_runs
    FOR SELECT
    TO authenticated
    USING (
        company_id = public.current_company_id() 
        AND public.current_user_role() IN ('OWNER', 'ADMIN', 'ACCOUNTANT')
    );

CREATE POLICY "reconciliation_runs_insert_policy"
    ON public.reconciliation_runs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        company_id = public.current_company_id()
        AND public.current_user_role() IN ('OWNER', 'ADMIN', 'ACCOUNTANT')
    );

-- Index for fast run retrieval
CREATE INDEX IF NOT EXISTS idx_reconciliation_runs_comp_date 
    ON public.reconciliation_runs (company_id, created_at DESC);

-- ============================================================================
-- 2. AUTOMATED RECONCILIATION ENGINE RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.run_system_reconciliation(
    p_category TEXT DEFAULT 'ALL'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_cid UUID;
    v_uid UUID;
    v_role user_role;
    v_findings JSONB := '[]'::jsonb;
    v_finding JSONB;
    v_critical_count INT := 0;
    v_error_count INT := 0;
    v_warning_count INT := 0;
    v_total_checks INT := 9;
    v_health_score INT := 100;
    v_status TEXT := 'CLEAN';
    v_run_id UUID;
    v_summary JSONB;

    -- Cursor variables
    r_batch RECORD;
    r_res RECORD;
    r_orphaned RECORD;
    r_inv RECORD;
    r_line RECORD;
    r_crl RECORD;
    r_yield RECORD;
BEGIN
    v_cid := public.current_company_id();
    v_uid := auth.uid();
    IF v_cid IS NULL OR v_uid IS NULL THEN
        RAISE EXCEPTION 'Unauthorized session.';
    END IF;

    v_role := public.current_user_role();
    IF v_role NOT IN ('OWNER', 'ADMIN', 'ACCOUNTANT') THEN
        RAISE EXCEPTION 'Permission Denied: Reconciliation engine requires OWNER, ADMIN, or ACCOUNTANT role.';
    END IF;

    -- ========================================================================
    -- CATEGORY 1: INVENTORY RECONCILIATION
    -- ========================================================================
    IF p_category IN ('ALL', 'INVENTORY') THEN

        -- Check 1.1: Batch current_qty vs sum of stock_movements
        FOR r_batch IN (
            SELECT 
                b.id AS batch_id,
                b.batch_number,
                i.name AS item_name,
                i.sku,
                b.current_qty AS batch_qty,
                COALESCE(SUM(sm.quantity), 0) AS ledger_qty
            FROM public.inventory_batches b
            JOIN public.items i ON i.id = b.item_id
            LEFT JOIN public.stock_movements sm ON sm.batch_id = b.id
            WHERE b.company_id = v_cid
            GROUP BY b.id, b.batch_number, i.name, i.sku, b.current_qty
            HAVING ABS(b.current_qty - COALESCE(SUM(sm.quantity), 0)) > 0.0001
        ) LOOP
            v_finding := jsonb_build_object(
                'id', uuid_generate_v4(),
                'category', 'INVENTORY',
                'checkName', 'BATCH_LEDGER_MISMATCH',
                'severity', 'CRITICAL',
                'title', 'Batch Stock vs Ledger Mismatch',
                'description', FORMAT('Batch %s (%s) current_qty (%s) does not equal sum of stock movements (%s).', 
                                      r_batch.batch_number, r_batch.sku, r_batch.batch_qty, r_batch.ledger_qty),
                'referenceType', 'BATCH',
                'referenceId', r_batch.batch_id,
                'referenceNumber', r_batch.batch_number,
                'expectedValue', r_batch.ledger_qty,
                'actualValue', r_batch.batch_qty,
                'discrepancy', r_batch.batch_qty - r_batch.ledger_qty,
                'suggestedFix', 'Perform authorized Stock Adjustment to align batch quantity with physical/ledger count.',
                'detectedAt', NOW()
            );
            v_findings := v_findings || jsonb_build_array(v_finding);
            v_critical_count := v_critical_count + 1;
        END LOOP;

        -- Check 1.2: Batch reserved_qty vs Active stock_reservations
        FOR r_res IN (
            SELECT 
                b.id AS batch_id,
                b.batch_number,
                b.reserved_qty AS batch_reserved,
                COALESCE(SUM(sr.reserved_qty), 0) AS active_res_sum
            FROM public.inventory_batches b
            LEFT JOIN public.stock_reservations sr 
                ON sr.batch_id = b.id AND sr.status = 'ACTIVE'
            WHERE b.company_id = v_cid
            GROUP BY b.id, b.batch_number, b.reserved_qty
            HAVING ABS(b.reserved_qty - COALESCE(SUM(sr.reserved_qty), 0)) > 0.0001
        ) LOOP
            v_finding := jsonb_build_object(
                'id', uuid_generate_v4(),
                'category', 'INVENTORY',
                'checkName', 'RESERVATION_SUM_MISMATCH',
                'severity', 'ERROR',
                'title', 'Batch Reserved Quantity Mismatch',
                'description', FORMAT('Batch %s reserved_qty (%s) does not match sum of active reservations (%s).', 
                                      r_res.batch_number, r_res.batch_reserved, r_res.active_res_sum),
                'referenceType', 'BATCH',
                'referenceId', r_res.batch_id,
                'referenceNumber', r_res.batch_number,
                'expectedValue', r_res.active_res_sum,
                'actualValue', r_res.batch_reserved,
                'discrepancy', r_res.batch_reserved - r_res.active_res_sum,
                'suggestedFix', 'Recalculate batch reserved_qty by synchronizing active reservation records.',
                'detectedAt', NOW()
            );
            v_findings := v_findings || jsonb_build_array(v_finding);
            v_error_count := v_error_count + 1;
        END LOOP;

        -- Check 1.3: Orphaned Reservations on Cancelled or Closed Orders
        FOR r_orphaned IN (
            SELECT 
                sr.id AS res_id,
                sr.source_document_type,
                sr.source_document_id,
                so.order_number,
                so.status AS order_status,
                sr.reserved_qty
            FROM public.stock_reservations sr
            JOIN public.sales_orders so ON so.id = sr.source_document_id
            WHERE sr.company_id = v_cid
              AND sr.status = 'ACTIVE'
              AND sr.source_document_type = 'SALES_ORDER'
              AND so.status IN ('CANCELLED', 'REJECTED', 'CLOSED')
        ) LOOP
            v_finding := jsonb_build_object(
                'id', uuid_generate_v4(),
                'category', 'INVENTORY',
                'checkName', 'ORPHANED_RESERVATION',
                'severity', 'ERROR',
                'title', 'Orphaned Sales Order Reservation',
                'description', FORMAT('Active reservation of %s units exists for sales order %s which is %s.', 
                                      r_orphaned.reserved_qty, r_orphaned.order_number, r_orphaned.order_status),
                'referenceType', 'SALES_ORDER',
                'referenceId', r_orphaned.source_document_id,
                'referenceNumber', r_orphaned.order_number,
                'expectedValue', 'CANCELLED',
                'actualValue', 'ACTIVE',
                'discrepancy', r_orphaned.reserved_qty,
                'suggestedFix', 'Release orphaned reservation back to available inventory batch stock.',
                'detectedAt', NOW()
            );
            v_findings := v_findings || jsonb_build_array(v_finding);
            v_error_count := v_error_count + 1;
        END LOOP;

        -- Check 1.4: Negative Stock or Cost
        FOR r_batch IN (
            SELECT id, batch_number, current_qty, unit_cost_paisa
            FROM public.inventory_batches
            WHERE company_id = v_cid
              AND (current_qty < 0 OR unit_cost_paisa < 0)
        ) LOOP
            v_finding := jsonb_build_object(
                'id', uuid_generate_v4(),
                'category', 'INVENTORY',
                'checkName', 'NEGATIVE_STOCK_OR_COST',
                'severity', 'CRITICAL',
                'title', 'Negative Stock Quantity or Valuation',
                'description', FORMAT('Batch %s has negative quantity (%s) or negative unit cost (%s paisa).', 
                                      r_batch.batch_number, r_batch.current_qty, r_batch.unit_cost_paisa),
                'referenceType', 'BATCH',
                'referenceId', r_batch.id,
                'referenceNumber', r_batch.batch_number,
                'expectedValue', '>= 0',
                'actualValue', r_batch.current_qty,
                'discrepancy', r_batch.current_qty,
                'suggestedFix', 'Audit stock movement ledger and adjust batch valuation with non-negative cost snapshot.',
                'detectedAt', NOW()
            );
            v_findings := v_findings || jsonb_build_array(v_finding);
            v_critical_count := v_critical_count + 1;
        END LOOP;

    END IF;

    -- ========================================================================
    -- CATEGORY 2: FINANCIAL RECONCILIATION
    -- ========================================================================
    IF p_category IN ('ALL', 'FINANCIAL') THEN

        -- Check 2.1: Invoice Line Sums vs Header Subtotal
        FOR r_inv IN (
            SELECT 
                i.id AS invoice_id,
                i.invoice_number,
                i.subtotal_paisa,
                COALESCE(SUM(sil.subtotal_paisa), 0) AS lines_subtotal
            FROM public.sales_invoices i
            LEFT JOIN public.sales_invoice_lines sil ON sil.sales_invoice_id = i.id
            WHERE i.company_id = v_cid
            GROUP BY i.id, i.invoice_number, i.subtotal_paisa
            HAVING i.subtotal_paisa <> COALESCE(SUM(sil.subtotal_paisa), 0)
        ) LOOP
            v_finding := jsonb_build_object(
                'id', uuid_generate_v4(),
                'category', 'FINANCIAL',
                'checkName', 'INVOICE_SUBTOTAL_MISMATCH',
                'severity', 'CRITICAL',
                'title', 'Invoice Line Subtotal Mismatch',
                'description', FORMAT('Invoice %s header subtotal (%s paisa) does not match lines sum (%s paisa).', 
                                      r_inv.invoice_number, r_inv.subtotal_paisa, r_inv.lines_subtotal),
                'referenceType', 'INVOICE',
                'referenceId', r_inv.invoice_id,
                'referenceNumber', r_inv.invoice_number,
                'expectedValue', r_inv.lines_subtotal,
                'actualValue', r_inv.subtotal_paisa,
                'discrepancy', r_inv.subtotal_paisa - r_inv.lines_subtotal,
                'suggestedFix', 'Recalculate invoice header subtotal from verified line item snapshots.',
                'detectedAt', NOW()
            );
            v_findings := v_findings || jsonb_build_array(v_finding);
            v_critical_count := v_critical_count + 1;
        END LOOP;

        -- Check 2.2: Line Tax Split (CGST + SGST + IGST = tax_amount_paisa)
        FOR r_line IN (
            SELECT 
                sil.id AS line_id,
                si.invoice_number,
                sil.tax_amount_paisa,
                (sil.cgst_amount_paisa + sil.sgst_amount_paisa + sil.igst_amount_paisa) AS calculated_tax
            FROM public.sales_invoice_lines sil
            JOIN public.sales_invoices si ON si.id = sil.sales_invoice_id
            WHERE si.company_id = v_cid
              AND sil.tax_amount_paisa <> (sil.cgst_amount_paisa + sil.sgst_amount_paisa + sil.igst_amount_paisa)
        ) LOOP
            v_finding := jsonb_build_object(
                'id', uuid_generate_v4(),
                'category', 'FINANCIAL',
                'checkName', 'LINE_TAX_SPLIT_MISMATCH',
                'severity', 'CRITICAL',
                'title', 'GST Tax Split Inconsistency',
                'description', FORMAT('Invoice %s line item tax (%s paisa) != CGST+SGST+IGST sum (%s paisa).', 
                                      r_line.invoice_number, r_line.tax_amount_paisa, r_line.calculated_tax),
                'referenceType', 'INVOICE_LINE',
                'referenceId', r_line.line_id,
                'referenceNumber', r_line.invoice_number,
                'expectedValue', r_line.tax_amount_paisa,
                'actualValue', r_line.calculated_tax,
                'discrepancy', r_line.calculated_tax - r_line.tax_amount_paisa,
                'suggestedFix', 'Audit GST tax rate and place-of-supply splitting logic on invoice line.',
                'detectedAt', NOW()
            );
            v_findings := v_findings || jsonb_build_array(v_finding);
            v_critical_count := v_critical_count + 1;
        END LOOP;

        -- Check 2.3: Invoice Paid + Outstanding = Total Amount
        FOR r_inv IN (
            SELECT 
                id AS invoice_id,
                invoice_number,
                total_amount_paisa,
                paid_amount_paisa,
                outstanding_amount_paisa
            FROM public.sales_invoices
            WHERE company_id = v_cid
              AND status <> 'CANCELLED'
              AND (paid_amount_paisa + outstanding_amount_paisa) <> total_amount_paisa
        ) LOOP
            v_finding := jsonb_build_object(
                'id', uuid_generate_v4(),
                'category', 'FINANCIAL',
                'checkName', 'INVOICE_SETTLEMENT_EQUATION_MISMATCH',
                'severity', 'ERROR',
                'title', 'Invoice Balance Invariant Violation',
                'description', FORMAT('Invoice %s total (%s paisa) != paid (%s) + outstanding (%s).', 
                                      r_inv.invoice_number, r_inv.total_amount_paisa, r_inv.paid_amount_paisa, r_inv.outstanding_amount_paisa),
                'referenceType', 'INVOICE',
                'referenceId', r_inv.invoice_id,
                'referenceNumber', r_inv.invoice_number,
                'expectedValue', r_inv.total_amount_paisa,
                'actualValue', r_inv.paid_amount_paisa + r_inv.outstanding_amount_paisa,
                'discrepancy', (r_inv.paid_amount_paisa + r_inv.outstanding_amount_paisa) - r_inv.total_amount_paisa,
                'suggestedFix', 'Synchronize invoice outstanding balance with payment allocation receipts.',
                'detectedAt', NOW()
            );
            v_findings := v_findings || jsonb_build_array(v_finding);
            v_error_count := v_error_count + 1;
        END LOOP;

        -- Check 2.4: Customer Ledger vs Sum of Unpaid Invoices
        FOR r_crl IN (
            WITH ledger_summary AS (
                SELECT 
                    customer_id,
                    COALESCE(SUM(debit_paisa) - SUM(credit_paisa), 0) AS net_ledger_balance
                FROM public.customer_receivables_ledger
                WHERE company_id = v_cid
                GROUP BY customer_id
            ),
            invoice_summary AS (
                SELECT 
                    customer_id,
                    COALESCE(SUM(outstanding_amount_paisa), 0) AS net_invoice_outstanding
                FROM public.sales_invoices
                WHERE company_id = v_cid AND status NOT IN ('PAID', 'CANCELLED')
                GROUP BY customer_id
            ),
            unallocated_payments AS (
                SELECT 
                    customer_id,
                    COALESCE(SUM(unallocated_amount_paisa), 0) AS total_unallocated
                FROM public.customer_payments
                WHERE company_id = v_cid AND status = 'POSTED'
                GROUP BY customer_id
            )
            SELECT 
                c.id AS customer_id,
                c.shop_name,
                c.customer_code,
                COALESCE(ls.net_ledger_balance, 0) AS ledger_bal,
                (COALESCE(inv.net_invoice_outstanding, 0) - COALESCE(up.total_unallocated, 0)) AS calculated_bal
            FROM public.customers c
            LEFT JOIN ledger_summary ls ON ls.customer_id = c.id
            LEFT JOIN invoice_summary inv ON inv.customer_id = c.id
            LEFT JOIN unallocated_payments up ON up.customer_id = c.id
            WHERE c.company_id = v_cid
              AND COALESCE(ls.net_ledger_balance, 0) <> (COALESCE(inv.net_invoice_outstanding, 0) - COALESCE(up.total_unallocated, 0))
        ) LOOP
            v_finding := jsonb_build_object(
                'id', uuid_generate_v4(),
                'category', 'FINANCIAL',
                'checkName', 'CUSTOMER_LEDGER_RECEIVABLES_MISMATCH',
                'severity', 'ERROR',
                'title', 'Customer Ledger vs Open Invoices Imbalance',
                'description', FORMAT('Customer %s (%s) receivables ledger (%s paisa) != open invoices minus unallocated payments (%s paisa).', 
                                      r_crl.shop_name, r_crl.customer_code, r_crl.ledger_bal, r_crl.calculated_bal),
                'referenceType', 'CUSTOMER',
                'referenceId', r_crl.customer_id,
                'referenceNumber', r_crl.customer_code,
                'expectedValue', r_crl.calculated_bal,
                'actualValue', r_crl.ledger_bal,
                'discrepancy', r_crl.ledger_bal - r_crl.calculated_bal,
                'suggestedFix', 'Review unposted payments or missing ledger debit entries for this customer.',
                'detectedAt', NOW()
            );
            v_findings := v_findings || jsonb_build_array(v_finding);
            v_error_count := v_error_count + 1;
        END LOOP;

    END IF;

    -- ========================================================================
    -- CATEGORY 3: COSTING & PRODUCTION RECONCILIATION
    -- ========================================================================
    IF p_category IN ('ALL', 'COSTING') THEN

        -- Check 3.1: Production Yield Outliers (< 50% or > 125%)
        FOR r_yield IN (
            SELECT 
                po.id AS order_id,
                po.order_number,
                i.name AS product_name,
                po.planned_output_qty,
                po.actual_output_qty,
                ROUND((po.actual_output_qty / NULLIF(po.planned_output_qty, 0)) * 100, 2) AS yield_pct
            FROM public.production_orders po
            JOIN public.items i ON i.id = po.product_id
            WHERE po.company_id = v_cid
              AND po.status = 'COMPLETED'
              AND po.planned_output_qty > 0
              AND ((po.actual_output_qty / po.planned_output_qty) < 0.50 OR (po.actual_output_qty / po.planned_output_qty) > 1.25)
        ) LOOP
            v_finding := jsonb_build_object(
                'id', uuid_generate_v4(),
                'category', 'COSTING',
                'checkName', 'ABNORMAL_PRODUCTION_YIELD',
                'severity', 'WARNING',
                'title', 'Abnormal Production Yield',
                'description', FORMAT('Production order %s for %s completed with abnormal yield (%s%%) [Planned: %s, Actual: %s].', 
                                      r_yield.order_number, r_yield.product_name, r_yield.yield_pct, r_yield.planned_output_qty, r_yield.actual_output_qty),
                'referenceType', 'PRODUCTION_ORDER',
                'referenceId', r_yield.order_id,
                'referenceNumber', r_yield.order_number,
                'expectedValue', '85 - 105%',
                'actualValue', r_yield.yield_pct || '%',
                'discrepancy', r_yield.actual_output_qty - r_yield.planned_output_qty,
                'suggestedFix', 'Verify physical batch weighing logs or production wastage input entries.',
                'detectedAt', NOW()
            );
            v_findings := v_findings || jsonb_build_array(v_finding);
            v_warning_count := v_warning_count + 1;
        END LOOP;

    END IF;

    -- ========================================================================
    -- HEALTH SCORE CALCULATION & AUDIT PERSISTENCE
    -- ========================================================================
    v_health_score := GREATEST(0, 100 - (v_critical_count * 25) - (v_error_count * 10) - (v_warning_count * 2));

    IF v_critical_count > 0 OR v_error_count > 0 OR v_warning_count > 0 THEN
        v_status := 'DISCREPANCIES_FOUND';
    ELSE
        v_status := 'CLEAN';
    END IF;

    v_run_id := uuid_generate_v4();

    v_summary := jsonb_build_object(
        'totalChecks', v_total_checks,
        'passedChecks', GREATEST(0, v_total_checks - (v_critical_count + v_error_count + v_warning_count)),
        'failedChecks', v_critical_count + v_error_count + v_warning_count,
        'criticalCount', v_critical_count,
        'errorCount', v_error_count,
        'warningCount', v_warning_count,
        'healthScore', v_health_score,
        'runTimestamp', NOW(),
        'runBy', v_uid,
        'status', v_status
    );

    INSERT INTO public.reconciliation_runs (
        id, company_id, run_by_user_id, category, status,
        health_score, critical_count, error_count, warning_count,
        summary, findings, created_at
    ) VALUES (
        v_run_id, v_cid, v_uid, p_category, v_status,
        v_health_score, v_critical_count, v_error_count, v_warning_count,
        v_summary, v_findings, NOW()
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'runId', v_run_id,
        'companyId', v_cid,
        'category', p_category,
        'summary', v_summary,
        'findings', v_findings
    );
END;
$$;

REVOKE ALL ON FUNCTION public.run_system_reconciliation(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_system_reconciliation(TEXT) TO authenticated;
