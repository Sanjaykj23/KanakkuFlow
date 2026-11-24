-- ============================================================================
-- KanakkuFlow ERP - Migration 20261124000005_phase7_invoicing_finance.sql
-- Phase 7: Invoicing & Finance (GST Invoicing, Receivables Ledger, Payments, Credit Notes)
-- ============================================================================

-- 1. ENUMS & TYPES
-- ============================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
        CREATE TYPE public.invoice_status AS ENUM (
            'DRAFT',
            'POSTED',
            'PARTIALLY_PAID',
            'PAID',
            'OVERDUE',
            'CANCELLED',
            'CREDITED'
        );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'receivable_entry_type') THEN
        CREATE TYPE public.receivable_entry_type AS ENUM (
            'INVOICE',
            'PAYMENT',
            'CREDIT_NOTE',
            'DEBIT_NOTE',
            'OPENING_BALANCE',
            'ADJUSTMENT'
        );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
        CREATE TYPE public.payment_method AS ENUM (
            'CASH',
            'BANK_TRANSFER',
            'UPI',
            'CHEQUE',
            'DEMAND_DRAFT',
            'OTHER'
        );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'customer_payment_status') THEN
        CREATE TYPE public.customer_payment_status AS ENUM (
            'DRAFT',
            'POSTED',
            'REVERSED'
        );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credit_note_status') THEN
        CREATE TYPE public.credit_note_status AS ENUM (
            'DRAFT',
            'PENDING_APPROVAL',
            'POSTED',
            'CANCELLED'
        );
    END IF;
END $$;

-- 2. GST SALES INVOICES & LINES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sales_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL,
    invoice_number VARCHAR(50) NOT NULL,
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    payment_terms_days INT NOT NULL DEFAULT 7 CHECK (payment_terms_days >= 0),
    sales_order_id UUID NULL,
    customer_id UUID NOT NULL,
    customer_legal_name VARCHAR(255) NOT NULL,
    customer_gstin VARCHAR(15) NULL,
    billing_address JSONB NOT NULL,
    shipping_address JSONB NOT NULL,
    place_of_supply VARCHAR(100) NOT NULL,
    is_reverse_charge BOOLEAN NOT NULL DEFAULT FALSE,
    company_legal_name VARCHAR(255) NOT NULL,
    company_gstin VARCHAR(15) NULL,
    company_address JSONB NOT NULL,
    status public.invoice_status NOT NULL DEFAULT 'DRAFT',
    subtotal_paisa BIGINT NOT NULL DEFAULT 0 CHECK (subtotal_paisa >= 0),
    discount_paisa BIGINT NOT NULL DEFAULT 0 CHECK (discount_paisa >= 0),
    taxable_amount_paisa BIGINT NOT NULL DEFAULT 0 CHECK (taxable_amount_paisa >= 0),
    cgst_paisa BIGINT NOT NULL DEFAULT 0 CHECK (cgst_paisa >= 0),
    sgst_paisa BIGINT NOT NULL DEFAULT 0 CHECK (sgst_paisa >= 0),
    igst_paisa BIGINT NOT NULL DEFAULT 0 CHECK (igst_paisa >= 0),
    total_tax_paisa BIGINT NOT NULL DEFAULT 0 CHECK (total_tax_paisa >= 0),
    rounding_paisa BIGINT NOT NULL DEFAULT 0,
    total_amount_paisa BIGINT NOT NULL DEFAULT 0 CHECK (total_amount_paisa >= 0),
    paid_amount_paisa BIGINT NOT NULL DEFAULT 0 CHECK (paid_amount_paisa >= 0),
    credited_amount_paisa BIGINT NOT NULL DEFAULT 0 CHECK (credited_amount_paisa >= 0),
    outstanding_amount_paisa BIGINT NOT NULL DEFAULT 0 CHECK (outstanding_amount_paisa >= 0),
    notes TEXT NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    posted_by UUID NULL REFERENCES auth.users(id),
    posted_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_sales_invoices_number UNIQUE (company_id, invoice_number),
    CONSTRAINT uq_sales_invoices_id UNIQUE (company_id, id),
    CONSTRAINT fk_si_branch FOREIGN KEY (company_id, branch_id) REFERENCES public.branches(company_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_si_customer FOREIGN KEY (company_id, customer_id) REFERENCES public.customers(company_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_si_order FOREIGN KEY (company_id, sales_order_id) REFERENCES public.sales_orders(company_id, id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.sales_invoice_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    invoice_id UUID NOT NULL,
    sales_order_line_id UUID NULL,
    item_id UUID NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    sku VARCHAR(50) NOT NULL,
    hsn_code VARCHAR(20) NOT NULL,
    quantity NUMERIC(14, 4) NOT NULL CHECK (quantity > 0),
    unit_id UUID NOT NULL,
    unit_code VARCHAR(20) NOT NULL,
    unit_price_paisa BIGINT NOT NULL CHECK (unit_price_paisa >= 0),
    discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
    discount_amount_paisa BIGINT NOT NULL DEFAULT 0 CHECK (discount_amount_paisa >= 0),
    taxable_value_paisa BIGINT NOT NULL DEFAULT 0 CHECK (taxable_value_paisa >= 0),
    gst_rate_percent NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (gst_rate_percent >= 0),
    cgst_paisa BIGINT NOT NULL DEFAULT 0 CHECK (cgst_paisa >= 0),
    sgst_paisa BIGINT NOT NULL DEFAULT 0 CHECK (sgst_paisa >= 0),
    igst_paisa BIGINT NOT NULL DEFAULT 0 CHECK (igst_paisa >= 0),
    line_total_paisa BIGINT NOT NULL DEFAULT 0 CHECK (line_total_paisa >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_sales_invoice_lines_id UNIQUE (company_id, id),
    CONSTRAINT fk_sil_invoice FOREIGN KEY (company_id, invoice_id) REFERENCES public.sales_invoices(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_sil_item FOREIGN KEY (company_id, item_id) REFERENCES public.items(company_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_sil_unit FOREIGN KEY (company_id, unit_id) REFERENCES public.units(company_id, id) ON DELETE RESTRICT
);

-- 3. CUSTOMER RECEIVABLES LEDGER (APPEND-ONLY)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.customer_receivables_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    entry_type public.receivable_entry_type NOT NULL,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NULL,
    source_document_type VARCHAR(50) NOT NULL,
    source_document_id UUID NOT NULL,
    reference_number VARCHAR(100) NOT NULL,
    debit_paisa BIGINT NOT NULL DEFAULT 0 CHECK (debit_paisa >= 0),
    credit_paisa BIGINT NOT NULL DEFAULT 0 CHECK (credit_paisa >= 0),
    running_balance_paisa BIGINT NOT NULL DEFAULT 0,
    notes TEXT NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_crl_id UNIQUE (company_id, id),
    CONSTRAINT fk_crl_customer FOREIGN KEY (company_id, customer_id) REFERENCES public.customers(company_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_crl_branch FOREIGN KEY (company_id, branch_id) REFERENCES public.branches(company_id, id) ON DELETE RESTRICT
);

-- Trigger: Prevent UPDATE or DELETE on customer_receivables_ledger (Append-Only)
CREATE OR REPLACE FUNCTION public.prevent_receivables_ledger_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Immutable Ledger Violation: customer_receivables_ledger entries cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_crl_mutation ON public.customer_receivables_ledger;
CREATE TRIGGER trg_prevent_crl_mutation
    BEFORE UPDATE OR DELETE ON public.customer_receivables_ledger
    FOR EACH ROW EXECUTE FUNCTION public.prevent_receivables_ledger_mutation();

-- 4. CUSTOMER PAYMENTS & ALLOCATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.customer_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    payment_number VARCHAR(50) NOT NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method public.payment_method NOT NULL DEFAULT 'BANK_TRANSFER',
    reference_number VARCHAR(100) NULL,
    amount_paisa BIGINT NOT NULL CHECK (amount_paisa > 0),
    allocated_amount_paisa BIGINT NOT NULL DEFAULT 0 CHECK (allocated_amount_paisa >= 0),
    unallocated_amount_paisa BIGINT NOT NULL DEFAULT 0 CHECK (unallocated_amount_paisa >= 0),
    status public.customer_payment_status NOT NULL DEFAULT 'POSTED',
    notes TEXT NULL,
    recorded_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_customer_payments_number UNIQUE (company_id, payment_number),
    CONSTRAINT uq_customer_payments_id UNIQUE (company_id, id),
    CONSTRAINT fk_cp_customer FOREIGN KEY (company_id, customer_id) REFERENCES public.customers(company_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_cp_branch FOREIGN KEY (company_id, branch_id) REFERENCES public.branches(company_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.customer_payment_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    payment_id UUID NOT NULL,
    invoice_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    allocated_amount_paisa BIGINT NOT NULL CHECK (allocated_amount_paisa > 0),
    allocated_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_cpa_id UNIQUE (company_id, id),
    CONSTRAINT fk_cpa_payment FOREIGN KEY (company_id, payment_id) REFERENCES public.customer_payments(company_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_cpa_invoice FOREIGN KEY (company_id, invoice_id) REFERENCES public.sales_invoices(company_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_cpa_customer FOREIGN KEY (company_id, customer_id) REFERENCES public.customers(company_id, id) ON DELETE RESTRICT
);

-- 5. CREDIT NOTES & CREDIT NOTE LINES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.credit_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL,
    credit_note_number VARCHAR(50) NOT NULL,
    credit_note_date DATE NOT NULL DEFAULT CURRENT_DATE,
    original_invoice_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    reason TEXT NOT NULL,
    status public.credit_note_status NOT NULL DEFAULT 'POSTED',
    taxable_amount_paisa BIGINT NOT NULL DEFAULT 0 CHECK (taxable_amount_paisa >= 0),
    cgst_paisa BIGINT NOT NULL DEFAULT 0 CHECK (cgst_paisa >= 0),
    sgst_paisa BIGINT NOT NULL DEFAULT 0 CHECK (sgst_paisa >= 0),
    igst_paisa BIGINT NOT NULL DEFAULT 0 CHECK (igst_paisa >= 0),
    total_amount_paisa BIGINT NOT NULL DEFAULT 0 CHECK (total_amount_paisa >= 0),
    created_by UUID NOT NULL REFERENCES auth.users(id),
    approved_by UUID NULL REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_credit_notes_number UNIQUE (company_id, credit_note_number),
    CONSTRAINT uq_credit_notes_id UNIQUE (company_id, id),
    CONSTRAINT fk_cn_invoice FOREIGN KEY (company_id, original_invoice_id) REFERENCES public.sales_invoices(company_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_cn_customer FOREIGN KEY (company_id, customer_id) REFERENCES public.customers(company_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_cn_branch FOREIGN KEY (company_id, branch_id) REFERENCES public.branches(company_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.credit_note_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    credit_note_id UUID NOT NULL,
    item_id UUID NULL,
    item_name VARCHAR(255) NOT NULL,
    quantity NUMERIC(14, 4) NOT NULL DEFAULT 0,
    unit_id UUID NULL,
    taxable_value_paisa BIGINT NOT NULL DEFAULT 0,
    gst_rate_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
    cgst_paisa BIGINT NOT NULL DEFAULT 0,
    sgst_paisa BIGINT NOT NULL DEFAULT 0,
    igst_paisa BIGINT NOT NULL DEFAULT 0,
    line_total_paisa BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_credit_note_lines_id UNIQUE (company_id, id),
    CONSTRAINT fk_cnl_note FOREIGN KEY (company_id, credit_note_id) REFERENCES public.credit_notes(company_id, id) ON DELETE CASCADE
);

-- 6. PERFORMANCE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_si_company_status ON public.sales_invoices(company_id, status);
CREATE INDEX IF NOT EXISTS idx_si_company_customer ON public.sales_invoices(company_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_si_invoice_date ON public.sales_invoices(company_id, invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_sil_invoice ON public.sales_invoice_lines(company_id, invoice_id);
CREATE INDEX IF NOT EXISTS idx_crl_customer_date ON public.customer_receivables_ledger(company_id, customer_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_crl_source ON public.customer_receivables_ledger(company_id, source_document_id);
CREATE INDEX IF NOT EXISTS idx_cp_customer ON public.customer_payments(company_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_cpa_invoice ON public.customer_payment_allocations(company_id, invoice_id);
CREATE INDEX IF NOT EXISTS idx_cn_invoice ON public.credit_notes(company_id, original_invoice_id);

-- 7. RPC: CREATE AND POST SALES INVOICE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_and_post_sales_invoice(
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
    v_company RECORD;
    v_customer RECORD;
    v_branch RECORD;
    v_address RECORD;
    v_inv_number VARCHAR(50);
    v_inv_id UUID;
    v_line RECORD;
    v_subtotal BIGINT := 0;
    v_discount BIGINT := 0;
    v_taxable BIGINT := 0;
    v_cgst BIGINT := 0;
    v_sgst BIGINT := 0;
    v_igst BIGINT := 0;
    v_total_tax BIGINT := 0;
    v_grand_total BIGINT := 0;
    v_due_date DATE;
    v_hsn VARCHAR(20);
    v_unit_code VARCHAR(20);
    v_item_name VARCHAR(255);
BEGIN
    IF v_caller_uid IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User not authenticated.';
    END IF;

    -- Lock sales order
    SELECT * INTO v_order
    FROM public.sales_orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sales order % not found.', p_order_id;
    END IF;

    IF v_order.status NOT IN ('APPROVED', 'PARTIALLY_ALLOCATED', 'ALLOCATED', 'READY_FOR_DISPATCH') THEN
        RAISE EXCEPTION 'Invalid State: Order % is not eligible for invoicing (Status: %).', v_order.order_number, v_order.status;
    END IF;

    -- Prevent duplicate invoice for same order
    IF EXISTS (
        SELECT 1 FROM public.sales_invoices
        WHERE company_id = v_order.company_id
          AND sales_order_id = p_order_id
          AND status != 'CANCELLED'
    ) THEN
        RAISE EXCEPTION 'Duplicate Invoice Violation: Sales order % has already been invoiced.', v_order.order_number;
    END IF;

    -- Retrieve company details
    SELECT * INTO v_company FROM public.companies WHERE id = v_order.company_id;
    -- Retrieve customer details
    SELECT * INTO v_customer FROM public.customers WHERE id = v_order.customer_id;
    -- Retrieve branch details
    SELECT * INTO v_branch FROM public.branches WHERE id = v_order.branch_id;
    -- Retrieve delivery address
    SELECT * INTO v_address FROM public.customer_addresses WHERE id = v_order.delivery_address_id;

    -- Calculate Due Date
    v_due_date := CURRENT_DATE + (COALESCE(v_order.payment_terms_days, 7) || ' days')::INTERVAL;

    -- Generate Invoice Number atomically
    v_inv_number := public.get_next_company_code(v_order.company_id, 'INVOICE', 'INV', 5);

    -- Insert Sales Invoice Header
    INSERT INTO public.sales_invoices (
        company_id,
        branch_id,
        invoice_number,
        invoice_date,
        due_date,
        payment_terms_days,
        sales_order_id,
        customer_id,
        customer_legal_name,
        customer_gstin,
        billing_address,
        shipping_address,
        place_of_supply,
        company_legal_name,
        company_gstin,
        company_address,
        status,
        subtotal_paisa,
        discount_paisa,
        taxable_amount_paisa,
        cgst_paisa,
        sgst_paisa,
        igst_paisa,
        total_tax_paisa,
        total_amount_paisa,
        paid_amount_paisa,
        credited_amount_paisa,
        outstanding_amount_paisa,
        notes,
        created_by,
        posted_by,
        posted_at
    ) VALUES (
        v_order.company_id,
        v_order.branch_id,
        v_inv_number,
        CURRENT_DATE,
        v_due_date,
        COALESCE(v_order.payment_terms_days, 7),
        v_order.id,
        v_order.customer_id,
        v_customer.shop_name,
        v_customer.gstin,
        row_to_json(v_address)::jsonb,
        row_to_json(v_address)::jsonb,
        COALESCE(v_address.state, v_branch.state_code),
        v_company.legal_name,
        v_company.gstin,
        jsonb_build_object('city', v_branch.city, 'state_code', v_branch.state_code),
        'POSTED',
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        p_notes,
        v_caller_uid,
        v_caller_uid,
        NOW()
    ) RETURNING id INTO v_inv_id;

    -- Copy Line Items
    FOR v_line IN
        SELECT sol.*, i.name AS item_name, h.code AS hsn_code, u.symbol AS unit_code
        FROM public.sales_order_lines sol
        JOIN public.items i ON i.id = sol.item_id
        LEFT JOIN public.hsn_codes h ON h.id = i.hsn_code_id
        JOIN public.units u ON u.id = sol.unit_id
        WHERE sol.sales_order_id = p_order_id
    LOOP
        v_subtotal := v_subtotal + (v_line.ordered_qty * v_line.unit_price_paisa);
        v_discount := v_discount + v_line.discount_amount_paisa;
        v_taxable := v_taxable + v_line.taxable_amount_paisa;
        v_cgst := v_cgst + v_line.cgst_paisa;
        v_sgst := v_sgst + v_line.sgst_paisa;
        v_igst := v_igst + v_line.igst_paisa;

        INSERT INTO public.sales_invoice_lines (
            company_id,
            invoice_id,
            sales_order_line_id,
            item_id,
            item_name,
            sku,
            hsn_code,
            quantity,
            unit_id,
            unit_code,
            unit_price_paisa,
            discount_percent,
            discount_amount_paisa,
            taxable_value_paisa,
            gst_rate_percent,
            cgst_paisa,
            sgst_paisa,
            igst_paisa,
            line_total_paisa
        ) VALUES (
            v_order.company_id,
            v_inv_id,
            v_line.id,
            v_line.item_id,
            v_line.item_name,
            v_line.sku,
            COALESCE(v_line.hsn_code, '1905'),
            v_line.ordered_qty,
            v_line.unit_id,
            v_line.unit_code,
            v_line.unit_price_paisa,
            v_line.discount_percent,
            v_line.discount_amount_paisa,
            v_line.taxable_amount_paisa,
            v_line.tax_rate_percent,
            v_line.cgst_paisa,
            v_line.sgst_paisa,
            v_line.igst_paisa,
            v_line.line_total_paisa
        );
    END LOOP;

    v_total_tax := v_cgst + v_sgst + v_igst;
    v_grand_total := v_taxable + v_total_tax;

    -- Update Invoice Totals
    UPDATE public.sales_invoices
    SET subtotal_paisa = v_subtotal,
        discount_paisa = v_discount,
        taxable_amount_paisa = v_taxable,
        cgst_paisa = v_cgst,
        sgst_paisa = v_sgst,
        igst_paisa = v_igst,
        total_tax_paisa = v_total_tax,
        total_amount_paisa = v_grand_total,
        outstanding_amount_paisa = v_grand_total,
        updated_at = NOW()
    WHERE id = v_inv_id;

    -- Post Debit Entry into Customer Receivables Ledger
    INSERT INTO public.customer_receivables_ledger (
        company_id,
        customer_id,
        branch_id,
        entry_type,
        transaction_date,
        due_date,
        source_document_type,
        source_document_id,
        reference_number,
        debit_paisa,
        credit_paisa,
        running_balance_paisa,
        notes,
        created_by
    ) VALUES (
        v_order.company_id,
        v_order.customer_id,
        v_order.branch_id,
        'INVOICE',
        CURRENT_DATE,
        v_due_date,
        'SALES_INVOICE',
        v_inv_id,
        v_inv_number,
        v_grand_total,
        0,
        v_grand_total,
        'Invoice posted for sales order ' || v_order.order_number,
        v_caller_uid
    );

    -- Transition Sales Order to DISPATCHED
    UPDATE public.sales_orders
    SET status = 'DISPATCHED',
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
        'POST_SALES_INVOICE',
        'sales_invoices',
        v_inv_id,
        jsonb_build_object(
            'invoice_number', v_inv_number,
            'total_amount_paisa', v_grand_total,
            'order_number', v_order.order_number
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'invoice_id', v_inv_id,
        'invoice_number', v_inv_number,
        'total_amount_paisa', v_grand_total
    );
END;
$$;

-- 8. RPC: RECORD CUSTOMER PAYMENT & ALLOCATE TO INVOICES
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_customer_payment(
    p_customer_id UUID,
    p_branch_id UUID,
    p_payment_method public.payment_method,
    p_amount_paisa BIGINT,
    p_reference_number TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_allocations JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_uid UUID := auth.uid();
    v_customer RECORD;
    v_pay_number VARCHAR(50);
    v_pay_id UUID;
    v_alloc RECORD;
    v_inv RECORD;
    v_total_allocated BIGINT := 0;
    v_unallocated BIGINT := 0;
    v_alloc_amount BIGINT;
    v_inv_outstanding BIGINT;
    v_new_status public.invoice_status;
BEGIN
    IF v_caller_uid IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User not authenticated.';
    END IF;

    IF p_amount_paisa <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be greater than zero.';
    END IF;

    -- Retrieve customer
    SELECT * INTO v_customer
    FROM public.customers
    WHERE id = p_customer_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Customer % not found.', p_customer_id;
    END IF;

    -- Generate Payment Sequence
    v_pay_number := public.get_next_company_code(v_customer.company_id, 'PAYMENT', 'PAY', 5);

    -- Insert Payment Header
    INSERT INTO public.customer_payments (
        company_id,
        branch_id,
        customer_id,
        payment_number,
        payment_date,
        payment_method,
        reference_number,
        amount_paisa,
        allocated_amount_paisa,
        unallocated_amount_paisa,
        status,
        notes,
        recorded_by
    ) VALUES (
        v_customer.company_id,
        p_branch_id,
        p_customer_id,
        v_pay_number,
        CURRENT_DATE,
        p_payment_method,
        p_reference_number,
        p_amount_paisa,
        0,
        p_amount_paisa,
        'POSTED',
        p_notes,
        v_caller_uid
    ) RETURNING id INTO v_pay_id;

    -- Iterate and process allocations
    FOR v_alloc IN SELECT * FROM jsonb_to_recordset(p_allocations) AS x(invoice_id UUID, amount_paisa BIGINT)
    LOOP
        v_alloc_amount := v_alloc.amount_paisa;
        IF v_alloc_amount <= 0 THEN
            CONTINUE;
        END IF;

        -- Lock Invoice for update
        SELECT * INTO v_inv
        FROM public.sales_invoices
        WHERE id = v_alloc.invoice_id
          AND company_id = v_customer.company_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Invoice % not found or belongs to another company.', v_alloc.invoice_id;
        END IF;

        IF v_inv.customer_id != p_customer_id THEN
            RAISE EXCEPTION 'Cross-Customer Allocation Violation: Invoice % does not belong to customer %.', v_inv.invoice_number, v_customer.shop_name;
        END IF;

        v_inv_outstanding := v_inv.outstanding_amount_paisa;
        IF v_alloc_amount > v_inv_outstanding THEN
            RAISE EXCEPTION 'Allocation exceeds invoice % outstanding balance (Attempted: ₹%, Max: ₹%).',
                v_inv.invoice_number, (v_alloc_amount / 100)::NUMERIC(12,2), (v_inv_outstanding / 100)::NUMERIC(12,2);
        END IF;

        IF (v_total_allocated + v_alloc_amount) > p_amount_paisa THEN
            RAISE EXCEPTION 'Total allocated amount exceeds payment value.';
        END IF;

        -- Record Allocation
        INSERT INTO public.customer_payment_allocations (
            company_id,
            payment_id,
            invoice_id,
            customer_id,
            allocated_amount_paisa,
            allocated_by
        ) VALUES (
            v_customer.company_id,
            v_pay_id,
            v_inv.id,
            p_customer_id,
            v_alloc_amount,
            v_caller_uid
        );

        -- Update Invoice Balances
        v_inv_outstanding := v_inv_outstanding - v_alloc_amount;
        IF v_inv_outstanding = 0 THEN
            v_new_status := 'PAID';
        ELSE
            v_new_status := 'PARTIALLY_PAID';
        END IF;

        UPDATE public.sales_invoices
        SET paid_amount_paisa = paid_amount_paisa + v_alloc_amount,
            outstanding_amount_paisa = v_inv_outstanding,
            status = v_new_status,
            updated_at = NOW()
        WHERE id = v_inv.id;

        v_total_allocated := v_total_allocated + v_alloc_amount;
    END LOOP;

    v_unallocated := p_amount_paisa - v_total_allocated;

    -- Update Payment allocation totals
    UPDATE public.customer_payments
    SET allocated_amount_paisa = v_total_allocated,
        unallocated_amount_paisa = v_unallocated,
        updated_at = NOW()
    WHERE id = v_pay_id;

    -- Post Credit Entry into Receivables Ledger
    INSERT INTO public.customer_receivables_ledger (
        company_id,
        customer_id,
        branch_id,
        entry_type,
        transaction_date,
        source_document_type,
        source_document_id,
        reference_number,
        debit_paisa,
        credit_paisa,
        running_balance_paisa,
        notes,
        created_by
    ) VALUES (
        v_customer.company_id,
        p_customer_id,
        p_branch_id,
        'PAYMENT',
        CURRENT_DATE,
        'CUSTOMER_PAYMENT',
        v_pay_id,
        v_pay_number,
        0,
        p_amount_paisa,
        -p_amount_paisa,
        'Payment received via ' || p_payment_method || ' (Ref: ' || COALESCE(p_reference_number, 'None') || ')',
        v_caller_uid
    );

    -- Audit Log
    INSERT INTO public.audit_logs (
        company_id,
        user_id,
        action,
        entity_name,
        entity_id,
        new_values
    ) VALUES (
        v_customer.company_id,
        v_caller_uid,
        'RECORD_CUSTOMER_PAYMENT',
        'customer_payments',
        v_pay_id,
        jsonb_build_object(
            'payment_number', v_pay_number,
            'amount_paisa', p_amount_paisa,
            'allocated_paisa', v_total_allocated,
            'unallocated_paisa', v_unallocated
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'payment_id', v_pay_id,
        'payment_number', v_pay_number,
        'allocated_paisa', v_total_allocated,
        'unallocated_paisa', v_unallocated
    );
END;
$$;

-- 9. RPC: ISSUE CREDIT NOTE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.issue_credit_note(
    p_invoice_id UUID,
    p_reason TEXT,
    p_amount_paisa BIGINT,
    p_taxable_paisa BIGINT,
    p_cgst_paisa BIGINT,
    p_sgst_paisa BIGINT,
    p_igst_paisa BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_uid UUID := auth.uid();
    v_inv RECORD;
    v_cn_number VARCHAR(50);
    v_cn_id UUID;
    v_max_creditable BIGINT;
    v_new_outstanding BIGINT;
    v_new_status public.invoice_status;
BEGIN
    IF v_caller_uid IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User not authenticated.';
    END IF;

    -- Lock Invoice
    SELECT * INTO v_inv
    FROM public.sales_invoices
    WHERE id = p_invoice_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice % not found.', p_invoice_id;
    END IF;

    IF v_inv.status IN ('CANCELLED', 'DRAFT') THEN
        RAISE EXCEPTION 'Cannot issue credit note against invoice in status %.', v_inv.status;
    END IF;

    v_max_creditable := v_inv.total_amount_paisa - v_inv.credited_amount_paisa;
    IF p_amount_paisa > v_max_creditable THEN
        RAISE EXCEPTION 'Credit note amount exceeds remaining creditable invoice balance (Attempted: ₹%, Max: ₹%).',
            (p_amount_paisa / 100)::NUMERIC(12,2), (v_max_creditable / 100)::NUMERIC(12,2);
    END IF;

    -- Generate Credit Note Sequence
    v_cn_number := public.get_next_company_code(v_inv.company_id, 'CREDIT_NOTE', 'CN', 5);

    -- Insert Credit Note
    INSERT INTO public.credit_notes (
        company_id,
        branch_id,
        credit_note_number,
        credit_note_date,
        original_invoice_id,
        customer_id,
        reason,
        status,
        taxable_amount_paisa,
        cgst_paisa,
        sgst_paisa,
        igst_paisa,
        total_amount_paisa,
        created_by,
        approved_by,
        approved_at
    ) VALUES (
        v_inv.company_id,
        v_inv.branch_id,
        v_cn_number,
        CURRENT_DATE,
        v_inv.id,
        v_inv.customer_id,
        p_reason,
        'POSTED',
        p_taxable_paisa,
        p_cgst_paisa,
        p_sgst_paisa,
        p_igst_paisa,
        p_amount_paisa,
        v_caller_uid,
        v_caller_uid,
        NOW()
    ) RETURNING id INTO v_cn_id;

    -- Update Invoice Credited and Outstanding Balances
    v_new_outstanding := GREATEST(0, v_inv.outstanding_amount_paisa - p_amount_paisa);
    IF v_new_outstanding = 0 THEN
        IF v_inv.paid_amount_paisa > 0 THEN
            v_new_status := 'PAID';
        ELSE
            v_new_status := 'CREDITED';
        END IF;
    ELSE
        v_new_status := v_inv.status;
    END IF;

    UPDATE public.sales_invoices
    SET credited_amount_paisa = credited_amount_paisa + p_amount_paisa,
        outstanding_amount_paisa = v_new_outstanding,
        status = v_new_status,
        updated_at = NOW()
    WHERE id = v_inv.id;

    -- Post Credit Entry into Receivables Ledger
    INSERT INTO public.customer_receivables_ledger (
        company_id,
        customer_id,
        branch_id,
        entry_type,
        transaction_date,
        source_document_type,
        source_document_id,
        reference_number,
        debit_paisa,
        credit_paisa,
        running_balance_paisa,
        notes,
        created_by
    ) VALUES (
        v_inv.company_id,
        v_inv.customer_id,
        v_inv.branch_id,
        'CREDIT_NOTE',
        CURRENT_DATE,
        'CREDIT_NOTE',
        v_cn_id,
        v_cn_number,
        0,
        p_amount_paisa,
        -p_amount_paisa,
        'Credit note issued for invoice ' || v_inv.invoice_number || ' - ' || p_reason,
        v_caller_uid
    );

    -- Audit Log
    INSERT INTO public.audit_logs (
        company_id,
        user_id,
        action,
        entity_name,
        entity_id,
        new_values
    ) VALUES (
        v_inv.company_id,
        v_caller_uid,
        'ISSUE_CREDIT_NOTE',
        'credit_notes',
        v_cn_id,
        jsonb_build_object(
            'credit_note_number', v_cn_number,
            'invoice_number', v_inv.invoice_number,
            'total_amount_paisa', p_amount_paisa
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'credit_note_id', v_cn_id,
        'credit_note_number', v_cn_number,
        'credited_amount_paisa', p_amount_paisa
    );
END;
$$;

-- 10. ROW LEVEL SECURITY POLICIES
-- ============================================================================

ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_receivables_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_note_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_invoices_tenant_isolation" ON public.sales_invoices
    FOR ALL USING (
        company_id = public.current_company_id()
        AND public.has_branch_access(branch_id)
    );

CREATE POLICY "sales_invoice_lines_tenant_isolation" ON public.sales_invoice_lines
    FOR ALL USING (company_id = public.current_company_id());

CREATE POLICY "customer_receivables_ledger_tenant_isolation" ON public.customer_receivables_ledger
    FOR ALL USING (company_id = public.current_company_id());

CREATE POLICY "customer_payments_tenant_isolation" ON public.customer_payments
    FOR ALL USING (
        company_id = public.current_company_id()
        AND public.has_branch_access(branch_id)
    );

CREATE POLICY "customer_payment_allocations_tenant_isolation" ON public.customer_payment_allocations
    FOR ALL USING (company_id = public.current_company_id());

CREATE POLICY "credit_notes_tenant_isolation" ON public.credit_notes
    FOR ALL USING (
        company_id = public.current_company_id()
        AND public.has_branch_access(branch_id)
    );

CREATE POLICY "credit_note_lines_tenant_isolation" ON public.credit_note_lines
    FOR ALL USING (company_id = public.current_company_id());

-- 11. PERMISSIONS
-- ============================================================================

GRANT ALL ON public.sales_invoices TO authenticated;
GRANT ALL ON public.sales_invoice_lines TO authenticated;
GRANT ALL ON public.customer_receivables_ledger TO authenticated;
GRANT ALL ON public.customer_payments TO authenticated;
GRANT ALL ON public.customer_payment_allocations TO authenticated;
GRANT ALL ON public.credit_notes TO authenticated;
GRANT ALL ON public.credit_note_lines TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_and_post_sales_invoice(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_customer_payment(UUID, UUID, public.payment_method, BIGINT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_credit_note(UUID, TEXT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT) TO authenticated;
