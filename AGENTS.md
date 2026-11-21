# AGENTS.md — KanakkuFlow ERP Engineering Rules & Architecture

Welcome to **KanakkuFlow**, an enterprise-grade Manufacturing ERP system tailored for Indian food manufacturing businesses (e.g., packaged snacks, murukku, confectionery).

This document outlines mandatory architectural patterns, security controls, domain rules, and development practices that all engineers and AI assistants must follow.

---

## 1. Core Technology Stack

- **Frontend Framework:** Next.js App Router (React, TypeScript strict mode)
- **Styling & UI:** Tailwind CSS, shadcn/ui component primitives, Lucide React icons
- **Form Handling & Validation:** React Hook Form + Zod validation (dual-side validation)
- **Charts & Metrics:** Recharts
- **Backend & Database:** Supabase PostgreSQL, Supabase Auth, Row Level Security (RLS)
- **Transactional Logic:** PostgreSQL functions (`SECURITY DEFINER` with search-path safety) for ACID inventory/invoicing
- **Testing:** Vitest + React Testing Library (unit/integration), Playwright (E2E)
- **Hosting Target:** Vercel (Next.js frontend), Supabase (Auth, PostgreSQL, Storage, Edge Functions)

*Rule:* Do not introduce microservices, FastAPI, or additional backends for initial phases unless explicitly authorized.

---

## 2. Architectural Principles & Clean Monolith Separation

1. **Never Put Business Logic in React Components:**
   - React components only manage presentation, form state, and UI feedback.
   - Domain operations must live in server-side application services (`src/modules/*`), server actions, or PostgreSQL transactions.
2. **Layered Separation of Concerns:**
   - `src/components/ui/` — Dumb, reusable atomic primitives (shadcn/ui).
   - `src/components/layout/` — Shell, navigation, breadcrumbs, command bar.
   - `src/modules/<domain>/` — Pure business domain services (FEFO calculation, GST tax splitting, risk scoring).
   - `src/lib/supabase/` — Database access layer (server, client, admin service role).
   - `src/app/api/` & Server Actions — Transport layer enforcing authorization and request validation.
3. **No Direct Mutating Operations from Client:**
   - Sensitive mutations (order approvals, stock reservations, batch releases, GST invoice generation) must execute server-side with verified session context and PostgreSQL transaction boundaries.

---

## 3. Role-Based Access Control (RBAC) Hierarchy

KanakkuFlow enforces 7 strictly defined hierarchical roles:

$$\text{OWNER} > \text{ADMIN} > \text{SUPERVISOR} / \text{SALESMAN} / \text{ACCOUNTANT} / \text{PRODUCTION} / \text{WAREHOUSE}$$

### Security Invariants:
1. **Never Trust Client Metadata:** User roles and company associations are stored in the database (`company_memberships`), never in editable user metadata or JWT payloads without verification.
2. **Hierarchical Account Management:**
   - **`OWNER`:** Full access across all companies, branches, financial reports, settings, and audit logs. Can create/modify `ADMIN` and all roles.
   - **`ADMIN`:** Company-wide operational access. Can create/manage `SUPERVISOR`, `SALESMAN`, `ACCOUNTANT`, `PRODUCTION`, `WAREHOUSE`. **Cannot create, promote, modify, or deactivate an `OWNER` or another `ADMIN`.**
   - **`ACCOUNTANT`:** Company-wide access to financial ledgers, GST reports, invoices, and customer outstanding. **No permission to alter BOM recipes or execute inventory movements.**
   - **`SUPERVISOR`:** Operational management for assigned branch(es).
   - **`SALESMAN`:** Can create sales orders and submit new shop registration requests for assigned branch/customers. Cannot see company-wide financial margins or costs.
   - **`PRODUCTION`:** Access strictly to recipes (BOM), production runs, and QC logging for assigned plant/branch.
   - **`WAREHOUSE`:** Access strictly to goods receipt, FEFO picking, stock movement, and dispatch for assigned warehouse/branch.

---

## 4. Multi-Tenant Isolation & Row Level Security (RLS)

1. **Non-Recursive RLS Helpers:**
   - Every protected table has RLS enabled.
   - Tenant resolution uses `public.current_company_id()`, which reads the verified `x-company-id` header and verifies that `auth.uid()` has an active membership in that company.
   - Functions query data with `SECURITY DEFINER` and explicitly declare:
     ```sql
     SET search_path = public, pg_temp;
     ```
2. **Multi-Branch Isolation:**
   - Tables with `branch_id` enforce `public.has_branch_access(branch_id)` in their RLS policies.
   - `OWNER`, `ADMIN`, and `ACCOUNTANT` have company-wide branch access by default.
   - `SUPERVISOR`, `SALESMAN`, `PRODUCTION`, and `WAREHOUSE` are strictly locked to branches mapped in `membership_branches`.

---

## 5. Domain Rules (Manufacturing, Inventory & GST)

1. **Batch Traceability & FEFO:**
   - All inventory movements are tracked down to the physical batch with manufacturing date, expiry date, and QC status.
   - Physical picking **must follow First-Expired, First-Out (FEFO)**.
   - Expired or QC-quarantined batches cannot be allocated or reserved for dispatch.
2. **Perpetual Weighted-Average Costing:**
   - Separate physical batch picking from financial inventory valuation.
   - Financial costing uses perpetual weighted-average cost snapshots. Historical invoice lines never recalculate backwards when raw material prices shift.
3. **Two-Stage Production:**
   - Bulk production (e.g., frying bulk murukku) and packaging (e.g., 200g / 500g nitrogen-sealed packets) are distinct production run stages with individual yields and waste tracking.
4. **GST Snapshots:**
   - Historical invoices are immutable. Tax rates, HSN codes, and computed CGST/SGST/IGST values are snapshotted on the invoice lines.
5. **Shop / Customer Registration Workflow:**
   - Salesman submissions of new retail shops start as `PENDING`.
   - Admin reviews and approves/rejects with audit trail logging.
   - Concurrency-safe code generation generates unique customer codes per company (`CST-00001`).

---

## 6. Audit Logging & Security Standards

1. **Immutable Audit Trail:**
   - The `audit_logs` table is append-only. Triggers prevent any `UPDATE` or `DELETE`.
   - Every administrative change (user invite, role change, status toggle, price list alteration, shop approval) must generate an audit log record.
2. **No Secret Leaks:**
   - Passwords, invitation token secrets, session tokens, and webhook secrets must **never** be logged into `audit_logs` or console output.
3. **Environment Secrets:**
   - Secrets belong exclusively in `.env.local` (local development) and Vercel/Supabase environment vaults.
   - Never commit `.env` or credentials to Git.
