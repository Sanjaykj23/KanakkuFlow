-- ============================================================================
-- KanakkuFlow ERP - Phase 1: Core Foundation & Identity Migration
-- File: supabase/migrations/20261121000001_initial_core_schema.sql
-- Description: Companies, Branches, User Profiles, Company Memberships, 
--              Membership Branches, Role Permissions, Invitations, Audit Logs,
--              Company Counters, and Hardened Non-Recursive RLS Policies.
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. CONTROLLED ENUM TYPES
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM (
        'OWNER',
        'ADMIN',
        'SUPERVISOR',
        'SALESMAN',
        'ACCOUNTANT',
        'PRODUCTION',
        'WAREHOUSE'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE membership_status AS ENUM (
        'ACTIVE',
        'SUSPENDED',
        'DEACTIVATED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE invitation_status AS ENUM (
        'PENDING',
        'ACCEPTED',
        'REVOKED',
        'EXPIRED'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. CORE TENANT TABLES (COMPANIES & BRANCHES)
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    legal_name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255) NOT NULL,
    gstin VARCHAR(15) NULL,
    pan VARCHAR(10) NULL,
    state_code VARCHAR(2) NOT NULL, -- e.g., '33' for Tamil Nadu
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    CONSTRAINT chk_gstin_format CHECK (gstin IS NULL OR gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'),
    CONSTRAINT chk_pan_format CHECK (pan IS NULL OR pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]{1}$')
);

CREATE TABLE IF NOT EXISTS public.branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(150) NOT NULL,
    address_line1 TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state_code VARCHAR(2) NOT NULL,
    pincode VARCHAR(10) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    CONSTRAINT uq_branches_company_code UNIQUE (company_id, code),
    CONSTRAINT uq_branches_company_id_id UNIQUE (company_id, id)
);

-- Company Counters for Atomic, Concurrency-Safe Sequential Code Generation
CREATE TABLE IF NOT EXISTS public.company_counters (
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    counter_type VARCHAR(50) NOT NULL, -- e.g., 'EMPLOYEE', 'CUSTOMER', 'INVOICE', 'BATCH'
    last_val BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    PRIMARY KEY (company_id, counter_type)
);

-- 4. USER PROFILES (1:1 with auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    mobile_number VARCHAR(20) NULL,
    avatar_url TEXT NULL,
    requires_password_change BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- 5. COMPANY MEMBERSHIPS
CREATE TABLE IF NOT EXISTS public.company_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    role user_role NOT NULL,
    employee_code VARCHAR(50) NOT NULL,
    status membership_status NOT NULL DEFAULT 'ACTIVE',
    territory_notes TEXT NULL,
    created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    CONSTRAINT uq_memberships_company_user UNIQUE (company_id, user_id),
    CONSTRAINT uq_memberships_company_emp_code UNIQUE (company_id, employee_code),
    CONSTRAINT uq_memberships_company_id_id UNIQUE (company_id, id)
);

-- 6. MULTI-BRANCH ASSIGNMENTS
CREATE TABLE IF NOT EXISTS public.membership_branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    membership_id UUID NOT NULL REFERENCES public.company_memberships(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    CONSTRAINT uq_membership_branch UNIQUE (membership_id, branch_id)
);

-- 7. ROLE PERMISSIONS
CREATE TABLE IF NOT EXISTS public.role_permissions (
    role user_role NOT NULL,
    permission_key VARCHAR(100) NOT NULL,
    module VARCHAR(50) NOT NULL,
    description TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    PRIMARY KEY (role, permission_key)
);

-- 8. USER INVITATIONS & INVITATION BRANCHES
CREATE TABLE IF NOT EXISTS public.user_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    mobile_number VARCHAR(20) NULL,
    role user_role NOT NULL,
    employee_code VARCHAR(50) NOT NULL,
    token_hash VARCHAR(128) NOT NULL,
    status invitation_status NOT NULL DEFAULT 'PENDING',
    territory_notes TEXT NULL,
    invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    CONSTRAINT uq_invitation_company_token UNIQUE (company_id, token_hash),
    CONSTRAINT uq_invitation_company_emp_code UNIQUE (company_id, employee_code)
);

CREATE TABLE IF NOT EXISTS public.invitation_branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invitation_id UUID NOT NULL REFERENCES public.user_invitations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    CONSTRAINT uq_invitation_branch UNIQUE (invitation_id, branch_id)
);

-- 9. AUDIT LOGS (IMMUTABLE / APPEND-ONLY)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_name VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    old_values JSONB NULL,
    new_values JSONB NULL,
    ip_address INET NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- ============================================================================
-- 10. INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_branches_company ON public.branches(company_id);
CREATE INDEX IF NOT EXISTS idx_memberships_company_user ON public.company_memberships(company_id, user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON public.company_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_membership_branches_membership ON public.membership_branches(membership_id);
CREATE INDEX IF NOT EXISTS idx_membership_branches_branch ON public.membership_branches(branch_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token_hash ON public.user_invitations(token_hash) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_invitations_company_status ON public.user_invitations(company_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_created ON public.audit_logs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(company_id, entity_name, entity_id);

-- ============================================================================
-- 11. HARDENED SECURITY DEFINER FUNCTIONS & TRIGGERS
-- ============================================================================

-- Next Sequential Code Generator (Concurrency-Safe)
CREATE OR REPLACE FUNCTION public.get_next_company_code(
    p_company_id UUID,
    p_counter_type VARCHAR(50),
    p_prefix VARCHAR(10),
    p_pad_length INT DEFAULT 5
)
RETURNS TEXT AS $$
DECLARE
    v_next_val BIGINT;
BEGIN
    INSERT INTO public.company_counters (company_id, counter_type, last_val, updated_at)
    VALUES (p_company_id, p_counter_type, 1, TIMEZONE('utc', NOW()))
    ON CONFLICT (company_id, counter_type)
    DO UPDATE SET 
        last_val = public.company_counters.last_val + 1,
        updated_at = TIMEZONE('utc', NOW())
    RETURNING last_val INTO v_next_val;

    RETURN p_prefix || '-' || LPAD(v_next_val::TEXT, p_pad_length, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.get_next_company_code(UUID, VARCHAR, VARCHAR, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_next_company_code(UUID, VARCHAR, VARCHAR, INT) TO authenticated;

-- Prevent Audit Log Mutation
CREATE OR REPLACE FUNCTION public.fn_prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable. UPDATE and DELETE operations are prohibited.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_immutable_audit_logs ON public.audit_logs;
CREATE TRIGGER trg_immutable_audit_logs
BEFORE UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_audit_log_mutation();

-- Enforce Role Hierarchy
CREATE OR REPLACE FUNCTION public.fn_enforce_role_hierarchy()
RETURNS TRIGGER AS $$
DECLARE
    v_actor_role user_role;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT role INTO v_actor_role
    FROM public.company_memberships
    WHERE company_id = NEW.company_id
      AND user_id = auth.uid()
      AND status = 'ACTIVE';

    IF v_actor_role NOT IN ('OWNER', 'ADMIN') THEN
        RAISE EXCEPTION 'Access Denied: Only Owner or Admin can manage accounts.';
    END IF;

    IF v_actor_role = 'ADMIN' THEN
        IF NEW.role IN ('OWNER', 'ADMIN') THEN
            RAISE EXCEPTION 'Access Denied: Admins cannot create or promote to Owner or Admin roles.';
        END IF;

        IF TG_OP = 'UPDATE' AND OLD.role IN ('OWNER', 'ADMIN') THEN
            RAISE EXCEPTION 'Access Denied: Admins cannot modify or deactivate Owner or Admin accounts.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_enforce_membership_role_hierarchy ON public.company_memberships;
CREATE TRIGGER trg_enforce_membership_role_hierarchy
BEFORE INSERT OR UPDATE ON public.company_memberships
FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_role_hierarchy();

DROP TRIGGER IF EXISTS trg_enforce_invitation_role_hierarchy ON public.user_invitations;
CREATE TRIGGER trg_enforce_invitation_role_hierarchy
BEFORE INSERT OR UPDATE ON public.user_invitations
FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_role_hierarchy();

-- Validate Tenant Match on Branch Assignment
CREATE OR REPLACE FUNCTION public.fn_validate_membership_branch_tenant()
RETURNS TRIGGER AS $$
DECLARE
    v_member_company UUID;
    v_branch_company UUID;
BEGIN
    SELECT company_id INTO v_member_company FROM public.company_memberships WHERE id = NEW.membership_id;
    SELECT company_id INTO v_branch_company FROM public.branches WHERE id = NEW.branch_id;

    IF v_member_company IS DISTINCT FROM v_branch_company THEN
        RAISE EXCEPTION 'Cross-company branch violation: Membership and Branch must belong to the same company.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_validate_membership_branch_tenant ON public.membership_branches;
CREATE TRIGGER trg_validate_membership_branch_tenant
BEFORE INSERT OR UPDATE ON public.membership_branches
FOR EACH ROW EXECUTE FUNCTION public.fn_validate_membership_branch_tenant();

-- ============================================================================
-- 12. RLS CONTEXT HELPERS & POLICIES
-- ============================================================================

CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS UUID AS $$
DECLARE
    v_company_id UUID;
BEGIN
    v_company_id := NULLIF(
        current_setting('request.headers', true)::json->>'x-company-id',
        ''
    )::UUID;

    IF v_company_id IS NULL OR auth.uid() IS NULL THEN
        RETURN NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.company_memberships
        WHERE company_id = v_company_id
          AND user_id = auth.uid()
          AND status = 'ACTIVE'
    ) THEN
        RETURN NULL;
    END IF;

    RETURN v_company_id;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.current_company_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_company_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role AS $$
    SELECT role 
    FROM public.company_memberships
    WHERE company_id = public.current_company_id()
      AND user_id = auth.uid()
      AND status = 'ACTIVE';
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

CREATE OR REPLACE FUNCTION public.has_branch_access(p_branch_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_role user_role;
    v_cid UUID;
BEGIN
    v_cid := public.current_company_id();
    IF v_cid IS NULL OR p_branch_id IS NULL THEN
        RETURN FALSE;
    END IF;

    v_role := public.current_user_role();

    -- OWNER, ADMIN, and ACCOUNTANT have company-wide branch access by default
    IF v_role IN ('OWNER', 'ADMIN', 'ACCOUNTANT') THEN
        RETURN EXISTS (
            SELECT 1 FROM public.branches 
            WHERE id = p_branch_id AND company_id = v_cid
        );
    END IF;

    -- SUPERVISOR, SALESMAN, PRODUCTION, WAREHOUSE: must be explicitly assigned
    RETURN EXISTS (
        SELECT 1 
        FROM public.membership_branches mb
        JOIN public.company_memberships cm ON cm.id = mb.membership_id
        WHERE cm.company_id = v_cid
          AND cm.user_id = auth.uid()
          AND cm.status = 'ACTIVE'
          AND mb.branch_id = p_branch_id
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.has_branch_access(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_branch_access(UUID) TO authenticated;

-- Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitation_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. COMPANIES
CREATE POLICY "Users can view companies they belong to"
ON public.companies FOR SELECT TO authenticated
USING (id IN (
    SELECT company_id FROM public.company_memberships 
    WHERE user_id = auth.uid() AND status = 'ACTIVE'
));

CREATE POLICY "Only Owner can update company settings"
ON public.companies FOR UPDATE TO authenticated
USING (id = public.current_company_id() AND public.current_user_role() = 'OWNER')
WITH CHECK (id = public.current_company_id() AND public.current_user_role() = 'OWNER');

-- 2. BRANCHES
CREATE POLICY "Users can view accessible branches"
ON public.branches FOR SELECT TO authenticated
USING (company_id = public.current_company_id() AND public.has_branch_access(id));

CREATE POLICY "Owner and Admin can manage branches"
ON public.branches FOR ALL TO authenticated
USING (
    company_id = public.current_company_id() 
    AND public.current_user_role() IN ('OWNER', 'ADMIN')
);

-- 3. USER_PROFILES
CREATE POLICY "Users can view their profile and coworker profiles"
ON public.user_profiles FOR SELECT TO authenticated
USING (
    id = auth.uid() OR
    id IN (
        SELECT user_id FROM public.company_memberships 
        WHERE company_id = public.current_company_id()
    )
);

CREATE POLICY "Users can update their own profile"
ON public.user_profiles FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- 4. COMPANY_MEMBERSHIPS
CREATE POLICY "Members can view coworkers in active company"
ON public.company_memberships FOR SELECT TO authenticated
USING (
    user_id = auth.uid() OR
    company_id = public.current_company_id()
);

CREATE POLICY "Owner and Admin can insert/update memberships"
ON public.company_memberships FOR ALL TO authenticated
USING (
    company_id = public.current_company_id() 
    AND public.current_user_role() IN ('OWNER', 'ADMIN')
);

-- 5. MEMBERSHIP_BRANCHES
CREATE POLICY "Users can view branch assignments in company"
ON public.membership_branches FOR SELECT TO authenticated
USING (
    membership_id IN (
        SELECT id FROM public.company_memberships 
        WHERE company_id = public.current_company_id()
    )
);

CREATE POLICY "Owner and Admin can manage branch assignments"
ON public.membership_branches FOR ALL TO authenticated
USING (
    membership_id IN (
        SELECT id FROM public.company_memberships 
        WHERE company_id = public.current_company_id()
    )
    AND public.current_user_role() IN ('OWNER', 'ADMIN')
);

-- 6. USER_INVITATIONS & INVITATION_BRANCHES
CREATE POLICY "Owner and Admin can view and manage invitations"
ON public.user_invitations FOR ALL TO authenticated
USING (
    company_id = public.current_company_id() 
    AND public.current_user_role() IN ('OWNER', 'ADMIN')
);

CREATE POLICY "Owner and Admin can manage invitation branches"
ON public.invitation_branches FOR ALL TO authenticated
USING (
    invitation_id IN (
        SELECT id FROM public.user_invitations 
        WHERE company_id = public.current_company_id()
    )
);

-- 7. AUDIT_LOGS
CREATE POLICY "Only Owner can view audit logs"
ON public.audit_logs FOR SELECT TO authenticated
USING (
    company_id = public.current_company_id() 
    AND public.current_user_role() = 'OWNER'
);

CREATE POLICY "Authenticated users can insert audit logs"
ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (company_id = public.current_company_id());

-- 8. ROLE_PERMISSIONS
CREATE POLICY "All authenticated users can read role permissions"
ON public.role_permissions FOR SELECT TO authenticated
USING (true);

-- ============================================================================
-- 13. SEED ROLE PERMISSIONS MATRIX
-- ============================================================================
INSERT INTO public.role_permissions (role, permission_key, module, description) VALUES
-- OWNER
('OWNER', 'users:create_admin', 'Administration', 'Can create and invite Admin accounts'),
('OWNER', 'users:create_staff', 'Administration', 'Can create all employee accounts'),
('OWNER', 'users:manage_status', 'Administration', 'Can deactivate or change any account status'),
('OWNER', 'company:settings', 'Administration', 'Can edit company details, GSTIN, and settings'),
('OWNER', 'audit_logs:view', 'Administration', 'Full access to audit logs and security logs'),
('OWNER', 'orders:view', 'Sales', 'Can view all orders across all branches'),
('OWNER', 'orders:create', 'Sales', 'Can create sales orders'),
('OWNER', 'orders:approve', 'Sales', 'Can approve high-risk orders'),
('OWNER', 'pricing:manage', 'Sales', 'Can modify price lists and approve price changes'),
('OWNER', 'bom:manage', 'Production', 'Can manage bill of materials and recipe versions'),
('OWNER', 'production:runs_view', 'Production', 'Can view production runs across all branches'),
('OWNER', 'production:runs_exec', 'Production', 'Can log production runs and material consumption'),
('OWNER', 'qc:inspect_record', 'Production', 'Can record QC inspections'),
('OWNER', 'inventory:view_all', 'Inventory', 'Can view stock across all warehouses and branches'),
('OWNER', 'inventory:movement', 'Inventory', 'Can perform stock movements and transfers'),
('OWNER', 'inventory:dispatch', 'Inventory', 'Can dispatch orders using FEFO batches'),
('OWNER', 'inventory:adjust', 'Inventory', 'Can record stock adjustments and scrap'),
('OWNER', 'costing:valuation', 'Inventory', 'Can view weighted-average costing and inventory valuation'),
('OWNER', 'invoices:generate_gst', 'Billing', 'Can generate GST invoices'),
('OWNER', 'payments:record', 'Billing', 'Can record payments and allocate to invoices'),
('OWNER', 'gst_reports:export', 'Billing', 'Can export GSTR-1 and GSTR-3B summaries'),
-- ADMIN
('ADMIN', 'users:create_staff', 'Administration', 'Can create Supervisor, Salesman, Accountant, Production, Warehouse'),
('ADMIN', 'users:manage_status', 'Administration', 'Can deactivate staff accounts (cannot touch Owner or Admin)'),
('ADMIN', 'orders:view', 'Sales', 'Can view all orders company-wide'),
('ADMIN', 'orders:create', 'Sales', 'Can create sales orders'),
('ADMIN', 'orders:approve', 'Sales', 'Can review and approve sales orders and shop registrations'),
('ADMIN', 'bom:manage', 'Production', 'Can manage BOM recipes'),
('ADMIN', 'production:runs_view', 'Production', 'Can view production status company-wide'),
('ADMIN', 'inventory:view_all', 'Inventory', 'Can view inventory across all branches'),
('ADMIN', 'inventory:dispatch', 'Inventory', 'Can oversee dispatch workflows'),
('ADMIN', 'invoices:generate_gst', 'Billing', 'Can generate GST invoices'),
('ADMIN', 'payments:record', 'Billing', 'Can log payments'),
-- ACCOUNTANT
('ACCOUNTANT', 'invoices:view_all', 'Billing', 'Can view all invoices across all branches'),
('ACCOUNTANT', 'invoices:generate_gst', 'Billing', 'Can create and finalize GST invoices'),
('ACCOUNTANT', 'payments:record', 'Billing', 'Can record customer collections and allocate payments'),
('ACCOUNTANT', 'gst_reports:export', 'Billing', 'Can export GST returns and accounting ledgers'),
('ACCOUNTANT', 'costing:valuation', 'Inventory', 'Can view financial inventory valuation'),
('ACCOUNTANT', 'customer_ledger:view', 'Billing', 'Can inspect customer outstanding balances'),
-- SUPERVISOR
('SUPERVISOR', 'orders:view', 'Sales', 'Can view orders in assigned branch'),
('SUPERVISOR', 'orders:approve', 'Sales', 'Can approve permitted operational tasks'),
('SUPERVISOR', 'production:runs_view', 'Production', 'Can view production in assigned branch'),
('SUPERVISOR', 'qc:inspect_record', 'Production', 'Can record and sign off QC inspections'),
('SUPERVISOR', 'inventory:view_branch', 'Inventory', 'Can inspect stock in assigned branch'),
-- SALESMAN
('SALESMAN', 'orders:view', 'Sales', 'Can view assigned customer orders'),
('SALESMAN', 'orders:create', 'Sales', 'Can create sales orders for assigned customers'),
('SALESMAN', 'inventory:view_branch', 'Inventory', 'Can view available stock for selling'),
('SALESMAN', 'shop_reg:submit', 'Sales', 'Can register new shop visits for Admin approval'),
-- PRODUCTION
('PRODUCTION', 'bom:view', 'Production', 'Can view BOM recipe proportions'),
('PRODUCTION', 'production:runs_view', 'Production', 'Can view scheduled runs in assigned plant'),
('PRODUCTION', 'production:runs_exec', 'Production', 'Can record raw material consumption and finished output'),
('PRODUCTION', 'qc:inspect_record', 'Production', 'Can record quality control measurements'),
-- WAREHOUSE
('WAREHOUSE', 'inventory:view_branch', 'Inventory', 'Can view warehouse stock in assigned facility'),
('WAREHOUSE', 'inventory:movement', 'Inventory', 'Can record goods receipt and internal bin transfers'),
('WAREHOUSE', 'inventory:dispatch', 'Inventory', 'Can pick and pack using FEFO batch rules')
ON CONFLICT (role, permission_key) DO NOTHING;
