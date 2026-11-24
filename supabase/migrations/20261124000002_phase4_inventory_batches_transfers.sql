-- ============================================================================
-- KanakkuFlow ERP - Phase 4: Inventory & Batch Management Migration
-- File: supabase/migrations/20261124000002_phase4_inventory_batches_transfers.sql
-- Description: Batch Types, Statuses, Stock Reservations, Inter-Warehouse Transfers,
--              Inventory Adjustments, FEFO Allocation RPC, Perpetual Weighted-Average Costing,
--              Non-Recursive RLS, and Append-Only Audit Logging.
-- ============================================================================

-- 1. ENUMS
DO $$ BEGIN
    CREATE TYPE public.batch_type AS ENUM (
        'RAW_MATERIAL', 'PACKAGING', 'BULK_WIP', 'FINISHED_GOODS'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.batch_status AS ENUM (
        'ACTIVE', 'QC_PENDING', 'QUARANTINED', 'BLOCKED', 'EXPIRED', 'DEPLETED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.reservation_status AS ENUM (
        'ACTIVE', 'RELEASED', 'CONSUMED', 'EXPIRED', 'CANCELLED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.stock_transfer_status AS ENUM (
        'DRAFT', 'SUBMITTED', 'APPROVED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'REJECTED', 'CANCELLED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.stock_adjustment_status AS ENUM (
        'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.stock_adjustment_type AS ENUM (
        'PHYSICAL_COUNT', 'DAMAGE', 'EXPIRY', 'FOUND', 'RECONCILIATION'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Extend stock_movement_type enum with Phase 4 types
ALTER TYPE public.stock_movement_type ADD VALUE IF NOT EXISTS 'STOCK_TRANSFER_OUT';
ALTER TYPE public.stock_movement_type ADD VALUE IF NOT EXISTS 'STOCK_TRANSFER_IN';
ALTER TYPE public.stock_movement_type ADD VALUE IF NOT EXISTS 'STOCK_ADJUSTMENT_IN';
ALTER TYPE public.stock_movement_type ADD VALUE IF NOT EXISTS 'STOCK_ADJUSTMENT_OUT';
ALTER TYPE public.stock_movement_type ADD VALUE IF NOT EXISTS 'OPENING_STOCK';
ALTER TYPE public.stock_movement_type ADD VALUE IF NOT EXISTS 'PRODUCTION_CONSUMPTION';
ALTER TYPE public.stock_movement_type ADD VALUE IF NOT EXISTS 'PRODUCTION_OUTPUT';
ALTER TYPE public.stock_movement_type ADD VALUE IF NOT EXISTS 'SALES_RETURN';
ALTER TYPE public.stock_movement_type ADD VALUE IF NOT EXISTS 'PURCHASE_RETURN';

-- ============================================================================
-- 2. EXTEND INVENTORY BATCHES & STOCK MOVEMENTS
-- ============================================================================

-- Make grn_id and grn_line_id nullable to support manufacturing WIP & finished goods batches
ALTER TABLE public.inventory_batches ALTER COLUMN grn_id DROP NOT NULL;
ALTER TABLE public.inventory_batches ALTER COLUMN grn_line_id DROP NOT NULL;

-- Add Phase 4 columns to inventory_batches
ALTER TABLE public.inventory_batches
    ADD COLUMN IF NOT EXISTS batch_type public.batch_type NOT NULL DEFAULT 'RAW_MATERIAL',
    ADD COLUMN IF NOT EXISTS batch_status public.batch_status NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS reserved_qty NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (reserved_qty >= 0),
    ADD COLUMN IF NOT EXISTS blocked_reason TEXT NULL,
    ADD COLUMN IF NOT EXISTS blocked_by UUID NULL REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS qc_released_by UUID NULL REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS qc_released_at TIMESTAMPTZ NULL;

DO $$ BEGIN
    ALTER TABLE public.inventory_batches
        ADD CONSTRAINT chk_batch_available CHECK (current_qty >= reserved_qty);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Add reason to stock_movements
ALTER TABLE public.stock_movements
    ADD COLUMN IF NOT EXISTS reason TEXT NULL;

-- ============================================================================
-- 3. STOCK RESERVATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.stock_reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL,
    item_id UUID NOT NULL,
    batch_id UUID NOT NULL,
    reserved_qty NUMERIC(14, 4) NOT NULL CHECK (reserved_qty > 0),
    base_unit_id UUID NOT NULL,
    source_document_type VARCHAR(50) NOT NULL, -- 'SALES_ORDER', 'STOCK_TRANSFER', 'PRODUCTION_RUN'
    source_document_id UUID NOT NULL,
    status public.reservation_status NOT NULL DEFAULT 'ACTIVE',
    expiry_timestamp TIMESTAMPTZ NULL,
    notes TEXT NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_res_warehouse FOREIGN KEY (company_id, warehouse_id) REFERENCES public.warehouses(company_id, id),
    CONSTRAINT fk_res_item FOREIGN KEY (company_id, item_id) REFERENCES public.items(company_id, id),
    CONSTRAINT fk_res_batch FOREIGN KEY (company_id, batch_id) REFERENCES public.inventory_batches(company_id, id),
    CONSTRAINT fk_res_unit FOREIGN KEY (company_id, base_unit_id) REFERENCES public.units(company_id, id)
);

-- ============================================================================
-- 4. STOCK TRANSFERS & TRANSFER LINES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.stock_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    transfer_number VARCHAR(50) NOT NULL,
    source_branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    source_warehouse_id UUID NOT NULL,
    destination_branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    destination_warehouse_id UUID NOT NULL,
    status public.stock_transfer_status NOT NULL DEFAULT 'DRAFT',
    notes TEXT NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    approved_by UUID NULL REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ NULL,
    dispatched_by UUID NULL REFERENCES auth.users(id),
    dispatched_at TIMESTAMPTZ NULL,
    received_by UUID NULL REFERENCES auth.users(id),
    received_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_transfer_company_number UNIQUE (company_id, transfer_number),
    CONSTRAINT uq_transfers_company_id_id UNIQUE (company_id, id),
    CONSTRAINT chk_diff_warehouses CHECK (source_warehouse_id <> destination_warehouse_id),
    CONSTRAINT fk_transfer_src_wh FOREIGN KEY (company_id, source_warehouse_id) REFERENCES public.warehouses(company_id, id),
    CONSTRAINT fk_transfer_dst_wh FOREIGN KEY (company_id, destination_warehouse_id) REFERENCES public.warehouses(company_id, id)
);

CREATE TABLE IF NOT EXISTS public.stock_transfer_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    transfer_id UUID NOT NULL,
    line_number INT NOT NULL,
    item_id UUID NOT NULL,
    batch_id UUID NOT NULL,
    requested_qty NUMERIC(14, 4) NOT NULL CHECK (requested_qty > 0),
    dispatched_qty NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (dispatched_qty >= 0),
    received_qty NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (received_qty >= 0),
    unit_id UUID NOT NULL,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_transfer_line_number UNIQUE (company_id, transfer_id, line_number),
    CONSTRAINT fk_transfer_line_parent FOREIGN KEY (company_id, transfer_id) REFERENCES public.stock_transfers(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_transfer_line_item FOREIGN KEY (company_id, item_id) REFERENCES public.items(company_id, id),
    CONSTRAINT fk_transfer_line_batch FOREIGN KEY (company_id, batch_id) REFERENCES public.inventory_batches(company_id, id),
    CONSTRAINT fk_transfer_line_unit FOREIGN KEY (company_id, unit_id) REFERENCES public.units(company_id, id)
);

-- ============================================================================
-- 5. STOCK ADJUSTMENTS & ADJUSTMENT LINES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.stock_adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL,
    adjustment_number VARCHAR(50) NOT NULL,
    adjustment_type public.stock_adjustment_type NOT NULL,
    status public.stock_adjustment_status NOT NULL DEFAULT 'DRAFT',
    reason TEXT NOT NULL CHECK (LENGTH(TRIM(reason)) >= 5),
    created_by UUID NOT NULL REFERENCES auth.users(id),
    approved_by UUID NULL REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_adj_company_number UNIQUE (company_id, adjustment_number),
    CONSTRAINT uq_adj_company_id_id UNIQUE (company_id, id),
    CONSTRAINT fk_adj_warehouse FOREIGN KEY (company_id, warehouse_id) REFERENCES public.warehouses(company_id, id)
);

CREATE TABLE IF NOT EXISTS public.stock_adjustment_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    adjustment_id UUID NOT NULL,
    line_number INT NOT NULL,
    item_id UUID NOT NULL,
    batch_id UUID NOT NULL,
    system_qty NUMERIC(14, 4) NOT NULL CHECK (system_qty >= 0),
    counted_qty NUMERIC(14, 4) NOT NULL CHECK (counted_qty >= 0),
    difference_qty NUMERIC(14, 4) NOT NULL, -- positive for gain, negative for loss
    unit_id UUID NOT NULL,
    reason TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_adj_line_number UNIQUE (company_id, adjustment_id, line_number),
    CONSTRAINT fk_adj_line_parent FOREIGN KEY (company_id, adjustment_id) REFERENCES public.stock_adjustments(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_adj_line_item FOREIGN KEY (company_id, item_id) REFERENCES public.items(company_id, id),
    CONSTRAINT fk_adj_line_batch FOREIGN KEY (company_id, batch_id) REFERENCES public.inventory_batches(company_id, id),
    CONSTRAINT fk_adj_line_unit FOREIGN KEY (company_id, unit_id) REFERENCES public.units(company_id, id)
);

-- ============================================================================
-- 6. PERPETUAL WEIGHTED-AVERAGE COSTING LEDGER
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.item_valuation_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    item_id UUID NOT NULL,
    total_on_hand_qty NUMERIC(14, 4) NOT NULL DEFAULT 0,
    weighted_avg_cost_paisa BIGINT NOT NULL DEFAULT 0 CHECK (weighted_avg_cost_paisa >= 0),
    total_valuation_paisa BIGINT NOT NULL DEFAULT 0 CHECK (total_valuation_paisa >= 0),
    last_movement_id UUID NULL REFERENCES public.stock_movements(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_valuation_item UNIQUE (company_id, item_id),
    CONSTRAINT fk_valuation_item FOREIGN KEY (company_id, item_id) REFERENCES public.items(company_id, id)
);

-- ============================================================================
-- 7. INDEXES FOR HIGH-PERFORMANCE INVENTORY & BATCH QUERYING
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_batches_fefo ON public.inventory_batches (
    company_id, warehouse_id, item_id, expiry_date ASC NULLS LAST, received_date ASC
) WHERE is_active = TRUE AND batch_status = 'ACTIVE' AND qc_status = 'RELEASED';

CREATE INDEX IF NOT EXISTS idx_batches_expiry ON public.inventory_batches (company_id, expiry_date) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_reservations_lookup ON public.stock_reservations (company_id, batch_id, status);
CREATE INDEX IF NOT EXISTS idx_transfers_company ON public.stock_transfers (company_id, status);
CREATE INDEX IF NOT EXISTS idx_adjustments_company ON public.stock_adjustments (company_id, status);
CREATE INDEX IF NOT EXISTS idx_valuation_item ON public.item_valuation_ledger (company_id, item_id);

-- ============================================================================
-- 8. TRANSACTIONAL RPCS (SECURITY DEFINER)
-- ============================================================================

-- Function 8.1: Allocate FEFO Stock with Row-Level Locking
CREATE OR REPLACE FUNCTION public.allocate_fefo_stock(
    p_company_id UUID,
    p_warehouse_id UUID,
    p_item_id UUID,
    p_required_qty NUMERIC(14, 4)
)
RETURNS TABLE (
    batch_id UUID,
    batch_number VARCHAR(50),
    expiry_date DATE,
    allocated_qty NUMERIC(14, 4),
    unit_cost_paisa BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_remaining_qty NUMERIC(14, 4) := p_required_qty;
    v_rec RECORD;
    v_available NUMERIC(14, 4);
    v_take NUMERIC(14, 4);
BEGIN
    IF p_required_qty <= 0 THEN
        RAISE EXCEPTION 'Required quantity must be greater than zero.';
    END IF;

    FOR v_rec IN
        SELECT b.id, b.batch_number, b.expiry_date, b.current_qty, b.reserved_qty, b.unit_cost_paisa
        FROM public.inventory_batches b
        WHERE b.company_id = p_company_id
          AND b.warehouse_id = p_warehouse_id
          AND b.item_id = p_item_id
          AND b.is_active = TRUE
          AND b.batch_status = 'ACTIVE'
          AND b.qc_status = 'RELEASED'
          AND (b.expiry_date IS NULL OR b.expiry_date >= CURRENT_DATE)
          AND (b.current_qty - b.reserved_qty) > 0
        ORDER BY b.expiry_date ASC NULLS LAST, b.received_date ASC
        FOR UPDATE
    LOOP
        v_available := v_rec.current_qty - v_rec.reserved_qty;
        v_take := LEAST(v_remaining_qty, v_available);

        batch_id := v_rec.id;
        batch_number := v_rec.batch_number;
        expiry_date := v_rec.expiry_date;
        allocated_qty := v_take;
        unit_cost_paisa := v_rec.unit_cost_paisa;
        RETURN NEXT;

        v_remaining_qty := v_remaining_qty - v_take;
        EXIT WHEN v_remaining_qty <= 0;
    END LOOP;

    IF v_remaining_qty > 0 THEN
        RAISE EXCEPTION 'Insufficient Available Stock: Short by % units for requested item in this warehouse.', v_remaining_qty;
    END IF;
END;
$$;

-- Function 8.2: Create Stock Reservation
CREATE OR REPLACE FUNCTION public.create_stock_reservation(
    p_company_id UUID,
    p_branch_id UUID,
    p_warehouse_id UUID,
    p_item_id UUID,
    p_batch_id UUID,
    p_reserved_qty NUMERIC(14, 4),
    p_base_unit_id UUID,
    p_source_document_type VARCHAR(50),
    p_source_document_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_uid UUID;
    v_batch RECORD;
    v_res_id UUID;
BEGIN
    v_caller_uid := auth.uid();
    IF v_caller_uid IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User session required.';
    END IF;

    -- Lock batch row
    SELECT * INTO v_batch
    FROM public.inventory_batches
    WHERE id = p_batch_id AND company_id = p_company_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Batch not found.';
    END IF;

    IF v_batch.batch_status <> 'ACTIVE' OR v_batch.qc_status <> 'RELEASED' THEN
        RAISE EXCEPTION 'Batch is not active or not released for reservation.';
    END IF;

    IF (v_batch.current_qty - v_batch.reserved_qty) < p_reserved_qty THEN
        RAISE EXCEPTION 'Cannot reserve: Requested % exceeds available %.', p_reserved_qty, (v_batch.current_qty - v_batch.reserved_qty);
    END IF;

    -- Update batch reserved qty
    UPDATE public.inventory_batches
    SET reserved_qty = reserved_qty + p_reserved_qty,
        updated_at = NOW()
    WHERE id = p_batch_id;

    -- Insert reservation
    INSERT INTO public.stock_reservations (
        company_id, branch_id, warehouse_id, item_id, batch_id,
        reserved_qty, base_unit_id, source_document_type, source_document_id,
        status, notes, created_by
    ) VALUES (
        p_company_id, p_branch_id, p_warehouse_id, p_item_id, p_batch_id,
        p_reserved_qty, p_base_unit_id, p_source_document_type, p_source_document_id,
        'ACTIVE', p_notes, v_caller_uid
    ) RETURNING id INTO v_res_id;

    RETURN v_res_id;
END;
$$;

-- Function 8.3: Release Stock Reservation
CREATE OR REPLACE FUNCTION public.release_stock_reservation(p_reservation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_res RECORD;
BEGIN
    SELECT * INTO v_res
    FROM public.stock_reservations
    WHERE id = p_reservation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reservation not found.';
    END IF;

    IF v_res.status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'Only ACTIVE reservations can be released.';
    END IF;

    -- Restore batch reserved_qty
    UPDATE public.inventory_batches
    SET reserved_qty = GREATEST(0, reserved_qty - v_res.reserved_qty),
        updated_at = NOW()
    WHERE id = v_res.batch_id;

    UPDATE public.stock_reservations
    SET status = 'RELEASED', updated_at = NOW()
    WHERE id = p_reservation_id;
END;
$$;

-- Function 8.4: Dispatch Stock Transfer (Source Deduction)
CREATE OR REPLACE FUNCTION public.post_stock_transfer_dispatch(p_transfer_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_uid UUID;
    v_transfer RECORD;
    v_line RECORD;
    v_batch RECORD;
BEGIN
    v_caller_uid := auth.uid();
    IF v_caller_uid IS NULL THEN
        RAISE EXCEPTION 'Unauthorized.';
    END IF;

    SELECT * INTO v_transfer
    FROM public.stock_transfers
    WHERE id = p_transfer_id
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Transfer not found.'; END IF;
    IF v_transfer.status NOT IN ('SUBMITTED', 'APPROVED') THEN
        RAISE EXCEPTION 'Transfer must be SUBMITTED or APPROVED before dispatch.';
    END IF;

    FOR v_line IN
        SELECT * FROM public.stock_transfer_lines WHERE transfer_id = p_transfer_id FOR UPDATE
    LOOP
        -- Lock and deduct from source batch
        SELECT * INTO v_batch
        FROM public.inventory_batches
        WHERE id = v_line.batch_id
        FOR UPDATE;

        IF (v_batch.current_qty - v_batch.reserved_qty) < v_line.requested_qty THEN
            RAISE EXCEPTION 'Insufficient stock in batch % for transfer dispatch.', v_batch.batch_number;
        END IF;

        UPDATE public.inventory_batches
        SET current_qty = current_qty - v_line.requested_qty,
            updated_at = NOW()
        WHERE id = v_line.batch_id;

        -- Record immutable stock movement
        INSERT INTO public.stock_movements (
            company_id, branch_id, warehouse_id, item_id, batch_id,
            movement_type, quantity, base_unit_id, unit_cost_paisa,
            reference_type, reference_id, reason, created_by
        ) VALUES (
            v_transfer.company_id, v_transfer.source_branch_id, v_transfer.source_warehouse_id,
            v_line.item_id, v_line.batch_id, 'STOCK_TRANSFER_OUT',
            -v_line.requested_qty, v_line.unit_id, v_batch.unit_cost_paisa,
            'STOCK_TRANSFER', v_transfer.id, 'Inter-warehouse transfer dispatch', v_caller_uid
        );

        UPDATE public.stock_transfer_lines
        SET dispatched_qty = requested_qty, updated_at = NOW()
        WHERE id = v_line.id;
    END LOOP;

    UPDATE public.stock_transfers
    SET status = 'IN_TRANSIT', dispatched_by = v_caller_uid, dispatched_at = NOW(), updated_at = NOW()
    WHERE id = p_transfer_id;
END;
$$;

-- Function 8.5: Confirm Stock Transfer Receipt (Destination Addition)
CREATE OR REPLACE FUNCTION public.post_stock_transfer_receipt(p_transfer_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_uid UUID;
    v_transfer RECORD;
    v_line RECORD;
    v_source_batch RECORD;
    v_dest_batch_id UUID;
BEGIN
    v_caller_uid := auth.uid();
    IF v_caller_uid IS NULL THEN RAISE EXCEPTION 'Unauthorized.'; END IF;

    SELECT * INTO v_transfer
    FROM public.stock_transfers
    WHERE id = p_transfer_id
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Transfer not found.'; END IF;
    IF v_transfer.status <> 'IN_TRANSIT' THEN
        RAISE EXCEPTION 'Only IN_TRANSIT transfers can be received.';
    END IF;

    FOR v_line IN
        SELECT * FROM public.stock_transfer_lines WHERE transfer_id = p_transfer_id FOR UPDATE
    LOOP
        SELECT * INTO v_source_batch FROM public.inventory_batches WHERE id = v_line.batch_id;

        -- Find or create destination warehouse batch preserving original batch number & metadata
        SELECT id INTO v_dest_batch_id
        FROM public.inventory_batches
        WHERE company_id = v_transfer.company_id
          AND warehouse_id = v_transfer.destination_warehouse_id
          AND batch_number = v_source_batch.batch_number;

        IF v_dest_batch_id IS NULL THEN
            INSERT INTO public.inventory_batches (
                company_id, branch_id, warehouse_id, item_id, batch_number,
                batch_type, batch_status, supplier_id, supplier_batch_number,
                received_date, manufacturing_date, expiry_date,
                initial_qty, current_qty, reserved_qty, base_unit_id,
                unit_cost_paisa, qc_status, is_active
            ) VALUES (
                v_transfer.company_id, v_transfer.destination_branch_id, v_transfer.destination_warehouse_id,
                v_line.item_id, v_source_batch.batch_number,
                v_source_batch.batch_type, 'ACTIVE', v_source_batch.supplier_id, v_source_batch.supplier_batch_number,
                CURRENT_DATE, v_source_batch.manufacturing_date, v_source_batch.expiry_date,
                v_line.dispatched_qty, v_line.dispatched_qty, 0, v_line.unit_id,
                v_source_batch.unit_cost_paisa, 'RELEASED', TRUE
            ) RETURNING id INTO v_dest_batch_id;
        ELSE
            UPDATE public.inventory_batches
            SET current_qty = current_qty + v_line.dispatched_qty, updated_at = NOW()
            WHERE id = v_dest_batch_id;
        END IF;

        -- Record immutable stock receipt movement
        INSERT INTO public.stock_movements (
            company_id, branch_id, warehouse_id, item_id, batch_id,
            movement_type, quantity, base_unit_id, unit_cost_paisa,
            reference_type, reference_id, reason, created_by
        ) VALUES (
            v_transfer.company_id, v_transfer.destination_branch_id, v_transfer.destination_warehouse_id,
            v_line.item_id, v_dest_batch_id, 'STOCK_TRANSFER_IN',
            v_line.dispatched_qty, v_line.unit_id, v_source_batch.unit_cost_paisa,
            'STOCK_TRANSFER', v_transfer.id, 'Inter-warehouse transfer receipt', v_caller_uid
        );

        UPDATE public.stock_transfer_lines
        SET received_qty = dispatched_qty, updated_at = NOW()
        WHERE id = v_line.id;
    END LOOP;

    UPDATE public.stock_transfers
    SET status = 'RECEIVED', received_by = v_caller_uid, received_at = NOW(), updated_at = NOW()
    WHERE id = p_transfer_id;
END;
$$;

-- Function 8.6: Post Stock Adjustment (Gains or Losses)
CREATE OR REPLACE FUNCTION public.post_stock_adjustment(p_adjustment_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_uid UUID;
    v_adj RECORD;
    v_line RECORD;
    v_batch RECORD;
    v_mvt_type public.stock_movement_type;
BEGIN
    v_caller_uid := auth.uid();
    IF v_caller_uid IS NULL THEN RAISE EXCEPTION 'Unauthorized.'; END IF;

    SELECT * INTO v_adj
    FROM public.stock_adjustments
    WHERE id = p_adjustment_id
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Adjustment not found.'; END IF;
    IF v_adj.status <> 'APPROVED' THEN
        RAISE EXCEPTION 'Adjustment must be APPROVED by an authorized manager before posting.';
    END IF;

    FOR v_line IN
        SELECT * FROM public.stock_adjustment_lines WHERE adjustment_id = p_adjustment_id FOR UPDATE
    LOOP
        SELECT * INTO v_batch FROM public.inventory_batches WHERE id = v_line.batch_id FOR UPDATE;

        IF v_line.difference_qty > 0 THEN
            v_mvt_type := 'STOCK_ADJUSTMENT_IN';
        ELSE
            v_mvt_type := 'STOCK_ADJUSTMENT_OUT';
            IF (v_batch.current_qty + v_line.difference_qty) < 0 THEN
                RAISE EXCEPTION 'Adjustment would result in negative batch quantity.';
            END IF;
        END IF;

        UPDATE public.inventory_batches
        SET current_qty = current_qty + v_line.difference_qty, updated_at = NOW()
        WHERE id = v_line.batch_id;

        INSERT INTO public.stock_movements (
            company_id, branch_id, warehouse_id, item_id, batch_id,
            movement_type, quantity, base_unit_id, unit_cost_paisa,
            reference_type, reference_id, reason, created_by
        ) VALUES (
            v_adj.company_id, v_adj.branch_id, v_adj.warehouse_id,
            v_line.item_id, v_line.batch_id, v_mvt_type,
            v_line.difference_qty, v_line.unit_id, v_batch.unit_cost_paisa,
            'STOCK_ADJUSTMENT', v_adj.id, COALESCE(v_line.reason, v_adj.reason), v_caller_uid
        );
    END LOOP;

    UPDATE public.stock_adjustments
    SET status = 'APPROVED', updated_at = NOW()
    WHERE id = p_adjustment_id;
END;
$$;

-- Function 8.7: Update Batch QC & Operational Status
CREATE OR REPLACE FUNCTION public.update_batch_status_and_qc(
    p_batch_id UUID,
    p_batch_status public.batch_status,
    p_qc_status public.qc_status,
    p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_uid UUID;
BEGIN
    v_caller_uid := auth.uid();
    IF v_caller_uid IS NULL THEN RAISE EXCEPTION 'Unauthorized.'; END IF;

    UPDATE public.inventory_batches
    SET batch_status = p_batch_status,
        qc_status = p_qc_status,
        blocked_reason = CASE WHEN p_batch_status = 'BLOCKED' THEN p_reason ELSE blocked_reason END,
        blocked_by = CASE WHEN p_batch_status = 'BLOCKED' THEN v_caller_uid ELSE blocked_by END,
        blocked_at = CASE WHEN p_batch_status = 'BLOCKED' THEN NOW() ELSE blocked_at END,
        qc_released_by = CASE WHEN p_qc_status = 'RELEASED' THEN v_caller_uid ELSE qc_released_by END,
        qc_released_at = CASE WHEN p_qc_status = 'RELEASED' THEN NOW() ELSE qc_released_at END,
        updated_at = NOW()
    WHERE id = p_batch_id;
END;
$$;

-- ============================================================================
-- 9. ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.stock_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfer_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_adjustment_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_valuation_ledger ENABLE ROW LEVEL SECURITY;

-- 9.1 Stock Reservations
CREATE POLICY "Users can view reservations for their company and branch"
    ON public.stock_reservations FOR SELECT
    USING (company_id = public.current_company_id() AND public.has_branch_access(branch_id));

CREATE POLICY "Authorized users can manage reservations"
    ON public.stock_reservations FOR ALL
    USING (company_id = public.current_company_id() AND public.has_branch_access(branch_id))
    WITH CHECK (company_id = public.current_company_id() AND public.has_branch_access(branch_id));

-- 9.2 Stock Transfers
CREATE POLICY "Users can view transfers for accessible branches"
    ON public.stock_transfers FOR SELECT
    USING (
        company_id = public.current_company_id() AND
        (public.has_branch_access(source_branch_id) OR public.has_branch_access(destination_branch_id))
    );

CREATE POLICY "Authorized users can insert/update transfers"
    ON public.stock_transfers FOR ALL
    USING (company_id = public.current_company_id() AND public.has_branch_access(source_branch_id))
    WITH CHECK (company_id = public.current_company_id() AND public.has_branch_access(source_branch_id));

-- 9.3 Stock Transfer Lines
CREATE POLICY "Users can view transfer lines"
    ON public.stock_transfer_lines FOR SELECT
    USING (company_id = public.current_company_id());

CREATE POLICY "Authorized users can manage transfer lines"
    ON public.stock_transfer_lines FOR ALL
    USING (company_id = public.current_company_id())
    WITH CHECK (company_id = public.current_company_id());

-- 9.4 Stock Adjustments
CREATE POLICY "Users can view adjustments for accessible branch"
    ON public.stock_adjustments FOR SELECT
    USING (company_id = public.current_company_id() AND public.has_branch_access(branch_id));

CREATE POLICY "Authorized users can manage adjustments"
    ON public.stock_adjustments FOR ALL
    USING (company_id = public.current_company_id() AND public.has_branch_access(branch_id))
    WITH CHECK (company_id = public.current_company_id() AND public.has_branch_access(branch_id));

-- 9.5 Stock Adjustment Lines
CREATE POLICY "Users can view adjustment lines"
    ON public.stock_adjustment_lines FOR SELECT
    USING (company_id = public.current_company_id());

CREATE POLICY "Authorized users can manage adjustment lines"
    ON public.stock_adjustment_lines FOR ALL
    USING (company_id = public.current_company_id())
    WITH CHECK (company_id = public.current_company_id());

-- 9.6 Item Valuation Ledger
CREATE POLICY "Users can view valuation ledger in their company"
    ON public.item_valuation_ledger FOR SELECT
    USING (company_id = public.current_company_id());

-- ============================================================================
-- 10. ROLE PERMISSIONS SEEDING
-- ============================================================================

INSERT INTO public.role_permissions (role, permission) VALUES
    ('OWNER', 'inventory.view'),
    ('OWNER', 'inventory.manage'),
    ('OWNER', 'inventory.transfer'),
    ('OWNER', 'inventory.adjust'),
    ('OWNER', 'inventory.qc'),
    ('ADMIN', 'inventory.view'),
    ('ADMIN', 'inventory.manage'),
    ('ADMIN', 'inventory.transfer'),
    ('ADMIN', 'inventory.adjust'),
    ('ADMIN', 'inventory.qc'),
    ('SUPERVISOR', 'inventory.view'),
    ('SUPERVISOR', 'inventory.transfer'),
    ('SUPERVISOR', 'inventory.adjust'),
    ('WAREHOUSE', 'inventory.view'),
    ('WAREHOUSE', 'inventory.transfer'),
    ('PRODUCTION', 'inventory.view'),
    ('PRODUCTION', 'inventory.qc'),
    ('ACCOUNTANT', 'inventory.view'),
    ('ACCOUNTANT', 'inventory.valuation')
ON CONFLICT (role, permission) DO NOTHING;
