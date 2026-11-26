# KanakkuFlow ERP — Production Deployment Readiness & Preflight Checklist

## 1. Production Pre-Flight Checklist

Before launching KanakkuFlow ERP into production, verify that every checkpoint below is confirmed by the engineering team.

### A. Database & Schema Verification
- [x] **Migrations Sequence:** All 9 migration files applied in chronological order without syntax or constraint errors.
  1. `20261121000001_initial_core_schema.sql` (Core Auth, Companies, Branches, Audit)
  2. `20261123000001_phase2_master_data.sql` (Items, Units, HSN/GST, Suppliers, Warehouses)
  3. `20261124000001_phase3_procurement_grn.sql` (POs, GRNs, Stock Movements, Bills)
  4. `20261124000002_phase4_inventory_batches_transfers.sql` (Batches, FEFO, Transfers, Adjustments)
  5. `20261124000003_phase5_production_costing.sql` (BOMs, Production Orders, Cost Rollups)
  6. `20261124000004_phase6_sales_order_management.sql` (Customers, Sales Orders, Pricing Rules, Reservations)
  7. `20261124000005_phase7_invoicing_finance.sql` (Invoices, Payments, Ledger, Dispatches, Credit Notes)
  8. `20261125000001_phase9_reports_hardening.sql` (Reporting Composite Indexes, Analytics RPCs)
  9. `20261125000002_phase9_reconciliation.sql` (Data Reconciliation Engine & Audit Logs)
- [x] **Row Level Security (RLS) Active:** Verified on every table. Unauthenticated or unverified tenant requests return zero rows.
- [x] **`search_path` Security Invariant:** All `SECURITY DEFINER` functions strictly enforce:
  ```sql
  SET search_path = public, pg_temp;
  ```
- [x] **Append-Only Triggers Enforced:** Verified that `UPDATE` or `DELETE` statements on `public.stock_movements`, `public.customer_receivables_ledger`, `public.audit_logs`, and `public.reconciliation_runs` raise explicit PostgreSQL exceptions.

### B. Security & Secret Safeguards
- [x] **No Leaked Service Keys:** `SUPABASE_SERVICE_ROLE_KEY` is strictly confined to server-side code (`src/lib/supabase/admin.ts`). Never prefixed with `NEXT_PUBLIC_` or bundled in client scripts.
- [x] **Integer Paisa Invariant:** Verified that all financial columns are `BIGINT` paisa. No JavaScript floating-point arithmetic is permitted in authoritative calculations.
- [x] **HTTP Security Headers:** Configured in `next.config.mjs` (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security: max-age=63072000`).
- [x] **Health Check Endpoint:** `/api/health` returns status `UP` with database latency and memory diagnostics.

---

## 2. Environment Configuration Vault

### Required Production Environment Variables:

| Variable Name | Required | Target Platform | Description |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Vercel (All) | Production Supabase HTTPS Endpoint (e.g. `https://xyz.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Vercel (All) | Production Supabase Anonymous Public Key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Vercel (Server Only) | Supabase Admin Service Role Key (Bypasses RLS for secure server actions) |
| `NEXT_PUBLIC_APP_URL` | Yes | Vercel (All) | Canonical URL (e.g. `https://app.kanakkuflow.com`) |
| `NODE_ENV` | Yes | Vercel (All) | Must be `production` |

---

## 3. Database Connection Pooling Architecture

Supabase provides built-in PgBouncer pooling. For Next.js Serverless deployments:

```
[ Next.js App Router / Server Actions ]
                  |
         (Transaction Mode)
                  |
        [ Supabase PgBouncer (Port 6543) ]
                  |
        [ PostgreSQL 15.1 Core Database ]
```

### Configuration Rules:
1. **Server Actions & API Routes (Port 6543):**
   - Use PgBouncer in **Transaction Mode**. Serverless Lambdas open and close connections rapidly; transaction pooling ensures connection reusability without exhausting PostgreSQL's `max_connections` limit.
2. **Migrations & DDL Commands (Port 5432):**
   - Direct connection to port 5432 is required for `supabase db push` or executing DDL scripts, as transaction poolers do not support prepared statements or transactional DDL locks.

---

## 4. Production Smoke Test Plan

Execute this 10-step end-to-end smoke test immediately after deploying to production:

| Step | Action | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :--- |
| **1. Health Check** | `GET /api/health` | HTTP 200, `status: "UP"`, `dbLatencyMs < 50` | [ ] |
| **2. Auth Flow** | Login as `admin@kanakkuflow.local` | Authenticated session created, redirected to `/dashboard` | [ ] |
| **3. Multi-Tenant Scope** | Inspect network requests for `x-company-id` | Verified company ID passed in headers | [ ] |
| **4. Master Data** | View `/master/items` | Item catalog loads with correct unit assignments and HSN codes | [ ] |
| **5. Procurement** | Create PO $\rightarrow$ GRN $\rightarrow$ Putaway | Inventory batch created with batch number and expiry date | [ ] |
| **6. Production** | Create Production Run $\rightarrow$ Complete Run | Raw materials consumed (negative movement), finished goods created | [ ] |
| **7. Sales Order** | Create SO $\rightarrow$ Approve $\rightarrow$ Allocate | Stock reserved using FEFO; batch `reserved_qty` updated | [ ] |
| **8. Invoicing** | Post Dispatch $\rightarrow$ Generate GST Invoice | Tax invoice generated with CGST/SGST split and customer ledger debit | [ ] |
| **9. Payment** | Record Customer Payment $\rightarrow$ Allocate | Ledger credit recorded; invoice `outstanding_amount_paisa` decremented | [ ] |
| **10. Reconciliation** | Navigate to `/reports/reconciliation` $\rightarrow$ Run Audit | System audit reports 100% Health Score, status `CLEAN` | [ ] |
