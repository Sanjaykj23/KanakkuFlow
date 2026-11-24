-- ============================================================================
-- KanakkuFlow ERP - Phase 5: Production & Manufacturing Costing Migration
-- File: supabase/migrations/20261124000003_phase5_production_costing.sql
-- Description: Bill of Materials (BOM), Production Orders, Material Reservations,
--              Two-Stage Manufacturing (Bulk WIP & Packaging), QC Inspection,
--              Perpetual Manufacturing Costing, and Append-Only Stock Movements.
-- ============================================================================

-- 1. ENUMS
DO $$ BEGIN
    CREATE TYPE public.bom_type AS ENUM (
        'BULK_WIP', 'PACKAGING', 'FINISHED_GOODS'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.bom_status AS ENUM (
        'DRAFT', 'ACTIVE', 'INACTIVE', 'OBSOLETE'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.bom_component_type AS ENUM (
        'RAW_MATERIAL', 'PACKAGING', 'BULK_WIP'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.production_stage AS ENUM (
        'BULK_PRODUCTION', 'PACKAGING_PRODUCTION'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.production_order_status AS ENUM (
        'DRAFT', 'SUBMITTED', 'APPROVED', 'MATERIAL_RESERVED', 'IN_PROGRESS', 'PARTIALLY_COMPLETED', 'COMPLETED', 'REJECTED', 'CANCELLED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================================
-- 2. BILL OF MATERIALS (BOM) & BOM LINES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bill_of_materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    bom_number VARCHAR(50) NOT NULL,
    product_id UUID NOT NULL,
    bom_type public.bom_type NOT NULL,
    version VARCHAR(20) NOT NULL DEFAULT 'v1.0',
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status public.bom_status NOT NULL DEFAULT 'ACTIVE',
    expected_output_qty NUMERIC(14, 4) NOT NULL CHECK (expected_output_qty > 0),
    output_unit_id UUID NOT NULL,
    expected_yield_percent NUMERIC(5, 2) NOT NULL DEFAULT 100.00 CHECK (expected_yield_percent > 0),
    expected_wastage_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (expected_wastage_percent >= 0),
    labor_overhead_cost_paisa BIGINT NOT NULL DEFAULT 0 CHECK (labor_overhead_cost_paisa >= 0),
    notes TEXT NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    approved_by UUID NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_bom_company_number UNIQUE (company_id, bom_number),
    CONSTRAINT uq_bom_company_id_id UNIQUE (company_id, id),
    CONSTRAINT uq_bom_product_version UNIQUE (company_id, product_id, version),
    CONSTRAINT fk_bom_product FOREIGN KEY (company_id, product_id) REFERENCES public.items(company_id, id),
    CONSTRAINT fk_bom_unit FOREIGN KEY (company_id, output_unit_id) REFERENCES public.units(company_id, id)
);

CREATE TABLE IF NOT EXISTS public.bom_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    bom_id UUID NOT NULL,
    line_number INT NOT NULL,
    component_item_id UUID NOT NULL,
    component_type public.bom_component_type NOT NULL,
    quantity NUMERIC(14, 4) NOT NULL CHECK (quantity > 0),
    unit_id UUID NOT NULL,
    conversion_rate NUMERIC(15, 6) NOT NULL DEFAULT 1.0 CHECK (conversion_rate > 0),
    base_unit_qty NUMERIC(14, 4) NOT NULL CHECK (base_unit_qty > 0),
    expected_wastage_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (expected_wastage_percent >= 0),
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_bom_line_number UNIQUE (company_id, bom_id, line_number),
    CONSTRAINT uq_bom_line_component UNIQUE (company_id, bom_id, component_item_id),
    CONSTRAINT fk_bom_line_parent FOREIGN KEY (company_id, bom_id) REFERENCES public.bill_of_materials(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_bom_line_item FOREIGN KEY (company_id, component_item_id) REFERENCES public.items(company_id, id),
    CONSTRAINT fk_bom_line_unit FOREIGN KEY (company_id, unit_id) REFERENCES public.units(company_id, id)
);

-- ============================================================================
-- 3. PRODUCTION ORDERS & WORK ORDERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.production_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    order_number VARCHAR(50) NOT NULL,
    bom_id UUID NOT NULL,
    product_id UUID NOT NULL,
    order_type public.production_stage NOT NULL,
    planned_qty NUMERIC(14, 4) NOT NULL CHECK (planned_qty > 0),
    produced_qty NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (produced_qty >= 0),
    unit_id UUID NOT NULL,
    production_warehouse_id UUID NOT NULL,
    finished_warehouse_id UUID NOT NULL,
    planned_start_date DATE NOT NULL,
    planned_completion_date DATE NOT NULL,
    actual_start_date TIMESTAMPTZ NULL,
    actual_completion_date TIMESTAMPTZ NULL,
    status public.production_order_status NOT NULL DEFAULT 'DRAFT',
    source_bulk_batch_id UUID NULL,
    total_material_cost_paisa BIGINT NOT NULL DEFAULT 0 CHECK (total_material_cost_paisa >= 0),
    additional_costs_paisa BIGINT NOT NULL DEFAULT 0 CHECK (additional_costs_paisa >= 0),
    total_production_cost_paisa BIGINT NOT NULL DEFAULT 0 CHECK (total_production_cost_paisa >= 0),
    unit_cost_paisa BIGINT NOT NULL DEFAULT 0 CHECK (unit_cost_paisa >= 0),
    rejection_reason TEXT NULL,
    cancellation_reason TEXT NULL,
    notes TEXT NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    approved_by UUID NULL REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_po_order_number UNIQUE (company_id, order_number),
    CONSTRAINT uq_po_company_id_id UNIQUE (company_id, id),
    CONSTRAINT fk_po_bom FOREIGN KEY (company_id, bom_id) REFERENCES public.bill_of_materials(company_id, id),
    CONSTRAINT fk_po_product FOREIGN KEY (company_id, product_id) REFERENCES public.items(company_id, id),
    CONSTRAINT fk_po_unit FOREIGN KEY (company_id, unit_id) REFERENCES public.units(company_id, id),
    CONSTRAINT fk_po_src_wh FOREIGN KEY (company_id, production_warehouse_id) REFERENCES public.warehouses(company_id, id),
    CONSTRAINT fk_po_dst_wh FOREIGN KEY (company_id, finished_warehouse_id) REFERENCES public.warehouses(company_id, id),
    CONSTRAINT fk_po_bulk_batch FOREIGN KEY (company_id, source_bulk_batch_id) REFERENCES public.inventory_batches(company_id, id)
);

-- ============================================================================
-- 4. PRODUCTION MATERIAL CONSUMPTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.production_consumptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    production_order_id UUID NOT NULL,
    item_id UUID NOT NULL,
    batch_id UUID NOT NULL,
    warehouse_id UUID NOT NULL,
    consumed_qty NUMERIC(14, 4) NOT NULL CHECK (consumed_qty > 0),
    wastage_qty NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (wastage_qty >= 0),
    unit_id UUID NOT NULL,
    unit_cost_paisa BIGINT NOT NULL CHECK (unit_cost_paisa >= 0),
    total_cost_paisa BIGINT NOT NULL CHECK (total_cost_paisa >= 0),
    reason TEXT NULL,
    recorded_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_pc_order FOREIGN KEY (company_id, production_order_id) REFERENCES public.production_orders(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_pc_item FOREIGN KEY (company_id, item_id) REFERENCES public.items(company_id, id),
    CONSTRAINT fk_pc_batch FOREIGN KEY (company_id, batch_id) REFERENCES public.inventory_batches(company_id, id),
    CONSTRAINT fk_pc_wh FOREIGN KEY (company_id, warehouse_id) REFERENCES public.warehouses(company_id, id),
    CONSTRAINT fk_pc_unit FOREIGN KEY (company_id, unit_id) REFERENCES public.units(company_id, id)
);

-- ============================================================================
-- 5. PRODUCTION OUTPUTS & QUALITY INSPECTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.production_outputs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    production_order_id UUID NOT NULL,
    item_id UUID NOT NULL,
    output_batch_id UUID NOT NULL,
    warehouse_id UUID NOT NULL,
    produced_qty NUMERIC(14, 4) NOT NULL CHECK (produced_qty > 0),
    rejected_qty NUMERIC(14, 4) NOT NULL DEFAULT 0 CHECK (rejected_qty >= 0),
    unit_id UUID NOT NULL,
    unit_cost_paisa BIGINT NOT NULL CHECK (unit_cost_paisa >= 0),
    total_cost_paisa BIGINT NOT NULL CHECK (total_cost_paisa >= 0),
    qc_status public.qc_status NOT NULL DEFAULT 'PENDING',
    qc_notes TEXT NULL,
    qc_inspected_by UUID NULL REFERENCES auth.users(id),
    qc_inspected_at TIMESTAMPTZ NULL,
    produced_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_pout_order FOREIGN KEY (company_id, production_order_id) REFERENCES public.production_orders(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_pout_item FOREIGN KEY (company_id, item_id) REFERENCES public.items(company_id, id),
    CONSTRAINT fk_pout_batch FOREIGN KEY (company_id, output_batch_id) REFERENCES public.inventory_batches(company_id, id),
    CONSTRAINT fk_pout_wh FOREIGN KEY (company_id, warehouse_id) REFERENCES public.warehouses(company_id, id),
    CONSTRAINT fk_pout_unit FOREIGN KEY (company_id, unit_id) REFERENCES public.units(company_id, id)
);

-- ============================================================================
-- 6. INDEXES FOR PERFORMANCE & TRACEABILITY
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_bom_company_prod ON public.bill_of_materials (company_id, product_id, status);
CREATE INDEX IF NOT EXISTS idx_prod_orders_status ON public.production_orders (company_id, branch_id, status);
CREATE INDEX IF NOT EXISTS idx_consumptions_order ON public.production_consumptions (company_id, production_order_id);
CREATE INDEX IF NOT EXISTS idx_outputs_order ON public.production_outputs (company_id, production_order_id);

-- ============================================================================
-- 7. TRANSACTIONAL RPCS (SECURITY DEFINER)
-- ============================================================================

-- RPC 7.1: Reserve Production Materials using FEFO
CREATE OR REPLACE FUNCTION public.reserve_production_materials(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order RECORD;
    v_bom RECORD;
    v_line RECORD;
    v_needed_qty NUMERIC(14, 4);
    v_alloc RECORD;
    v_res_id UUID;
BEGIN
    SELECT * INTO v_order FROM public.production_orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Production order not found.'; END IF;
    IF v_order.status NOT IN ('SUBMITTED', 'APPROVED') THEN
        RAISE EXCEPTION 'Order must be SUBMITTED or APPROVED before reserving materials.';
    END IF;

    SELECT * INTO v_bom FROM public.bill_of_materials WHERE id = v_order.bom_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'BOM not found.'; END IF;

    FOR v_line IN
        SELECT * FROM public.bom_lines WHERE bom_id = v_order.bom_id ORDER BY line_number ASC
    LOOP
        -- Calculate proportional required quantity including wastage
        v_needed_qty := (v_order.planned_qty / v_bom.expected_output_qty) * v_line.quantity * (1 + (v_line.expected_wastage_percent / 100));

        -- Allocate FEFO batches
        FOR v_alloc IN
            SELECT * FROM public.allocate_fefo_stock(
                v_order.company_id, v_order.production_warehouse_id, v_line.component_item_id, v_needed_qty
            )
        LOOP
            v_res_id := public.create_stock_reservation(
                v_order.company_id, v_order.branch_id, v_order.production_warehouse_id,
                v_line.component_item_id, v_alloc.batch_id, v_alloc.allocated_qty,
                v_line.unit_id, 'PRODUCTION_ORDER', v_order.id, 'Reserved for ' || v_order.order_number
            );
        END LOOP;
    END LOOP;

    UPDATE public.production_orders
    SET status = 'MATERIAL_RESERVED', updated_at = NOW()
    WHERE id = p_order_id;
END;
$$;

-- RPC 7.2: Record Material Consumption
CREATE OR REPLACE FUNCTION public.record_production_consumption(
    p_order_id UUID,
    p_item_id UUID,
    p_batch_id UUID,
    p_warehouse_id UUID,
    p_consumed_qty NUMERIC(14, 4),
    p_wastage_qty NUMERIC(14, 4),
    p_unit_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_uid UUID;
    v_order RECORD;
    v_batch RECORD;
    v_total_cost BIGINT;
    v_consumption_id UUID;
BEGIN
    v_caller_uid := auth.uid();
    IF v_caller_uid IS NULL THEN RAISE EXCEPTION 'Unauthorized.'; END IF;

    SELECT * INTO v_order FROM public.production_orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Order not found.'; END IF;

    SELECT * INTO v_batch FROM public.inventory_batches WHERE id = p_batch_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Batch not found.'; END IF;

    IF v_batch.current_qty < p_consumed_qty THEN
        RAISE EXCEPTION 'Cannot consume: Requested % exceeds batch on-hand %.', p_consumed_qty, v_batch.current_qty;
    END IF;

    v_total_cost := Math.round(p_consumed_qty * v_batch.unit_cost_paisa);

    -- Deduct from batch current_qty & reserved_qty
    UPDATE public.inventory_batches
    SET current_qty = current_qty - p_consumed_qty,
        reserved_qty = GREATEST(0, reserved_qty - p_consumed_qty),
        updated_at = NOW()
    WHERE id = p_batch_id;

    -- Record immutable stock movement
    INSERT INTO public.stock_movements (
        company_id, branch_id, warehouse_id, item_id, batch_id,
        movement_type, quantity, base_unit_id, unit_cost_paisa,
        reference_type, reference_id, reason, created_by
    ) VALUES (
        v_order.company_id, v_order.branch_id, p_warehouse_id,
        p_item_id, p_batch_id, 'PRODUCTION_CONSUMPTION',
        -p_consumed_qty, p_unit_id, v_batch.unit_cost_paisa,
        'PRODUCTION_ORDER', v_order.id, p_reason, v_caller_uid
    );

    -- Insert consumption record
    INSERT INTO public.production_consumptions (
        company_id, production_order_id, item_id, batch_id, warehouse_id,
        consumed_qty, wastage_qty, unit_id, unit_cost_paisa, total_cost_paisa,
        reason, recorded_by
    ) VALUES (
        v_order.company_id, v_order.id, p_item_id, p_batch_id, p_warehouse_id,
        p_consumed_qty, p_wastage_qty, p_unit_id, v_batch.unit_cost_paisa, v_total_cost,
        p_reason, v_caller_uid
    ) RETURNING id INTO v_consumption_id;

    -- Update order material costs & status
    UPDATE public.production_orders
    SET total_material_cost_paisa = total_material_cost_paisa + v_total_cost,
        total_production_cost_paisa = total_material_cost_paisa + v_total_cost + additional_costs_paisa,
        status = CASE WHEN status = 'MATERIAL_RESERVED' THEN 'IN_PROGRESS' ELSE status END,
        actual_start_date = COALESCE(actual_start_date, NOW()),
        updated_at = NOW()
    WHERE id = p_order_id;

    RETURN v_consumption_id;
END;
$$;

-- RPC 7.3: Post Production Output
CREATE OR REPLACE FUNCTION public.post_production_output(
    p_order_id UUID,
    p_produced_qty NUMERIC(14, 4),
    p_rejected_qty NUMERIC(14, 4),
    p_manufacturing_date DATE,
    p_expiry_date DATE,
    p_additional_costs_paisa BIGINT DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_uid UUID;
    v_order RECORD;
    v_batch_num VARCHAR(50);
    v_batch_type public.batch_type;
    v_new_batch_id UUID;
    v_total_cost_paisa BIGINT;
    v_unit_cost_paisa BIGINT;
    v_output_id UUID;
BEGIN
    v_caller_uid := auth.uid();
    IF v_caller_uid IS NULL THEN RAISE EXCEPTION 'Unauthorized.'; END IF;

    SELECT * INTO v_order FROM public.production_orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Order not found.'; END IF;

    v_total_cost_paisa := v_order.total_material_cost_paisa + p_additional_costs_paisa;
    v_unit_cost_paisa := CASE WHEN p_produced_qty > 0 THEN v_total_cost_paisa / p_produced_qty ELSE 0 END;

    v_batch_type := CASE WHEN v_order.order_type = 'BULK_PRODUCTION' THEN 'BULK_WIP'::public.batch_type ELSE 'FINISHED_GOODS'::public.batch_type END;

    -- Concurrency-safe batch code
    SELECT code INTO v_batch_num FROM public.get_next_company_code(v_order.company_id, 'BATCH', 'BAT', 5);
    IF v_batch_num IS NULL THEN
        v_batch_num := 'BAT-' || TO_CHAR(NOW(), 'YYMM') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    END IF;

    -- Create physical output batch in QC_PENDING status
    INSERT INTO public.inventory_batches (
        company_id, branch_id, warehouse_id, item_id, batch_number,
        batch_type, batch_status, received_date, manufacturing_date, expiry_date,
        initial_qty, current_qty, reserved_qty, base_unit_id, unit_cost_paisa,
        qc_status, is_active
    ) VALUES (
        v_order.company_id, v_order.branch_id, v_order.finished_warehouse_id,
        v_order.product_id, v_batch_num, v_batch_type, 'ACTIVE',
        CURRENT_DATE, p_manufacturing_date, p_expiry_date,
        p_produced_qty, p_produced_qty, 0, v_order.unit_id,
        v_unit_cost_paisa, 'PENDING', TRUE
    ) RETURNING id INTO v_new_batch_id;

    -- Record immutable stock movement
    INSERT INTO public.stock_movements (
        company_id, branch_id, warehouse_id, item_id, batch_id,
        movement_type, quantity, base_unit_id, unit_cost_paisa,
        reference_type, reference_id, reason, created_by
    ) VALUES (
        v_order.company_id, v_order.branch_id, v_order.finished_warehouse_id,
        v_order.product_id, v_new_batch_id, 'PRODUCTION_OUTPUT',
        p_produced_qty, v_order.unit_id, v_unit_cost_paisa,
        'PRODUCTION_ORDER', v_order.id, 'Output of order ' || v_order.order_number, v_caller_uid
    );

    -- Insert output record
    INSERT INTO public.production_outputs (
        company_id, production_order_id, item_id, output_batch_id, warehouse_id,
        produced_qty, rejected_qty, unit_id, unit_cost_paisa, total_cost_paisa,
        qc_status, produced_by
    ) VALUES (
        v_order.company_id, v_order.id, v_order.product_id, v_new_batch_id,
        v_order.finished_warehouse_id, p_produced_qty, p_rejected_qty,
        v_order.unit_id, v_unit_cost_paisa, v_total_cost_paisa, 'PENDING', v_caller_uid
    ) RETURNING id INTO v_output_id;

    -- Update work order
    UPDATE public.production_orders
    SET produced_qty = produced_qty + p_produced_qty,
        additional_costs_paisa = additional_costs_paisa + p_additional_costs_paisa,
        total_production_cost_paisa = v_total_cost_paisa,
        unit_cost_paisa = v_unit_cost_paisa,
        status = CASE WHEN (produced_qty + p_produced_qty) >= planned_qty THEN 'COMPLETED' ELSE 'PARTIALLY_COMPLETED' END,
        actual_completion_date = CASE WHEN (produced_qty + p_produced_qty) >= planned_qty THEN NOW() ELSE actual_completion_date END,
        updated_at = NOW()
    WHERE id = p_order_id;

    RETURN v_output_id;
END;
$$;

-- RPC 7.4: Release Production QC Inspection
CREATE OR REPLACE FUNCTION public.release_production_qc(
    p_output_id UUID,
    p_status public.qc_status,
    p_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_uid UUID;
    v_out RECORD;
    v_val RECORD;
    v_new_total_qty NUMERIC(14, 4);
    v_new_val_paisa BIGINT;
    v_new_avg_cost BIGINT;
BEGIN
    v_caller_uid := auth.uid();
    IF v_caller_uid IS NULL THEN RAISE EXCEPTION 'Unauthorized.'; END IF;

    SELECT * INTO v_out FROM public.production_outputs WHERE id = p_output_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Output not found.'; END IF;

    UPDATE public.production_outputs
    SET qc_status = p_status, qc_notes = p_notes, qc_inspected_by = v_caller_uid, qc_inspected_at = NOW()
    WHERE id = p_output_id;

    UPDATE public.inventory_batches
    SET qc_status = p_status,
        qc_released_by = CASE WHEN p_status = 'RELEASED' THEN v_caller_uid ELSE qc_released_by END,
        qc_released_at = CASE WHEN p_status = 'RELEASED' THEN NOW() ELSE qc_released_at END,
        updated_at = NOW()
    WHERE id = v_out.output_batch_id;

    -- Update moving weighted-average cost when goods are released
    IF p_status = 'RELEASED' THEN
        SELECT * INTO v_val FROM public.item_valuation_ledger WHERE company_id = v_out.company_id AND item_id = v_out.item_id FOR UPDATE;

        IF FOUND THEN
            v_new_total_qty := v_val.total_on_hand_qty + v_out.produced_qty;
            v_new_val_paisa := v_val.total_valuation_paisa + v_out.total_cost_paisa;
            v_new_avg_cost := CASE WHEN v_new_total_qty > 0 THEN v_new_val_paisa / v_new_total_qty ELSE v_val.weighted_avg_cost_paisa END;

            UPDATE public.item_valuation_ledger
            SET total_on_hand_qty = v_new_total_qty,
                weighted_avg_cost_paisa = v_new_avg_cost,
                total_valuation_paisa = v_new_val_paisa,
                updated_at = NOW()
            WHERE id = v_val.id;
        ELSE
            INSERT INTO public.item_valuation_ledger (
                company_id, item_id, total_on_hand_qty, weighted_avg_cost_paisa, total_valuation_paisa
            ) VALUES (
                v_out.company_id, v_out.item_id, v_out.produced_qty, v_out.unit_cost_paisa, v_out.total_cost_paisa
            );
        END IF;
    END IF;
END;
$$;

-- ============================================================================
-- 8. ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.bill_of_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_consumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_outputs ENABLE ROW LEVEL SECURITY;

-- 8.1 Bill of Materials
CREATE POLICY "Users can view BOMs in their company"
    ON public.bill_of_materials FOR SELECT
    USING (company_id = public.current_company_id());

CREATE POLICY "Authorized production managers can manage BOMs"
    ON public.bill_of_materials FOR ALL
    USING (company_id = public.current_company_id())
    WITH CHECK (company_id = public.current_company_id());

-- 8.2 BOM Lines
CREATE POLICY "Users can view BOM lines in their company"
    ON public.bom_lines FOR SELECT
    USING (company_id = public.current_company_id());

CREATE POLICY "Authorized production managers can manage BOM lines"
    ON public.bom_lines FOR ALL
    USING (company_id = public.current_company_id())
    WITH CHECK (company_id = public.current_company_id());

-- 8.3 Production Orders
CREATE POLICY "Users can view production orders in accessible branches"
    ON public.production_orders FOR SELECT
    USING (company_id = public.current_company_id() AND public.has_branch_access(branch_id));

CREATE POLICY "Authorized users can manage production orders"
    ON public.production_orders FOR ALL
    USING (company_id = public.current_company_id() AND public.has_branch_access(branch_id))
    WITH CHECK (company_id = public.current_company_id() AND public.has_branch_access(branch_id));

-- 8.4 Production Consumptions
CREATE POLICY "Users can view consumptions in their company"
    ON public.production_consumptions FOR SELECT
    USING (company_id = public.current_company_id());

CREATE POLICY "Authorized production workers can record consumptions"
    ON public.production_consumptions FOR ALL
    USING (company_id = public.current_company_id())
    WITH CHECK (company_id = public.current_company_id());

-- 8.5 Production Outputs
CREATE POLICY "Users can view outputs in their company"
    ON public.production_outputs FOR SELECT
    USING (company_id = public.current_company_id());

CREATE POLICY "Authorized production workers can record outputs"
    ON public.production_outputs FOR ALL
    USING (company_id = public.current_company_id())
    WITH CHECK (company_id = public.current_company_id());

-- ============================================================================
-- 9. ROLE PERMISSIONS SEEDING
-- ============================================================================

INSERT INTO public.role_permissions (role, permission) VALUES
    ('OWNER', 'production.view'),
    ('OWNER', 'production.manage'),
    ('OWNER', 'production.bom'),
    ('OWNER', 'production.qc'),
    ('OWNER', 'production.costing'),
    ('ADMIN', 'production.view'),
    ('ADMIN', 'production.manage'),
    ('ADMIN', 'production.bom'),
    ('ADMIN', 'production.qc'),
    ('ADMIN', 'production.costing'),
    ('SUPERVISOR', 'production.view'),
    ('SUPERVISOR', 'production.manage'),
    ('SUPERVISOR', 'production.qc'),
    ('PRODUCTION', 'production.view'),
    ('PRODUCTION', 'production.manage'),
    ('PRODUCTION', 'production.bom'),
    ('PRODUCTION', 'production.qc'),
    ('ACCOUNTANT', 'production.view'),
    ('ACCOUNTANT', 'production.costing')
ON CONFLICT (role, permission) DO NOTHING;
