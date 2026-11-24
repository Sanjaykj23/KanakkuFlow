-- ============================================================================
-- KanakkuFlow ERP - Phase 3: Procurement & Goods Receipt Migration
-- File: supabase/migrations/20261124000001_phase3_procurement_grn.sql
-- Description: Purchase Orders, PO Lines, Goods Receipt Notes (GRN), GRN Lines,
--              Inventory Batches, Append-Only Stock Movements Ledger, Supplier Bills,
--              Hardened Non-Recursive RLS, and Atomic Workflow RPCs.
-- ============================================================================

-- 1. ENUMS
DO $$ BEGIN
    CREATE TYPE public.purchase_order_status AS ENUM (
        'DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'REJECTED', 'CANCELLED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.grn_status AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.qc_status AS ENUM ('PENDING', 'RELEASED', 'REJECTED', 'QUARANTINED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.stock_movement_type AS ENUM (
        'GRN_RECEIPT', 'GRN_REVERSAL', 'PRODUCTION_ISSUE', 'PRODUCTION_RECEIPT', 'SALES_DISPATCH', 'STOCK_ADJUSTMENT'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.supplier_bill_status AS ENUM (
        'DRAFT', 'POSTED', 'DISCREPANCY_FLAGGED', 'PAID', 'CANCELLED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================================
-- 2. PURCHASE ORDERS & PURCHASE ORDER LINES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    po_number VARCHAR(50) NOT NULL,
    supplier_id UUID NOT NULL,
    delivery_warehouse_id UUID NOT NULL,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_delivery_date DATE NOT NULL,
    status public.purchase_order_status NOT NULL DEFAULT 'DRAFT',
    created_by UUID NOT NULL REFERENCES auth.users(id),
    approved_by UUID NULL REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ NULL,
    rejection_reason TEXT NULL,
    cancellation_reason TEXT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    subtotal_paisa BIGINT NOT NULL DEFAULT 0 CHECK (subtotal_paisa >= 0),
    tax_paisa BIGINT NOT NULL DEFAULT 0 CHECK (tax_paisa >= 0),
    discount_paisa BIGINT NOT NULL DEFAULT 0 CHECK (discount_paisa >= 0),
    total_paisa BIGINT NOT NULL DEFAULT 0 CHECK (total_paisa >= 0),
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_po_company_number UNIQUE (company_id, po_number),
    CONSTRAINT uq_po_company_id_id UNIQUE (company_id, id),
    CONSTRAINT fk_po_supplier FOREIGN KEY (company_id, supplier_id) REFERENCES public.suppliers(company_id, id),
    CONSTRAINT fk_po_warehouse FOREIGN KEY (company_id, delivery_warehouse_id) REFERENCES public.warehouses(company_id, id)
);

CREATE TABLE IF NOT EXISTS public.purchase_order_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    purchase_order_id UUID NOT NULL,
    line_number INT NOT NULL,
    item_id UUID NOT NULL,
    ordered_qty NUMERIC(14, 4) NOT NULL CHECK (ordered_qty > 0),
    unit_id UUID NOT NULL,
    conversion_rate NUMERIC(15, 6) NOT NULL DEFAULT 1.0 CHECK (conversion_rate > 0),
    base_unit_qty NUMERIC(14, 4) NOT NULL CHECK (base_unit_qty > 0),
    unit_price_paisa BIGINT NOT NULL CHECK (unit_price_paisa >= 0),
    discount_paisa BIGINT NOT NULL DEFAULT 0 CHECK (discount_paisa >= 0),
    tax_rate_id UUID NULL,
    tax_rate_snapshot NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (tax_rate_snapshot >= 0),
    tax_paisa BIGINT NOT NULL DEFAULT 0 CHECK (tax_paisa >= 0),
    total_paisa BIGINT NOT NULL CHECK (total_paisa >= 0),
    received_qty NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (received_qty >= 0),
    pending_qty NUMERIC(14, 4) NOT NULL CHECK (pending_qty >= 0),
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_po_line_number UNIQUE (company_id, purchase_order_id, line_number),
    CONSTRAINT uq_po_lines_company_id_id UNIQUE (company_id, id),
    CONSTRAINT fk_po_line_po FOREIGN KEY (company_id, purchase_order_id) REFERENCES public.purchase_orders(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_po_line_item FOREIGN KEY (company_id, item_id) REFERENCES public.items(company_id, id),
    CONSTRAINT fk_po_line_unit FOREIGN KEY (company_id, unit_id) REFERENCES public.units(company_id, id),
    CONSTRAINT fk_po_line_tax FOREIGN KEY (company_id, tax_rate_id) REFERENCES public.tax_rates(company_id, id) ON DELETE SET NULL
);

-- ============================================================================
-- 3. GOODS RECEIPT NOTES (GRN) & LINES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.goods_receipt_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL,
    grn_number VARCHAR(50) NOT NULL,
    purchase_order_id UUID NOT NULL,
    supplier_id UUID NOT NULL,
    receiving_employee_id UUID NOT NULL REFERENCES auth.users(id),
    receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
    supplier_delivery_challan VARCHAR(100) NOT NULL,
    status public.grn_status NOT NULL DEFAULT 'DRAFT',
    posted_at TIMESTAMPTZ NULL,
    posted_by UUID NULL REFERENCES auth.users(id),
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_grn_company_number UNIQUE (company_id, grn_number),
    CONSTRAINT uq_grn_company_id_id UNIQUE (company_id, id),
    CONSTRAINT fk_grn_po FOREIGN KEY (company_id, purchase_order_id) REFERENCES public.purchase_orders(company_id, id),
    CONSTRAINT fk_grn_supplier FOREIGN KEY (company_id, supplier_id) REFERENCES public.suppliers(company_id, id),
    CONSTRAINT fk_grn_warehouse FOREIGN KEY (company_id, warehouse_id) REFERENCES public.warehouses(company_id, id)
);

CREATE TABLE IF NOT EXISTS public.goods_receipt_note_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    grn_id UUID NOT NULL,
    po_line_id UUID NOT NULL,
    item_id UUID NOT NULL,
    received_qty NUMERIC(14, 4) NOT NULL CHECK (received_qty > 0),
    accepted_qty NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (accepted_qty >= 0),
    rejected_qty NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (rejected_qty >= 0),
    damaged_qty NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (damaged_qty >= 0),
    unit_id UUID NOT NULL,
    conversion_rate NUMERIC(15, 6) NOT NULL DEFAULT 1.0 CHECK (conversion_rate > 0),
    base_accepted_qty NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (base_accepted_qty >= 0),
    supplier_batch_number VARCHAR(100) NULL,
    manufacturing_date DATE NULL,
    expiry_date DATE NULL,
    qc_status public.qc_status NOT NULL DEFAULT 'PENDING',
    rejection_reason TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_grn_lines_company_id_id UNIQUE (company_id, id),
    CONSTRAINT chk_grn_line_qty_balance CHECK (received_qty = accepted_qty + rejected_qty + damaged_qty),
    CONSTRAINT fk_grn_line_grn FOREIGN KEY (company_id, grn_id) REFERENCES public.goods_receipt_notes(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_grn_line_po_line FOREIGN KEY (company_id, po_line_id) REFERENCES public.purchase_order_lines(company_id, id),
    CONSTRAINT fk_grn_line_item FOREIGN KEY (company_id, item_id) REFERENCES public.items(company_id, id),
    CONSTRAINT fk_grn_line_unit FOREIGN KEY (company_id, unit_id) REFERENCES public.units(company_id, id)
);

-- ============================================================================
-- 4. INVENTORY BATCHES & STOCK MOVEMENTS (IMMUTABLE LEDGER)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL,
    item_id UUID NOT NULL,
    batch_number VARCHAR(50) NOT NULL,
    supplier_id UUID NULL,
    supplier_batch_number VARCHAR(100) NULL,
    grn_id UUID NOT NULL,
    grn_line_id UUID NOT NULL,
    received_date DATE NOT NULL DEFAULT CURRENT_DATE,
    manufacturing_date DATE NULL,
    expiry_date DATE NULL,
    initial_qty NUMERIC(14, 4) NOT NULL CHECK (initial_qty >= 0),
    current_qty NUMERIC(14, 4) NOT NULL CHECK (current_qty >= 0),
    base_unit_id UUID NOT NULL,
    unit_cost_paisa BIGINT NOT NULL CHECK (unit_cost_paisa >= 0),
    qc_status public.qc_status NOT NULL DEFAULT 'PENDING',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_batch_company_number UNIQUE (company_id, batch_number),
    CONSTRAINT uq_batches_company_id_id UNIQUE (company_id, id),
    CONSTRAINT fk_batch_warehouse FOREIGN KEY (company_id, warehouse_id) REFERENCES public.warehouses(company_id, id),
    CONSTRAINT fk_batch_item FOREIGN KEY (company_id, item_id) REFERENCES public.items(company_id, id),
    CONSTRAINT fk_batch_supplier FOREIGN KEY (company_id, supplier_id) REFERENCES public.suppliers(company_id, id),
    CONSTRAINT fk_batch_unit FOREIGN KEY (company_id, base_unit_id) REFERENCES public.units(company_id, id),
    CONSTRAINT fk_batch_grn FOREIGN KEY (company_id, grn_id) REFERENCES public.goods_receipt_notes(company_id, id),
    CONSTRAINT fk_batch_grn_line FOREIGN KEY (company_id, grn_line_id) REFERENCES public.goods_receipt_note_lines(company_id, id)
);

CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL,
    item_id UUID NOT NULL,
    batch_id UUID NULL,
    movement_type public.stock_movement_type NOT NULL,
    quantity NUMERIC(14, 4) NOT NULL CHECK (quantity <> 0),
    base_unit_id UUID NOT NULL,
    unit_cost_paisa BIGINT NOT NULL DEFAULT 0,
    reference_type VARCHAR(50) NOT NULL,
    reference_id UUID NOT NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_movement_warehouse FOREIGN KEY (company_id, warehouse_id) REFERENCES public.warehouses(company_id, id),
    CONSTRAINT fk_movement_item FOREIGN KEY (company_id, item_id) REFERENCES public.items(company_id, id),
    CONSTRAINT fk_movement_batch FOREIGN KEY (company_id, batch_id) REFERENCES public.inventory_batches(company_id, id),
    CONSTRAINT fk_movement_unit FOREIGN KEY (company_id, base_unit_id) REFERENCES public.units(company_id, id)
);

-- Immutable Ledger Trigger on stock_movements
CREATE OR REPLACE FUNCTION public.prevent_stock_movement_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Security Violation: Stock movements are an immutable ledger. UPDATE or DELETE operations are strictly forbidden.';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_stock_movement_mutation ON public.stock_movements;
CREATE TRIGGER trg_prevent_stock_movement_mutation
    BEFORE UPDATE OR DELETE ON public.stock_movements
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_stock_movement_mutation();

-- ============================================================================
-- 5. SUPPLIER BILLS (INVOICE MATCHING)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.supplier_bills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    bill_number VARCHAR(50) NOT NULL,
    supplier_id UUID NOT NULL,
    supplier_invoice_number VARCHAR(100) NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    purchase_order_id UUID NULL,
    grn_id UUID NULL,
    taxable_amount_paisa BIGINT NOT NULL DEFAULT 0 CHECK (taxable_amount_paisa >= 0),
    tax_amount_paisa BIGINT NOT NULL DEFAULT 0 CHECK (tax_amount_paisa >= 0),
    freight_charges_paisa BIGINT NOT NULL DEFAULT 0 CHECK (freight_charges_paisa >= 0),
    discount_paisa BIGINT NOT NULL DEFAULT 0 CHECK (discount_paisa >= 0),
    total_amount_paisa BIGINT NOT NULL CHECK (total_amount_paisa >= 0),
    status public.supplier_bill_status NOT NULL DEFAULT 'DRAFT',
    discrepancy_notes TEXT NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_supplier_bills_company_number UNIQUE (company_id, bill_number),
    CONSTRAINT uq_supplier_invoice UNIQUE (company_id, supplier_id, supplier_invoice_number),
    CONSTRAINT fk_bill_supplier FOREIGN KEY (company_id, supplier_id) REFERENCES public.suppliers(company_id, id),
    CONSTRAINT fk_bill_po FOREIGN KEY (company_id, purchase_order_id) REFERENCES public.purchase_orders(company_id, id) ON DELETE SET NULL,
    CONSTRAINT fk_bill_grn FOREIGN KEY (company_id, grn_id) REFERENCES public.goods_receipt_notes(company_id, id) ON DELETE SET NULL
);

-- ============================================================================
-- 6. INDEXES FOR PERFORMANCE & AUDIT QUERYING
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_po_company_status ON public.purchase_orders(company_id, status);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON public.purchase_orders(company_id, supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_branch ON public.purchase_orders(company_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_po_lines_po ON public.purchase_order_lines(company_id, purchase_order_id);

CREATE INDEX IF NOT EXISTS idx_grn_company_status ON public.goods_receipt_notes(company_id, status);
CREATE INDEX IF NOT EXISTS idx_grn_po ON public.goods_receipt_notes(company_id, purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_grn_supplier ON public.goods_receipt_notes(company_id, supplier_id);
CREATE INDEX IF NOT EXISTS idx_grn_warehouse ON public.goods_receipt_notes(company_id, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_grn_lines_grn ON public.goods_receipt_note_lines(company_id, grn_id);

CREATE INDEX IF NOT EXISTS idx_batches_company_item ON public.inventory_batches(company_id, item_id, is_active);
CREATE INDEX IF NOT EXISTS idx_batches_warehouse ON public.inventory_batches(company_id, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_batches_expiry ON public.inventory_batches(company_id, expiry_date);

CREATE INDEX IF NOT EXISTS idx_movements_item_batch ON public.stock_movements(company_id, item_id, batch_id);
CREATE INDEX IF NOT EXISTS idx_movements_warehouse ON public.stock_movements(company_id, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_movements_reference ON public.stock_movements(company_id, reference_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_supplier_bills_supplier ON public.supplier_bills(company_id, supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_bills_po ON public.supplier_bills(company_id, purchase_order_id);

-- ============================================================================
-- 7. MUTATION GUARDS (TRIGGERS)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.guard_purchase_order_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF current_setting('app.trusted_mutation', true) IS DISTINCT FROM 'true' THEN
        IF NEW.status IS DISTINCT FROM OLD.status THEN
            RAISE EXCEPTION 'Direct update of purchase order status is prohibited. Use workflow RPCs.';
        END IF;
        IF NEW.approved_by IS DISTINCT FROM OLD.approved_by OR NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
            RAISE EXCEPTION 'Direct tampering with approval audit fields is prohibited.';
        END IF;
        IF OLD.status NOT IN ('DRAFT', 'REJECTED') THEN
            RAISE EXCEPTION 'Modifications are prohibited on purchase orders once submitted or approved.';
        END IF;
    END IF;

    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_purchase_order_mutation ON public.purchase_orders;
CREATE TRIGGER trg_guard_purchase_order_mutation
    BEFORE UPDATE ON public.purchase_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.guard_purchase_order_mutation();

CREATE OR REPLACE FUNCTION public.guard_grn_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF current_setting('app.trusted_mutation', true) IS DISTINCT FROM 'true' THEN
        IF NEW.status IS DISTINCT FROM OLD.status THEN
            RAISE EXCEPTION 'Direct update of Goods Receipt status is prohibited. Use workflow RPCs.';
        END IF;
        IF OLD.status = 'POSTED' THEN
            RAISE EXCEPTION 'Goods Receipt Notes cannot be modified after being posted to inventory.';
        END IF;
    END IF;

    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_grn_mutation ON public.goods_receipt_notes;
CREATE TRIGGER trg_guard_grn_mutation
    BEFORE UPDATE ON public.goods_receipt_notes
    FOR EACH ROW
    EXECUTE FUNCTION public.guard_grn_mutation();

-- ============================================================================
-- 8. TRANSACTIONAL WORKFLOW FUNCTIONS (RPCs)
-- ============================================================================

-- 8.1 SUBMIT PURCHASE ORDER
CREATE OR REPLACE FUNCTION public.submit_purchase_order(p_po_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_uid UUID := auth.uid();
    v_po RECORD;
    v_line_count INT;
BEGIN
    IF v_caller_uid IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User not authenticated.';
    END IF;

    SELECT * INTO v_po FROM public.purchase_orders WHERE id = p_po_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Purchase Order not found.';
    END IF;

    IF v_po.status <> 'DRAFT' THEN
        RAISE EXCEPTION 'Only DRAFT purchase orders can be submitted. Current status: %', v_po.status;
    END IF;

    -- Ensure branch access
    IF NOT public.has_branch_access(v_po.branch_id) THEN
        RAISE EXCEPTION 'Access Denied: Caller does not have access to this branch.';
    END IF;

    -- Check that at least one line exists
    SELECT COUNT(*) INTO v_line_count FROM public.purchase_order_lines WHERE purchase_order_id = p_po_id;
    IF v_line_count = 0 THEN
        RAISE EXCEPTION 'Cannot submit a purchase order with zero line items.';
    END IF;

    PERFORM set_config('app.trusted_mutation', 'true', true);

    UPDATE public.purchase_orders
    SET status = 'SUBMITTED',
        updated_at = NOW()
    WHERE id = p_po_id;

    INSERT INTO public.audit_logs (
        company_id, user_id, action, entity_name, entity_id, new_values
    ) VALUES (
        v_po.company_id, v_caller_uid, 'SUBMIT_PURCHASE_ORDER', 'purchase_orders', p_po_id,
        jsonb_build_object('po_number', v_po.po_number, 'status', 'SUBMITTED')
    );

    PERFORM set_config('app.trusted_mutation', 'false', true);

    RETURN jsonb_build_object('success', true, 'status', 'SUBMITTED');
END;
$$;

-- 8.2 APPROVE PURCHASE ORDER
CREATE OR REPLACE FUNCTION public.approve_purchase_order(p_po_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_uid UUID := auth.uid();
    v_po RECORD;
    v_role VARCHAR;
    v_is_active BOOLEAN;
BEGIN
    IF v_caller_uid IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User not authenticated.';
    END IF;

    SELECT * INTO v_po FROM public.purchase_orders WHERE id = p_po_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Purchase Order not found.';
    END IF;

    -- Verify active membership and authorization
    SELECT role, is_active INTO v_role, v_is_active
    FROM public.company_memberships
    WHERE company_id = v_po.company_id AND user_id = v_caller_uid;

    IF NOT FOUND OR NOT v_is_active OR v_role NOT IN ('OWNER', 'ADMIN') THEN
        RAISE EXCEPTION 'Access Denied: Only active OWNER or ADMIN can approve purchase orders.';
    END IF;

    -- STRICT SELF-APPROVAL BAN
    IF v_po.created_by = v_caller_uid THEN
        RAISE EXCEPTION 'Security Violation: Self-approval is prohibited. Purchase orders must be approved by another Administrator.';
    END IF;

    -- Idempotency
    IF v_po.status = 'APPROVED' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Already approved.');
    END IF;

    IF v_po.status <> 'SUBMITTED' THEN
        RAISE EXCEPTION 'Only SUBMITTED purchase orders can be approved. Current status: %', v_po.status;
    END IF;

    PERFORM set_config('app.trusted_mutation', 'true', true);

    UPDATE public.purchase_orders
    SET status = 'APPROVED',
        approved_by = v_caller_uid,
        approved_at = NOW(),
        updated_at = NOW()
    WHERE id = p_po_id;

    INSERT INTO public.audit_logs (
        company_id, user_id, action, entity_name, entity_id, new_values
    ) VALUES (
        v_po.company_id, v_caller_uid, 'APPROVE_PURCHASE_ORDER', 'purchase_orders', p_po_id,
        jsonb_build_object('po_number', v_po.po_number, 'approved_by', v_caller_uid)
    );

    PERFORM set_config('app.trusted_mutation', 'false', true);

    RETURN jsonb_build_object('success', true, 'status', 'APPROVED');
END;
$$;

-- 8.3 REJECT PURCHASE ORDER
CREATE OR REPLACE FUNCTION public.reject_purchase_order(p_po_id UUID, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_uid UUID := auth.uid();
    v_po RECORD;
    v_role VARCHAR;
    v_is_active BOOLEAN;
BEGIN
    IF v_caller_uid IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User not authenticated.';
    END IF;

    IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
        RAISE EXCEPTION 'Rejection reason is required.';
    END IF;

    SELECT * INTO v_po FROM public.purchase_orders WHERE id = p_po_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Purchase Order not found.';
    END IF;

    SELECT role, is_active INTO v_role, v_is_active
    FROM public.company_memberships
    WHERE company_id = v_po.company_id AND user_id = v_caller_uid;

    IF NOT FOUND OR NOT v_is_active OR v_role NOT IN ('OWNER', 'ADMIN') THEN
        RAISE EXCEPTION 'Access Denied: Only active OWNER or ADMIN can reject purchase orders.';
    END IF;

    IF v_po.status NOT IN ('SUBMITTED', 'DRAFT') THEN
        RAISE EXCEPTION 'Cannot reject purchase order with status: %', v_po.status;
    END IF;

    PERFORM set_config('app.trusted_mutation', 'true', true);

    UPDATE public.purchase_orders
    SET status = 'REJECTED',
        rejection_reason = TRIM(p_reason),
        updated_at = NOW()
    WHERE id = p_po_id;

    INSERT INTO public.audit_logs (
        company_id, user_id, action, entity_name, entity_id, new_values
    ) VALUES (
        v_po.company_id, v_caller_uid, 'REJECT_PURCHASE_ORDER', 'purchase_orders', p_po_id,
        jsonb_build_object('po_number', v_po.po_number, 'reason', TRIM(p_reason))
    );

    PERFORM set_config('app.trusted_mutation', 'false', true);

    RETURN jsonb_build_object('success', true, 'status', 'REJECTED');
END;
$$;

-- 8.4 CANCEL PURCHASE ORDER
CREATE OR REPLACE FUNCTION public.cancel_purchase_order(p_po_id UUID, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_uid UUID := auth.uid();
    v_po RECORD;
    v_grn_count INT;
BEGIN
    IF v_caller_uid IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User not authenticated.';
    END IF;

    SELECT * INTO v_po FROM public.purchase_orders WHERE id = p_po_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Purchase Order not found.';
    END IF;

    -- Ensure no GRNs exist against this PO
    SELECT COUNT(*) INTO v_grn_count
    FROM public.goods_receipt_notes
    WHERE purchase_order_id = p_po_id AND status = 'POSTED';

    IF v_grn_count > 0 THEN
        RAISE EXCEPTION 'Cannot cancel purchase order. Active goods receipts have already been posted.';
    END IF;

    PERFORM set_config('app.trusted_mutation', 'true', true);

    UPDATE public.purchase_orders
    SET status = 'CANCELLED',
        cancellation_reason = TRIM(p_reason),
        updated_at = NOW()
    WHERE id = p_po_id;

    INSERT INTO public.audit_logs (
        company_id, user_id, action, entity_name, entity_id, new_values
    ) VALUES (
        v_po.company_id, v_caller_uid, 'CANCEL_PURCHASE_ORDER', 'purchase_orders', p_po_id,
        jsonb_build_object('po_number', v_po.po_number, 'reason', TRIM(p_reason))
    );

    PERFORM set_config('app.trusted_mutation', 'false', true);

    RETURN jsonb_build_object('success', true, 'status', 'CANCELLED');
END;
$$;

-- 8.5 POST GOODS RECEIPT (CORE ACID INVENTORY RECEIPT & BATCH CREATION)
CREATE OR REPLACE FUNCTION public.post_goods_receipt(p_grn_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_uid UUID := auth.uid();
    v_grn RECORD;
    v_po RECORD;
    v_line RECORD;
    v_po_line RECORD;
    v_batch_number VARCHAR;
    v_batch_id UUID;
    v_all_fulfilled BOOLEAN := true;
    v_any_remaining NUMERIC;
BEGIN
    IF v_caller_uid IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User not authenticated.';
    END IF;

    -- 1. Lock GRN row
    SELECT * INTO v_grn
    FROM public.goods_receipt_notes
    WHERE id = p_grn_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Goods Receipt Note not found.';
    END IF;

    -- Idempotency check
    IF v_grn.status = 'POSTED' THEN
        RETURN jsonb_build_object('success', true, 'message', 'GRN is already posted.');
    END IF;

    IF v_grn.status <> 'DRAFT' THEN
        RAISE EXCEPTION 'Only DRAFT Goods Receipt Notes can be posted. Current status: %', v_grn.status;
    END IF;

    -- Check caller branch access
    IF NOT public.has_branch_access(v_grn.branch_id) THEN
        RAISE EXCEPTION 'Access Denied: Caller does not have access to this branch.';
    END IF;

    -- 2. Lock Purchase Order
    SELECT * INTO v_po
    FROM public.purchase_orders
    WHERE id = v_grn.purchase_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Referenced Purchase Order not found.';
    END IF;

    IF v_po.status NOT IN ('APPROVED', 'PARTIALLY_RECEIVED') THEN
        RAISE EXCEPTION 'Goods can only be received for APPROVED or PARTIALLY_RECEIVED orders. Current PO status: %', v_po.status;
    END IF;

    PERFORM set_config('app.trusted_mutation', 'true', true);

    -- 3. Iterate over GRN lines
    FOR v_line IN
        SELECT * FROM public.goods_receipt_note_lines
        WHERE grn_id = p_grn_id
    LOOP
        -- Lock PO line
        SELECT * INTO v_po_line
        FROM public.purchase_order_lines
        WHERE id = v_line.po_line_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Referenced PO line % not found.', v_line.po_line_id;
        END IF;

        -- Validate over-receipt
        IF v_line.received_qty > v_po_line.pending_qty THEN
            RAISE EXCEPTION 'Over-receipt Violation: Received quantity (%) exceeds remaining pending quantity (%) for item.',
                v_line.received_qty, v_po_line.pending_qty;
        END IF;

        -- Update PO line received and pending quantities
        UPDATE public.purchase_order_lines
        SET received_qty = received_qty + v_line.received_qty,
            pending_qty = GREATEST(0, pending_qty - v_line.received_qty),
            updated_at = NOW()
        WHERE id = v_po_line.id;

        -- Create Batch and Stock Movement ONLY for accepted quantities
        IF v_line.accepted_qty > 0 THEN
            v_batch_number := public.get_next_company_code(v_grn.company_id, 'BATCH', 'BAT', 5);

            INSERT INTO public.inventory_batches (
                company_id,
                branch_id,
                warehouse_id,
                item_id,
                batch_number,
                supplier_id,
                supplier_batch_number,
                grn_id,
                grn_line_id,
                received_date,
                manufacturing_date,
                expiry_date,
                initial_qty,
                current_qty,
                base_unit_id,
                unit_cost_paisa,
                qc_status,
                is_active
            ) VALUES (
                v_grn.company_id,
                v_grn.branch_id,
                v_grn.warehouse_id,
                v_line.item_id,
                v_batch_number,
                v_grn.supplier_id,
                v_line.supplier_batch_number,
                v_grn.id,
                v_line.id,
                v_grn.receipt_date,
                v_line.manufacturing_date,
                v_line.expiry_date,
                v_line.base_accepted_qty,
                v_line.base_accepted_qty,
                v_po_line.unit_id,
                v_po_line.unit_price_paisa,
                v_line.qc_status,
                TRUE
            ) RETURNING id INTO v_batch_id;

            -- Record in immutable stock movement ledger
            INSERT INTO public.stock_movements (
                company_id,
                branch_id,
                warehouse_id,
                item_id,
                batch_id,
                movement_type,
                quantity,
                base_unit_id,
                unit_cost_paisa,
                reference_type,
                reference_id,
                created_by
            ) VALUES (
                v_grn.company_id,
                v_grn.branch_id,
                v_grn.warehouse_id,
                v_line.item_id,
                v_batch_id,
                'GRN_RECEIPT',
                v_line.base_accepted_qty,
                v_po_line.unit_id,
                v_po_line.unit_price_paisa,
                'GOODS_RECEIPT_NOTE',
                v_grn.id,
                v_caller_uid
            );
        END IF;
    END LOOP;

    -- 4. Evaluate Purchase Order Fulfilment Status
    SELECT SUM(pending_qty) INTO v_any_remaining
    FROM public.purchase_order_lines
    WHERE purchase_order_id = v_po.id;

    IF v_any_remaining = 0 THEN
        UPDATE public.purchase_orders
        SET status = 'RECEIVED',
            updated_at = NOW()
        WHERE id = v_po.id;
    ELSE
        UPDATE public.purchase_orders
        SET status = 'PARTIALLY_RECEIVED',
            updated_at = NOW()
        WHERE id = v_po.id;
    END IF;

    -- 5. Mark GRN as POSTED
    UPDATE public.goods_receipt_notes
    SET status = 'POSTED',
        posted_at = NOW(),
        posted_by = v_caller_uid,
        updated_at = NOW()
    WHERE id = p_grn_id;

    -- 6. Audit Log
    INSERT INTO public.audit_logs (
        company_id, user_id, action, entity_name, entity_id, new_values
    ) VALUES (
        v_grn.company_id, v_caller_uid, 'POST_GOODS_RECEIPT', 'goods_receipt_notes', p_grn_id,
        jsonb_build_object('grn_number', v_grn.grn_number, 'po_id', v_po.id, 'status', 'POSTED')
    );

    PERFORM set_config('app.trusted_mutation', 'false', true);

    RETURN jsonb_build_object(
        'success', true,
        'grn_number', v_grn.grn_number,
        'po_status', CASE WHEN v_any_remaining = 0 THEN 'RECEIVED' ELSE 'PARTIALLY_RECEIVED' END
    );
END;
$$;

-- 8.6 MATCH SUPPLIER BILL
CREATE OR REPLACE FUNCTION public.match_supplier_bill(p_bill_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_bill RECORD;
    v_po RECORD;
    v_diff BIGINT;
    v_status public.supplier_bill_status := 'POSTED';
    v_notes TEXT := NULL;
BEGIN
    SELECT * INTO v_bill FROM public.supplier_bills WHERE id = p_bill_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Supplier bill not found.';
    END IF;

    IF v_bill.purchase_order_id IS NOT NULL THEN
        SELECT * INTO v_po FROM public.purchase_orders WHERE id = v_bill.purchase_order_id;
        IF FOUND THEN
            v_diff := ABS(v_bill.total_amount_paisa - v_po.total_paisa);
            -- Discrepancy threshold: > 100 paisa (1 Rupee)
            IF v_diff > 100 THEN
                v_status := 'DISCREPANCY_FLAGGED';
                v_notes := FORMAT('Bill total (₹%s) differs from Purchase Order total (₹%s) by ₹%s.',
                    ROUND(v_bill.total_amount_paisa::numeric / 100, 2),
                    ROUND(v_po.total_paisa::numeric / 100, 2),
                    ROUND(v_diff::numeric / 100, 2));
            END IF;
        END IF;
    END IF;

    UPDATE public.supplier_bills
    SET status = v_status,
        discrepancy_notes = v_notes,
        updated_at = NOW()
    WHERE id = p_bill_id;

    RETURN jsonb_build_object('success', true, 'status', v_status, 'notes', v_notes);
END;
$$;

-- ============================================================================
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipt_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipt_note_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_bills ENABLE ROW LEVEL SECURITY;

-- 9.1 PURCHASE ORDERS POLICIES
CREATE POLICY "po_select" ON public.purchase_orders FOR SELECT TO authenticated
    USING (
        company_id = public.current_company_id()
        AND (
            public.current_user_role() IN ('OWNER', 'ADMIN', 'ACCOUNTANT')
            OR public.has_branch_access(branch_id)
        )
    );

CREATE POLICY "po_manage" ON public.purchase_orders FOR ALL TO authenticated
    USING (
        company_id = public.current_company_id()
        AND public.current_user_role() IN ('OWNER', 'ADMIN', 'SUPERVISOR', 'ACCOUNTANT')
        AND public.has_branch_access(branch_id)
    )
    WITH CHECK (
        company_id = public.current_company_id()
        AND public.current_user_role() IN ('OWNER', 'ADMIN', 'SUPERVISOR', 'ACCOUNTANT')
        AND public.has_branch_access(branch_id)
    );

CREATE POLICY "po_lines_select" ON public.purchase_order_lines FOR SELECT TO authenticated
    USING (company_id = public.current_company_id());

CREATE POLICY "po_lines_manage" ON public.purchase_order_lines FOR ALL TO authenticated
    USING (
        company_id = public.current_company_id()
        AND public.current_user_role() IN ('OWNER', 'ADMIN', 'SUPERVISOR', 'ACCOUNTANT')
    )
    WITH CHECK (
        company_id = public.current_company_id()
        AND public.current_user_role() IN ('OWNER', 'ADMIN', 'SUPERVISOR', 'ACCOUNTANT')
    );

-- 9.2 GOODS RECEIPT NOTES POLICIES
CREATE POLICY "grn_select" ON public.goods_receipt_notes FOR SELECT TO authenticated
    USING (
        company_id = public.current_company_id()
        AND (
            public.current_user_role() IN ('OWNER', 'ADMIN', 'ACCOUNTANT')
            OR public.has_branch_access(branch_id)
        )
    );

CREATE POLICY "grn_manage" ON public.goods_receipt_notes FOR ALL TO authenticated
    USING (
        company_id = public.current_company_id()
        AND public.current_user_role() IN ('OWNER', 'ADMIN', 'SUPERVISOR', 'WAREHOUSE')
        AND public.has_branch_access(branch_id)
    )
    WITH CHECK (
        company_id = public.current_company_id()
        AND public.current_user_role() IN ('OWNER', 'ADMIN', 'SUPERVISOR', 'WAREHOUSE')
        AND public.has_branch_access(branch_id)
    );

CREATE POLICY "grn_lines_select" ON public.goods_receipt_note_lines FOR SELECT TO authenticated
    USING (company_id = public.current_company_id());

CREATE POLICY "grn_lines_manage" ON public.goods_receipt_note_lines FOR ALL TO authenticated
    USING (
        company_id = public.current_company_id()
        AND public.current_user_role() IN ('OWNER', 'ADMIN', 'SUPERVISOR', 'WAREHOUSE')
    )
    WITH CHECK (
        company_id = public.current_company_id()
        AND public.current_user_role() IN ('OWNER', 'ADMIN', 'SUPERVISOR', 'WAREHOUSE')
    );

-- 9.3 INVENTORY BATCHES & STOCK MOVEMENTS POLICIES
CREATE POLICY "batches_select" ON public.inventory_batches FOR SELECT TO authenticated
    USING (
        company_id = public.current_company_id()
        AND (
            public.current_user_role() IN ('OWNER', 'ADMIN', 'ACCOUNTANT')
            OR public.has_branch_access(branch_id)
        )
    );

CREATE POLICY "batches_manage" ON public.inventory_batches FOR ALL TO authenticated
    USING (company_id = public.current_company_id() AND public.current_user_role() IN ('OWNER', 'ADMIN'))
    WITH CHECK (company_id = public.current_company_id() AND public.current_user_role() IN ('OWNER', 'ADMIN'));

CREATE POLICY "movements_select" ON public.stock_movements FOR SELECT TO authenticated
    USING (
        company_id = public.current_company_id()
        AND (
            public.current_user_role() IN ('OWNER', 'ADMIN', 'ACCOUNTANT')
            OR public.has_branch_access(branch_id)
        )
    );

-- 9.4 SUPPLIER BILLS POLICIES
CREATE POLICY "bills_select" ON public.supplier_bills FOR SELECT TO authenticated
    USING (
        company_id = public.current_company_id()
        AND public.current_user_role() IN ('OWNER', 'ADMIN', 'ACCOUNTANT')
    );

CREATE POLICY "bills_manage" ON public.supplier_bills FOR ALL TO authenticated
    USING (
        company_id = public.current_company_id()
        AND public.current_user_role() IN ('OWNER', 'ADMIN', 'ACCOUNTANT')
    )
    WITH CHECK (
        company_id = public.current_company_id()
        AND public.current_user_role() IN ('OWNER', 'ADMIN', 'ACCOUNTANT')
    );

-- ============================================================================
-- 10. ROLE PERMISSIONS SEEDING
-- ============================================================================

INSERT INTO public.role_permissions (role, permission_key, module, description) VALUES
('OWNER', 'purchases:view', 'Procurement', 'Can view all purchase orders across company'),
('OWNER', 'purchases:create', 'Procurement', 'Can create draft purchase orders'),
('OWNER', 'purchases:approve', 'Procurement', 'Can approve purchase orders'),
('OWNER', 'goods_receipts:view', 'Procurement', 'Can view goods receipt notes'),
('OWNER', 'goods_receipts:create', 'Procurement', 'Can create goods receipts'),
('OWNER', 'goods_receipts:post', 'Procurement', 'Can post goods receipts into inventory'),
('OWNER', 'supplier_bills:manage', 'Procurement', 'Can manage and match supplier bills'),

('ADMIN', 'purchases:view', 'Procurement', 'Can view all purchase orders'),
('ADMIN', 'purchases:create', 'Procurement', 'Can create purchase orders'),
('ADMIN', 'purchases:approve', 'Procurement', 'Can approve purchase orders'),
('ADMIN', 'goods_receipts:view', 'Procurement', 'Can view goods receipts'),
('ADMIN', 'goods_receipts:create', 'Procurement', 'Can create goods receipts'),
('ADMIN', 'goods_receipts:post', 'Procurement', 'Can post goods receipts into inventory'),
('ADMIN', 'supplier_bills:manage', 'Procurement', 'Can manage supplier bills'),

('SUPERVISOR', 'purchases:view', 'Procurement', 'Can view branch purchase orders'),
('SUPERVISOR', 'purchases:create', 'Procurement', 'Can create draft branch purchase orders'),
('SUPERVISOR', 'goods_receipts:view', 'Procurement', 'Can view branch goods receipts'),
('SUPERVISOR', 'goods_receipts:create', 'Procurement', 'Can create branch goods receipts'),

('WAREHOUSE', 'purchases:view', 'Procurement', 'Can view incoming purchase orders'),
('WAREHOUSE', 'goods_receipts:view', 'Procurement', 'Can view goods receipts'),
('WAREHOUSE', 'goods_receipts:create', 'Procurement', 'Can create draft goods receipts'),
('WAREHOUSE', 'goods_receipts:post', 'Procurement', 'Can post goods receipts for assigned warehouse'),

('ACCOUNTANT', 'purchases:view', 'Procurement', 'Can view purchase orders and commitments'),
('ACCOUNTANT', 'purchases:create', 'Procurement', 'Can create draft purchase orders'),
('ACCOUNTANT', 'goods_receipts:view', 'Procurement', 'Can view goods receipts'),
('ACCOUNTANT', 'supplier_bills:manage', 'Procurement', 'Can create, review, and match supplier bills'),

('PRODUCTION', 'purchases:view', 'Procurement', 'Can view raw material delivery schedules')
ON CONFLICT (role, permission_key) DO NOTHING;
