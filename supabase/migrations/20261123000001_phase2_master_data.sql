-- ============================================================================
-- KanakkuFlow ERP - Phase 2: Master Data & Field Sales Registration Migration
-- File: supabase/migrations/20261123000001_phase2_master_data.sql
-- Description: Customer Registrations, Customers, Customer Addresses,
--              Units, Unit Conversions, HSN Codes, GST Tax Rates,
--              Items, Suppliers, Warehouses, and Hardened Non-Recursive RLS.
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ============================================================================
-- 2. ENUMS
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE public.registration_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.customer_type AS ENUM ('RETAILER', 'WHOLESALER', 'DISTRIBUTOR', 'SUPERMARKET', 'DIRECT_CONSUMER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE public.item_type AS ENUM ('RAW_MATERIAL', 'PACKAGING', 'SEMI_FINISHED', 'FINISHED_GOOD', 'TRADED_GOOD', 'CONSUMABLE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================================
-- 3. MASTER DATA TABLES
-- ============================================================================

-- 3.1 UNITS OF MEASURE
CREATE TABLE IF NOT EXISTS public.units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    is_base_unit BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_units_company_code UNIQUE (company_id, code),
    CONSTRAINT uq_units_company_id_id UNIQUE (company_id, id)
);

-- 3.2 UNIT CONVERSIONS (Cross-company composite keys)
CREATE TABLE IF NOT EXISTS public.unit_conversions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    from_unit_id UUID NOT NULL,
    to_unit_id UUID NOT NULL,
    conversion_rate NUMERIC(15, 6) NOT NULL CHECK (conversion_rate > 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_unit_conversions UNIQUE (company_id, from_unit_id, to_unit_id),
    CONSTRAINT fk_unit_conversions_from_unit FOREIGN KEY (company_id, from_unit_id) REFERENCES public.units(company_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_unit_conversions_to_unit FOREIGN KEY (company_id, to_unit_id) REFERENCES public.units(company_id, id) ON DELETE RESTRICT,
    CONSTRAINT chk_different_units CHECK (from_unit_id <> to_unit_id)
);

-- 3.3 HSN CODES
CREATE TABLE IF NOT EXISTS public.hsn_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    code VARCHAR(10) NOT NULL,
    description TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_hsn_company_code UNIQUE (company_id, code),
    CONSTRAINT uq_hsn_company_id_id UNIQUE (company_id, id)
);

-- 3.4 TAX RATES (GST Rates with date range exclusion)
CREATE TABLE IF NOT EXISTS public.tax_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    igst_rate NUMERIC(5, 2) NOT NULL CHECK (igst_rate >= 0),
    cgst_rate NUMERIC(5, 2) NOT NULL CHECK (cgst_rate >= 0),
    sgst_rate NUMERIC(5, 2) NOT NULL CHECK (sgst_rate >= 0),
    cess_rate NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (cess_rate >= 0),
    effective_from DATE NOT NULL,
    effective_to DATE NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tax_rates_company_id_id UNIQUE (company_id, id),
    CONSTRAINT chk_tax_split CHECK (igst_rate = cgst_rate + sgst_rate),
    CONSTRAINT chk_date_validity CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

-- Overlap exclusion constraint
ALTER TABLE public.tax_rates DROP CONSTRAINT IF EXISTS exc_no_overlapping_tax_rates;
ALTER TABLE public.tax_rates ADD CONSTRAINT exc_no_overlapping_tax_rates
    EXCLUDE USING gist (
        company_id WITH =,
        name WITH =,
        daterange(effective_from, COALESCE(effective_to, 'infinity'::date), '[]') WITH &&
    );

-- 3.5 ITEMS & PRODUCTS
CREATE TABLE IF NOT EXISTS public.items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    item_type public.item_type NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'GENERAL',
    primary_unit_id UUID NOT NULL,
    hsn_code_id UUID NULL,
    default_tax_rate_id UUID NULL,
    mrp NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (mrp >= 0),
    base_price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (base_price >= 0),
    reorder_level NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
    shelf_life_days INT NULL CHECK (shelf_life_days IS NULL OR shelf_life_days > 0),
    is_fefo_tracked BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_items_company_code UNIQUE (company_id, code),
    CONSTRAINT uq_items_company_id_id UNIQUE (company_id, id),
    CONSTRAINT fk_items_primary_unit FOREIGN KEY (company_id, primary_unit_id) REFERENCES public.units(company_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_items_hsn_code FOREIGN KEY (company_id, hsn_code_id) REFERENCES public.hsn_codes(company_id, id) ON DELETE SET NULL,
    CONSTRAINT fk_items_tax_rate FOREIGN KEY (company_id, default_tax_rate_id) REFERENCES public.tax_rates(company_id, id) ON DELETE SET NULL
);

-- 3.6 SUPPLIERS
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255) NULL,
    gstin VARCHAR(15) NULL,
    pan VARCHAR(10) NULL,
    contact_person VARCHAR(150) NULL,
    email VARCHAR(255) NULL,
    mobile VARCHAR(20) NOT NULL,
    address_line1 TEXT NOT NULL,
    address_line2 TEXT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    pincode VARCHAR(10) NOT NULL,
    payment_terms_days INT NOT NULL DEFAULT 30 CHECK (payment_terms_days >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_suppliers_company_code UNIQUE (company_id, code),
    CONSTRAINT uq_suppliers_company_id_id UNIQUE (company_id, id)
);

-- 3.7 WAREHOUSES (Strict branch isolation)
CREATE TABLE IF NOT EXISTS public.warehouses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_warehouses_company_code UNIQUE (company_id, code),
    CONSTRAINT uq_warehouses_company_id_id UNIQUE (company_id, id),
    CONSTRAINT fk_warehouses_branch FOREIGN KEY (company_id, branch_id) REFERENCES public.branches(company_id, id) ON DELETE CASCADE
);

-- ============================================================================
-- 4. CUSTOMER REGISTRATION & CUSTOMER MASTER
-- ============================================================================

-- 4.1 CUSTOMER REGISTRATION REQUESTS
CREATE TABLE IF NOT EXISTS public.customer_registration_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL,
    request_number VARCHAR(50) NOT NULL,
    shop_name VARCHAR(255) NOT NULL,
    owner_name VARCHAR(150) NOT NULL,
    mobile_number VARCHAR(20) NOT NULL,
    normalized_mobile VARCHAR(15) NOT NULL,
    alternate_number VARCHAR(20) NULL,
    email VARCHAR(255) NULL,
    gstin VARCHAR(15) NULL,
    pan VARCHAR(10) NULL,
    fssai_number VARCHAR(20) NULL,
    address_line1 TEXT NOT NULL,
    address_line2 TEXT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    pincode VARCHAR(10) NOT NULL,
    latitude NUMERIC(10, 7) NULL,
    longitude NUMERIC(10, 7) NULL,
    shop_photo_url TEXT NULL,
    status public.registration_status NOT NULL DEFAULT 'PENDING',
    submitted_by UUID NOT NULL REFERENCES auth.users(id),
    reviewed_by UUID NULL REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ NULL,
    rejection_reason TEXT NULL,
    duplicate_override_reason TEXT NULL,
    created_customer_id UUID NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_registration_requests_number UNIQUE (company_id, request_number),
    CONSTRAINT uq_registration_requests_company_id_id UNIQUE (company_id, id),
    CONSTRAINT fk_registration_requests_branch FOREIGN KEY (company_id, branch_id) REFERENCES public.branches(company_id, id) ON DELETE CASCADE
);

-- 4.2 CUSTOMERS MASTER
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL,
    customer_code VARCHAR(50) NOT NULL,
    shop_name VARCHAR(255) NOT NULL,
    owner_name VARCHAR(150) NOT NULL,
    mobile_number VARCHAR(20) NOT NULL,
    normalized_mobile VARCHAR(15) NOT NULL,
    alternate_number VARCHAR(20) NULL,
    email VARCHAR(255) NULL,
    gstin VARCHAR(15) NULL,
    pan VARCHAR(10) NULL,
    fssai_number VARCHAR(20) NULL,
    customer_type public.customer_type NOT NULL DEFAULT 'RETAILER',
    credit_limit NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
    payment_terms_days INT NOT NULL DEFAULT 7 CHECK (payment_terms_days >= 0),
    assigned_salesman_id UUID NULL REFERENCES auth.users(id),
    registration_request_id UUID NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_customers_company_code UNIQUE (company_id, customer_code),
    CONSTRAINT uq_customers_company_id_id UNIQUE (company_id, id),
    CONSTRAINT fk_customers_branch FOREIGN KEY (company_id, branch_id) REFERENCES public.branches(company_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_customers_registration FOREIGN KEY (company_id, registration_request_id) REFERENCES public.customer_registration_requests(company_id, id) ON DELETE RESTRICT
);

-- Foreign key linking back request to created customer
ALTER TABLE public.customer_registration_requests DROP CONSTRAINT IF EXISTS fk_registration_requests_created_customer;
ALTER TABLE public.customer_registration_requests ADD CONSTRAINT fk_registration_requests_created_customer
    FOREIGN KEY (company_id, created_customer_id) REFERENCES public.customers(company_id, id) ON DELETE SET NULL;

-- 4.3 CUSTOMER ADDRESSES
CREATE TABLE IF NOT EXISTS public.customer_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL,
    address_type VARCHAR(50) NOT NULL DEFAULT 'BILLING_AND_SHIPPING',
    address_line1 TEXT NOT NULL,
    address_line2 TEXT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    pincode VARCHAR(10) NOT NULL,
    latitude NUMERIC(10, 7) NULL,
    longitude NUMERIC(10, 7) NULL,
    is_primary BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_customer_addresses_company_id_id UNIQUE (company_id, id),
    CONSTRAINT fk_customer_addresses_customer FOREIGN KEY (company_id, customer_id) REFERENCES public.customers(company_id, id) ON DELETE CASCADE
);

-- ============================================================================
-- 5. INDEXES FOR PERFORMANCE & INTEGRITY
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_cust_reg_company_status ON public.customer_registration_requests(company_id, status);
CREATE INDEX IF NOT EXISTS idx_cust_reg_branch ON public.customer_registration_requests(company_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_cust_reg_normalized_mobile ON public.customer_registration_requests(company_id, normalized_mobile);
CREATE INDEX IF NOT EXISTS idx_cust_reg_gstin ON public.customer_registration_requests(company_id, gstin) WHERE gstin IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cust_reg_submitted_by ON public.customer_registration_requests(company_id, submitted_by);

CREATE INDEX IF NOT EXISTS idx_customers_company_branch ON public.customers(company_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_customers_normalized_mobile ON public.customers(company_id, normalized_mobile);
CREATE INDEX IF NOT EXISTS idx_customers_gstin ON public.customers(company_id, gstin) WHERE gstin IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_assigned_salesman ON public.customers(company_id, assigned_salesman_id);

CREATE INDEX IF NOT EXISTS idx_items_company_type ON public.items(company_id, item_type);
CREATE INDEX IF NOT EXISTS idx_warehouses_company_branch ON public.warehouses(company_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_company_active ON public.suppliers(company_id, is_active);

-- ============================================================================
-- 6. SECURITY TRIGGERS (PREVENT DIRECT STATUS MODIFICATIONS)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.guard_customer_registration_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Only allow changes to status, reviewed_by, reviewed_at, created_customer_id, or submitted_by
    -- when called from trusted SECURITY DEFINER functions (indicated by app.trusted_mutation session setting)
    IF current_setting('app.trusted_mutation', true) IS DISTINCT FROM 'true' THEN
        IF NEW.status IS DISTINCT FROM OLD.status THEN
            RAISE EXCEPTION 'Direct update of registration status is prohibited. Use workflow RPCs.';
        END IF;
        IF NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at THEN
            RAISE EXCEPTION 'Direct update of reviewer audit fields is prohibited.';
        END IF;
        IF NEW.submitted_by IS DISTINCT FROM OLD.submitted_by THEN
            RAISE EXCEPTION 'Changing the submission owner is prohibited.';
        END IF;
        IF NEW.created_customer_id IS DISTINCT FROM OLD.created_customer_id THEN
            RAISE EXCEPTION 'Directly linking customer records is prohibited.';
        END IF;
    END IF;

    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_customer_registration_update ON public.customer_registration_requests;
CREATE TRIGGER trg_guard_customer_registration_update
    BEFORE UPDATE ON public.customer_registration_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.guard_customer_registration_update();

-- ============================================================================
-- 7. SECURE WORKFLOW FUNCTIONS (RPCs)
-- ============================================================================

-- 7.1 DUPLICATE DETECTION RPC
CREATE OR REPLACE FUNCTION public.check_customer_duplicates(
    p_company_id UUID,
    p_mobile_number VARCHAR,
    p_gstin VARCHAR DEFAULT NULL,
    p_exclude_request_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_norm_mobile VARCHAR;
    v_clean_gstin VARCHAR;
    v_existing_customers JSONB := '[]'::jsonb;
    v_pending_requests JSONB := '[]'::jsonb;
BEGIN
    v_norm_mobile := RIGHT(REGEXP_REPLACE(p_mobile_number, '[^0-9]', '', 'g'), 10);
    v_clean_gstin := NULLIF(UPPER(TRIM(p_gstin)), '');

    -- Search existing approved customers
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'type', 'CUSTOMER',
        'id', c.id,
        'code', c.customer_code,
        'name', c.shop_name,
        'mobile', c.mobile_number,
        'gstin', c.gstin
    )), '[]'::jsonb)
    INTO v_existing_customers
    FROM public.customers c
    WHERE c.company_id = p_company_id
      AND (c.normalized_mobile = v_norm_mobile OR (v_clean_gstin IS NOT NULL AND c.gstin = v_clean_gstin));

    -- Search pending registration requests
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'type', 'PENDING_REGISTRATION',
        'id', r.id,
        'request_number', r.request_number,
        'name', r.shop_name,
        'mobile', r.mobile_number,
        'gstin', r.gstin,
        'submitted_by', r.submitted_by
    )), '[]'::jsonb)
    INTO v_pending_requests
    FROM public.customer_registration_requests r
    WHERE r.company_id = p_company_id
      AND r.status = 'PENDING'
      AND (p_exclude_request_id IS NULL OR r.id <> p_exclude_request_id)
      AND (r.normalized_mobile = v_norm_mobile OR (v_clean_gstin IS NOT NULL AND r.gstin = v_clean_gstin));

    RETURN jsonb_build_object(
        'has_duplicate', (jsonb_array_length(v_existing_customers) > 0 OR jsonb_array_length(v_pending_requests) > 0),
        'existing_customers', v_existing_customers,
        'pending_requests', v_pending_requests
    );
END;
$$;

-- 7.2 REGISTRATION APPROVAL RPC
CREATE OR REPLACE FUNCTION public.approve_customer_registration(
    p_request_id UUID,
    p_credit_limit NUMERIC DEFAULT 0,
    p_payment_terms_days INT DEFAULT 7,
    p_duplicate_override_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_uid UUID := auth.uid();
    v_req RECORD;
    v_role VARCHAR;
    v_is_active BOOLEAN;
    v_has_branch BOOLEAN;
    v_customer_code VARCHAR;
    v_customer_id UUID;
    v_dup_check JSONB;
BEGIN
    IF v_caller_uid IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User not authenticated.';
    END IF;

    -- Strict validation on credit parameters
    IF p_credit_limit < 0 THEN
        RAISE EXCEPTION 'Invalid Credit Limit: Negative values are not permitted.';
    END IF;
    IF p_payment_terms_days < 0 THEN
        RAISE EXCEPTION 'Invalid Payment Terms: Negative values are not permitted.';
    END IF;

    -- Lock the registration request row
    SELECT * INTO v_req
    FROM public.customer_registration_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Registration request not found.';
    END IF;

    -- Caller membership and authorization verification
    SELECT role, is_active INTO v_role, v_is_active
    FROM public.company_memberships
    WHERE company_id = v_req.company_id AND user_id = v_caller_uid;

    IF NOT FOUND OR NOT v_is_active THEN
        RAISE EXCEPTION 'Access Denied: Caller does not have an active membership in this company.';
    END IF;

    IF v_role NOT IN ('OWNER', 'ADMIN') THEN
        RAISE EXCEPTION 'Access Denied: Only OWNER or ADMIN roles can approve customer registrations.';
    END IF;

    -- STRICT SELF-APPROVAL BAN: Enforced for ALL roles including OWNER
    IF v_req.submitted_by = v_caller_uid THEN
        RAISE EXCEPTION 'Security Violation: Self-approval is strictly prohibited. Submissions must be approved by another Administrator or Owner.';
    END IF;

    -- Caller branch access check
    v_has_branch := public.has_branch_access(v_req.branch_id);
    IF NOT v_has_branch THEN
        RAISE EXCEPTION 'Access Denied: Caller lacks branch access for this registration.';
    END IF;

    -- Idempotency check
    IF v_req.status = 'APPROVED' THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Request already approved.',
            'customer_id', v_req.created_customer_id
        );
    END IF;

    IF v_req.status <> 'PENDING' THEN
        RAISE EXCEPTION 'Only PENDING requests can be approved. Current status: %', v_req.status;
    END IF;

    -- Duplicate check
    v_dup_check := public.check_customer_duplicates(v_req.company_id, v_req.mobile_number, v_req.gstin, v_req.id);
    IF (v_dup_check->>'has_duplicate')::boolean THEN
        IF p_duplicate_override_reason IS NULL OR TRIM(p_duplicate_override_reason) = '' THEN
            RAISE EXCEPTION 'Duplicate customer detected with matching mobile number or GSTIN. An explicit audit override reason is required.';
        END IF;
    END IF;

    -- Generate sequential customer code
    v_customer_code := public.get_next_company_code(v_req.company_id, 'CUSTOMER', 'CST', 5);

    -- Set trusted mutation context for triggers
    PERFORM set_config('app.trusted_mutation', 'true', true);

    -- Create Customer Master
    INSERT INTO public.customers (
        company_id,
        branch_id,
        customer_code,
        shop_name,
        owner_name,
        mobile_number,
        normalized_mobile,
        alternate_number,
        email,
        gstin,
        pan,
        fssai_number,
        customer_type,
        credit_limit,
        payment_terms_days,
        assigned_salesman_id,
        registration_request_id,
        is_active
    ) VALUES (
        v_req.company_id,
        v_req.branch_id,
        v_customer_code,
        v_req.shop_name,
        v_req.owner_name,
        v_req.mobile_number,
        v_req.normalized_mobile,
        v_req.alternate_number,
        v_req.email,
        v_req.gstin,
        v_req.pan,
        v_req.fssai_number,
        'RETAILER',
        p_credit_limit,
        p_payment_terms_days,
        v_req.submitted_by,
        v_req.id,
        TRUE
    ) RETURNING id INTO v_customer_id;

    -- Create Customer Address
    INSERT INTO public.customer_addresses (
        company_id,
        customer_id,
        address_type,
        address_line1,
        address_line2,
        city,
        state,
        pincode,
        latitude,
        longitude,
        is_primary
    ) VALUES (
        v_req.company_id,
        v_customer_id,
        'BILLING_AND_SHIPPING',
        v_req.address_line1,
        v_req.address_line2,
        v_req.city,
        v_req.state,
        v_req.pincode,
        v_req.latitude,
        v_req.longitude,
        TRUE
    );

    -- Update Registration Request status
    UPDATE public.customer_registration_requests
    SET status = 'APPROVED',
        reviewed_by = v_caller_uid,
        reviewed_at = NOW(),
        created_customer_id = v_customer_id,
        duplicate_override_reason = p_duplicate_override_reason,
        updated_at = NOW()
    WHERE id = v_req.id;

    -- Audit log
    INSERT INTO public.audit_logs (
        company_id,
        user_id,
        action,
        entity_type,
        entity_id,
        new_values
    ) VALUES (
        v_req.company_id,
        v_caller_uid,
        'APPROVE_CUSTOMER_REGISTRATION',
        'customer_registration_requests',
        v_req.id,
        jsonb_build_object(
            'customer_id', v_customer_id,
            'customer_code', v_customer_code,
            'credit_limit', p_credit_limit,
            'payment_terms_days', p_payment_terms_days,
            'duplicate_override_reason', p_duplicate_override_reason
        )
    );

    PERFORM set_config('app.trusted_mutation', 'false', true);

    RETURN jsonb_build_object(
        'success', true,
        'customer_id', v_customer_id,
        'customer_code', v_customer_code
    );
END;
$$;

-- 7.3 REGISTRATION REJECTION RPC
CREATE OR REPLACE FUNCTION public.reject_customer_registration(
    p_request_id UUID,
    p_rejection_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_uid UUID := auth.uid();
    v_req RECORD;
    v_role VARCHAR;
    v_is_active BOOLEAN;
BEGIN
    IF v_caller_uid IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User not authenticated.';
    END IF;

    IF p_rejection_reason IS NULL OR TRIM(p_rejection_reason) = '' THEN
        RAISE EXCEPTION 'Rejection reason is required.';
    END IF;

    SELECT * INTO v_req
    FROM public.customer_registration_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Registration request not found.';
    END IF;

    SELECT role, is_active INTO v_role, v_is_active
    FROM public.company_memberships
    WHERE company_id = v_req.company_id AND user_id = v_caller_uid;

    IF NOT FOUND OR NOT v_is_active OR v_role NOT IN ('OWNER', 'ADMIN') THEN
        RAISE EXCEPTION 'Access Denied: Only active OWNER or ADMIN can reject registration requests.';
    END IF;

    IF v_req.status <> 'PENDING' THEN
        RAISE EXCEPTION 'Only PENDING requests can be rejected. Current status: %', v_req.status;
    END IF;

    PERFORM set_config('app.trusted_mutation', 'true', true);

    UPDATE public.customer_registration_requests
    SET status = 'REJECTED',
        reviewed_by = v_caller_uid,
        reviewed_at = NOW(),
        rejection_reason = TRIM(p_rejection_reason),
        updated_at = NOW()
    WHERE id = v_req.id;

    INSERT INTO public.audit_logs (
        company_id,
        user_id,
        action,
        entity_type,
        entity_id,
        new_values
    ) VALUES (
        v_req.company_id,
        v_caller_uid,
        'REJECT_CUSTOMER_REGISTRATION',
        'customer_registration_requests',
        v_req.id,
        jsonb_build_object('rejection_reason', TRIM(p_rejection_reason))
    );

    PERFORM set_config('app.trusted_mutation', 'false', true);

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 7.4 REGISTRATION RESUBMISSION RPC (For Salesmen to resubmit their own rejected requests)
CREATE OR REPLACE FUNCTION public.resubmit_customer_registration(
    p_request_id UUID,
    p_shop_name VARCHAR,
    p_owner_name VARCHAR,
    p_mobile_number VARCHAR,
    p_alternate_number VARCHAR DEFAULT NULL,
    p_email VARCHAR DEFAULT NULL,
    p_gstin VARCHAR DEFAULT NULL,
    p_pan VARCHAR DEFAULT NULL,
    p_fssai_number VARCHAR DEFAULT NULL,
    p_address_line1 TEXT DEFAULT NULL,
    p_address_line2 TEXT DEFAULT NULL,
    p_city VARCHAR DEFAULT NULL,
    p_state VARCHAR DEFAULT NULL,
    p_pincode VARCHAR DEFAULT NULL,
    p_latitude NUMERIC DEFAULT NULL,
    p_longitude NUMERIC DEFAULT NULL,
    p_shop_photo_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_uid UUID := auth.uid();
    v_req RECORD;
    v_norm_mobile VARCHAR;
BEGIN
    IF v_caller_uid IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User not authenticated.';
    END IF;

    SELECT * INTO v_req
    FROM public.customer_registration_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Registration request not found.';
    END IF;

    IF v_req.submitted_by <> v_caller_uid THEN
        RAISE EXCEPTION 'Access Denied: You may only resubmit your own registration requests.';
    END IF;

    IF v_req.status <> 'REJECTED' THEN
        RAISE EXCEPTION 'Only REJECTED requests can be resubmitted. Current status: %', v_req.status;
    END IF;

    v_norm_mobile := RIGHT(REGEXP_REPLACE(p_mobile_number, '[^0-9]', '', 'g'), 10);
    IF LENGTH(v_norm_mobile) < 10 THEN
        RAISE EXCEPTION 'Invalid mobile number. Must contain at least 10 digits.';
    END IF;

    PERFORM set_config('app.trusted_mutation', 'true', true);

    UPDATE public.customer_registration_requests
    SET shop_name = TRIM(p_shop_name),
        owner_name = TRIM(p_owner_name),
        mobile_number = TRIM(p_mobile_number),
        normalized_mobile = v_norm_mobile,
        alternate_number = NULLIF(TRIM(p_alternate_number), ''),
        email = NULLIF(TRIM(p_email), ''),
        gstin = NULLIF(UPPER(TRIM(p_gstin)), ''),
        pan = NULLIF(UPPER(TRIM(p_pan)), ''),
        fssai_number = NULLIF(TRIM(p_fssai_number), ''),
        address_line1 = COALESCE(NULLIF(TRIM(p_address_line1), ''), address_line1),
        address_line2 = NULLIF(TRIM(p_address_line2), ''),
        city = COALESCE(NULLIF(TRIM(p_city), ''), city),
        state = COALESCE(NULLIF(TRIM(p_state), ''), state),
        pincode = COALESCE(NULLIF(TRIM(p_pincode), ''), pincode),
        latitude = COALESCE(p_latitude, latitude),
        longitude = COALESCE(p_longitude, longitude),
        shop_photo_url = COALESCE(p_shop_photo_url, shop_photo_url),
        status = 'PENDING',
        reviewed_by = NULL,
        reviewed_at = NULL,
        rejection_reason = NULL,
        updated_at = NOW()
    WHERE id = v_req.id;

    INSERT INTO public.audit_logs (
        company_id,
        user_id,
        action,
        entity_type,
        entity_id,
        new_values
    ) VALUES (
        v_req.company_id,
        v_caller_uid,
        'RESUBMIT_CUSTOMER_REGISTRATION',
        'customer_registration_requests',
        v_req.id,
        jsonb_build_object('status', 'PENDING', 'resubmitted_by', v_caller_uid)
    );

    PERFORM set_config('app.trusted_mutation', 'false', true);

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 7.5 REGISTRATION CANCELLATION RPC
CREATE OR REPLACE FUNCTION public.cancel_customer_registration(
    p_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_uid UUID := auth.uid();
    v_req RECORD;
BEGIN
    IF v_caller_uid IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User not authenticated.';
    END IF;

    SELECT * INTO v_req
    FROM public.customer_registration_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Registration request not found.';
    END IF;

    IF v_req.submitted_by <> v_caller_uid THEN
        RAISE EXCEPTION 'Access Denied: You may only cancel your own registration requests.';
    END IF;

    IF v_req.status <> 'PENDING' THEN
        RAISE EXCEPTION 'Only PENDING requests can be cancelled. Current status: %', v_req.status;
    END IF;

    PERFORM set_config('app.trusted_mutation', 'true', true);

    UPDATE public.customer_registration_requests
    SET status = 'CANCELLED',
        updated_at = NOW()
    WHERE id = v_req.id;

    INSERT INTO public.audit_logs (
        company_id,
        user_id,
        action,
        entity_type,
        entity_id,
        new_values
    ) VALUES (
        v_req.company_id,
        v_caller_uid,
        'CANCEL_CUSTOMER_REGISTRATION',
        'customer_registration_requests',
        v_req.id,
        jsonb_build_object('status', 'CANCELLED')
    );

    PERFORM set_config('app.trusted_mutation', 'false', true);

    RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hsn_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_registration_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

-- 8.1 MASTER DATA POLICIES (Company isolated, read for active members, manage by OWNER/ADMIN)
CREATE POLICY "units_select" ON public.units FOR SELECT TO authenticated
    USING (company_id = public.current_company_id());

CREATE POLICY "units_manage" ON public.units FOR ALL TO authenticated
    USING (company_id = public.current_company_id() AND public.current_user_role() IN ('OWNER', 'ADMIN'))
    WITH CHECK (company_id = public.current_company_id() AND public.current_user_role() IN ('OWNER', 'ADMIN'));

CREATE POLICY "unit_conversions_select" ON public.unit_conversions FOR SELECT TO authenticated
    USING (company_id = public.current_company_id());

CREATE POLICY "unit_conversions_manage" ON public.unit_conversions FOR ALL TO authenticated
    USING (company_id = public.current_company_id() AND public.current_user_role() IN ('OWNER', 'ADMIN'))
    WITH CHECK (company_id = public.current_company_id() AND public.current_user_role() IN ('OWNER', 'ADMIN'));

CREATE POLICY "hsn_codes_select" ON public.hsn_codes FOR SELECT TO authenticated
    USING (company_id = public.current_company_id());

CREATE POLICY "hsn_codes_manage" ON public.hsn_codes FOR ALL TO authenticated
    USING (company_id = public.current_company_id() AND public.current_user_role() IN ('OWNER', 'ADMIN'))
    WITH CHECK (company_id = public.current_company_id() AND public.current_user_role() IN ('OWNER', 'ADMIN'));

CREATE POLICY "tax_rates_select" ON public.tax_rates FOR SELECT TO authenticated
    USING (company_id = public.current_company_id());

CREATE POLICY "tax_rates_manage" ON public.tax_rates FOR ALL TO authenticated
    USING (company_id = public.current_company_id() AND public.current_user_role() IN ('OWNER', 'ADMIN'))
    WITH CHECK (company_id = public.current_company_id() AND public.current_user_role() IN ('OWNER', 'ADMIN'));

CREATE POLICY "items_select" ON public.items FOR SELECT TO authenticated
    USING (company_id = public.current_company_id());

CREATE POLICY "items_manage" ON public.items FOR ALL TO authenticated
    USING (company_id = public.current_company_id() AND public.current_user_role() IN ('OWNER', 'ADMIN'))
    WITH CHECK (company_id = public.current_company_id() AND public.current_user_role() IN ('OWNER', 'ADMIN'));

CREATE POLICY "suppliers_select" ON public.suppliers FOR SELECT TO authenticated
    USING (company_id = public.current_company_id());

CREATE POLICY "suppliers_manage" ON public.suppliers FOR ALL TO authenticated
    USING (company_id = public.current_company_id() AND public.current_user_role() IN ('OWNER', 'ADMIN'))
    WITH CHECK (company_id = public.current_company_id() AND public.current_user_role() IN ('OWNER', 'ADMIN'));

CREATE POLICY "warehouses_select" ON public.warehouses FOR SELECT TO authenticated
    USING (company_id = public.current_company_id() AND public.has_branch_access(branch_id));

CREATE POLICY "warehouses_manage" ON public.warehouses FOR ALL TO authenticated
    USING (company_id = public.current_company_id() AND public.current_user_role() IN ('OWNER', 'ADMIN'))
    WITH CHECK (company_id = public.current_company_id() AND public.current_user_role() IN ('OWNER', 'ADMIN') AND public.has_branch_access(branch_id));

-- 8.2 CUSTOMER REGISTRATION REQUEST POLICIES
-- Salesmen see their own; Owner/Admin/Accountant/Supervisor see branch requests
CREATE POLICY "customer_reg_select" ON public.customer_registration_requests FOR SELECT TO authenticated
    USING (
        company_id = public.current_company_id()
        AND (
            public.current_user_role() IN ('OWNER', 'ADMIN', 'ACCOUNTANT')
            OR (public.has_branch_access(branch_id) AND (public.current_user_role() = 'SUPERVISOR' OR submitted_by = auth.uid()))
        )
    );

-- Insert strictly requires PENDING status, matching submitted_by = auth.uid(), and branch access
CREATE POLICY "customer_reg_insert" ON public.customer_registration_requests FOR INSERT TO authenticated
    WITH CHECK (
        company_id = public.current_company_id()
        AND submitted_by = auth.uid()
        AND status = 'PENDING'
        AND reviewed_by IS NULL
        AND reviewed_at IS NULL
        AND created_customer_id IS NULL
        AND public.has_branch_access(branch_id)
    );

-- 8.3 CUSTOMERS MASTER POLICIES
CREATE POLICY "customers_select" ON public.customers FOR SELECT TO authenticated
    USING (
        company_id = public.current_company_id()
        AND (
            public.current_user_role() IN ('OWNER', 'ADMIN', 'ACCOUNTANT')
            OR (public.has_branch_access(branch_id) AND (public.current_user_role() = 'SUPERVISOR' OR assigned_salesman_id = auth.uid()))
        )
    );

CREATE POLICY "customers_manage" ON public.customers FOR ALL TO authenticated
    USING (company_id = public.current_company_id() AND public.current_user_role() IN ('OWNER', 'ADMIN'))
    WITH CHECK (company_id = public.current_company_id() AND public.current_user_role() IN ('OWNER', 'ADMIN'));

-- 8.4 CUSTOMER ADDRESSES POLICIES
CREATE POLICY "customer_addresses_select" ON public.customer_addresses FOR SELECT TO authenticated
    USING (
        company_id = public.current_company_id()
        AND EXISTS (
            SELECT 1 FROM public.customers c
            WHERE c.id = customer_addresses.customer_id
              AND c.company_id = public.current_company_id()
              AND (
                  public.current_user_role() IN ('OWNER', 'ADMIN', 'ACCOUNTANT')
                  OR (public.has_branch_access(c.branch_id) AND (public.current_user_role() = 'SUPERVISOR' OR c.assigned_salesman_id = auth.uid()))
              )
        )
    );

CREATE POLICY "customer_addresses_manage" ON public.customer_addresses FOR ALL TO authenticated
    USING (company_id = public.current_company_id() AND public.current_user_role() IN ('OWNER', 'ADMIN'))
    WITH CHECK (company_id = public.current_company_id() AND public.current_user_role() IN ('OWNER', 'ADMIN'));

-- ============================================================================
-- 9. PHASE 2 ROLE PERMISSION MATRIX SEEDING
-- ============================================================================

INSERT INTO public.role_permissions (role, permission_key, module, description) VALUES
-- OWNER Master Data Permissions
('OWNER', 'master:items_view', 'Master Data', 'Can view item catalog'),
('OWNER', 'master:items_manage', 'Master Data', 'Can create and modify items and pricing'),
('OWNER', 'master:units_manage', 'Master Data', 'Can manage units of measure and conversion rates'),
('OWNER', 'master:tax_manage', 'Master Data', 'Can manage HSN codes and GST tax rates'),
('OWNER', 'master:suppliers_manage', 'Master Data', 'Can manage supplier directory'),
('OWNER', 'master:warehouses_manage', 'Master Data', 'Can manage warehouse locations'),
('OWNER', 'customers:view_all', 'Customers', 'Can view all customer records across all branches'),
('OWNER', 'customers:registrations_review', 'Customers', 'Can approve or reject shop registrations'),

-- ADMIN Master Data Permissions
('ADMIN', 'master:items_view', 'Master Data', 'Can view item catalog'),
('ADMIN', 'master:items_manage', 'Master Data', 'Can create and modify items and pricing'),
('ADMIN', 'master:units_manage', 'Master Data', 'Can manage units of measure and conversion rates'),
('ADMIN', 'master:tax_manage', 'Master Data', 'Can manage HSN codes and GST tax rates'),
('ADMIN', 'master:suppliers_manage', 'Master Data', 'Can manage supplier directory'),
('ADMIN', 'master:warehouses_manage', 'Master Data', 'Can manage warehouse locations'),
('ADMIN', 'customers:view_all', 'Customers', 'Can view customer directory'),
('ADMIN', 'customers:registrations_review', 'Customers', 'Can approve or reject shop registrations'),

-- SALESMAN Permissions
('SALESMAN', 'master:items_view', 'Master Data', 'Can view active finished goods catalog and prices'),
('SALESMAN', 'customers:register', 'Customers', 'Can submit new customer shop registration requests'),
('SALESMAN', 'customers:view_assigned', 'Customers', 'Can view own customer directory and registration queue'),

-- SUPERVISOR Permissions
('SUPERVISOR', 'master:items_view', 'Master Data', 'Can view items and prices for assigned branch'),
('SUPERVISOR', 'customers:view_branch', 'Customers', 'Can view customers in assigned branch'),

-- ACCOUNTANT Permissions
('ACCOUNTANT', 'master:items_view', 'Master Data', 'Can view items and tax configurations'),
('ACCOUNTANT', 'customers:view_all', 'Customers', 'Can view all customer master data and credit terms'),
('ACCOUNTANT', 'master:suppliers_manage', 'Master Data', 'Can view and verify supplier GST details'),

-- PRODUCTION Permissions
('PRODUCTION', 'master:items_view', 'Master Data', 'Can view raw materials, packaging, and finished goods BOM items'),

-- WAREHOUSE Permissions
('WAREHOUSE', 'master:items_view', 'Master Data', 'Can view item catalog and storage units'),
('WAREHOUSE', 'master:warehouses_manage', 'Master Data', 'Can view warehouse locations and racks')
ON CONFLICT (role, permission_key) DO NOTHING;
