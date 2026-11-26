# KanakkuFlow ERP — Complete System Architecture Document (Phases 1–9)

## 1. System Vision & Architecture Paradigm

**KanakkuFlow** is an enterprise-grade, multi-tenant Manufacturing ERP engineered specifically for Indian packaged food and snacks manufacturers (e.g., Murukku, Mixture, Ribbon Pakoda, Confectionery).

### Core Architectural Decisions:
1. **Clean Monolith with Layered Separation:**
   - Single unified Next.js App Router application with strict boundaries between presentation, server actions, application domain services, and database storage.
   - Microservices are explicitly rejected to prevent distributed transaction failures, network latency, and eventual consistency anomalies in inventory valuation.
2. **PostgreSQL as the Authoritative Transaction Engine:**
   - Critical ACID state transitions (FEFO inventory picking, stock movements, invoice posting, payment allocations) execute inside PostgreSQL transactional functions (`SECURITY DEFINER`) with row-level locks (`FOR UPDATE`).
3. **Integer Paisa Invariant:**
   - All financial amounts are stored as 64-bit integers (`BIGINT`) representing Indian paisa ($\text{₹}1.00 = 100\text{ paisa}$).
   - Floating-point arithmetic (`FLOAT`, `DOUBLE`, JavaScript `Number`) is strictly prohibited for authoritative accounting and tax math.

```
+-----------------------------------------------------------------------------------+
|                            Next.js 15 App Router Frontend                         |
|  (Server Components, Client Shell, shadcn/ui, Tailwind CSS, Lucide Icons, Recharts)|
+-----------------------------------------------------------------------------------+
                                         |
                                (Server Actions)
                                         |
+-----------------------------------------------------------------------------------+
|                        Server Domain Layer (src/modules/*)                        |
|   Auth & RBAC   |  Procurement  |  Inventory & FEFO  |  Production  |  Finance    |
|   Reconciliation Engine  |  Reports & Analytics  |  Audit Trail & Governance       |
+-----------------------------------------------------------------------------------+
                                         |
                       (Supabase SSR / Service Role Admin)
                                         |
+-----------------------------------------------------------------------------------+
|                           Supabase PostgreSQL 15.1                                |
|   Row Level Security (RLS)  |  Append-Only Ledgers  |  ACID Transactional RPCs    |
|   Composite Indexes         |  Immutable Triggers   |  Continuous WAL Archiving   |
+-----------------------------------------------------------------------------------+
```

---

## 2. Multi-Tenant Isolation & Row Level Security (RLS)

Every database table in KanakkuFlow enforces tenant isolation using Supabase Row Level Security.

### Non-Recursive RLS Helpers:
To eliminate infinite recursion in PostgreSQL RLS policies, tenant and role resolution is handled by lightweight, cached helper functions:
- `public.current_company_id()`: Reads the verified company ID header and validates that `auth.uid()` possesses an active membership in that company.
- `public.current_user_role()`: Returns the validated `user_role` enum for the active session.
- `public.has_branch_access(p_branch_id UUID)`: Evaluates whether the user's role grants global access (`OWNER`, `ADMIN`, `ACCOUNTANT`) or requires explicit mapping in `public.membership_branches`.

### Invariant:
All `SECURITY DEFINER` functions explicitly set a fixed search path to defeat privilege escalation attacks:
```sql
SET search_path = public, pg_temp;
```

---

## 3. Hierarchical Role-Based Access Control (RBAC)

The system enforces 7 strictly defined hierarchical roles:

$$\text{OWNER} > \text{ADMIN} > \text{SUPERVISOR} / \text{SALESMAN} / \text{ACCOUNTANT} / \text{PRODUCTION} / \text{WAREHOUSE}$$

1. **`OWNER`:** Complete multi-tenant oversight. Manages companies, branches, financial reports, settings, and immutable audit logs.
2. **`ADMIN`:** Company-wide operational authority. Cannot alter `OWNER` or other `ADMIN` accounts.
3. **`ACCOUNTANT`:** Company-wide read/write on financial ledgers, GST reports, customer outstanding, and payments. Cannot alter BOM recipes or post physical stock movements.
4. **`SUPERVISOR`:** Branch-scoped operational supervisor. Oversees orders, production schedules, and dispatch for assigned branch plants.
5. **`SALESMAN`:** Branch and customer-scoped. Creates orders and registers new retail shops. Stripped of cost prices, margins, and purchase costs.
6. **`PRODUCTION`:** Branch-scoped plant operator. Access strictly to BOM recipes, production runs, and yield/wastage recording. Stripped of customer details and pricing.
7. **`WAREHOUSE`:** Branch and warehouse-scoped. Operates goods receipt (GRN), FEFO picking, stock transfers, and dispatch. Stripped of financial figures.

---

## 4. Manufacturing & Inventory Domain Rules

### 1. Two-Stage Production Architecture:
Food manufacturing separates bulk processing from packaging:
- **Stage 1 (Bulk Semi-Finished Goods):** Raw materials (flour, oil, spices) are consumed to produce bulk intermediate batches (e.g. 50 kg fried murukku).
- **Stage 2 (Packaged Finished Goods):** Bulk WIP is combined with packaging materials (printed pouches, nitrogen gas, corrugated cartons) to yield retail SKUs (e.g. 200g nitrogen-sealed packets).

### 2. FEFO Picking vs. Perpetual Weighted Average Costing:
- **Physical Picking:** Enforces First-Expired, First-Out (**FEFO**). Stock allocation prioritizes batches closest to expiry. Expired or QC-quarantined batches cannot be allocated.
- **Financial Costing:** Physical movements are decoupled from valuation. Financial inventory uses **perpetual weighted-average costing**. When raw material costs shift, historical invoice cost lines remain immutable snapshots.

---

## 5. Indian Statutory GST Invoicing & Accounting

1. **Place-of-Supply Tax Splitting:**
   - Evaluates Supplier State Code vs. Customer Delivery State Code.
   - Intra-state (e.g. 33 - Tamil Nadu $\rightarrow$ 33 - Tamil Nadu): Auto-splits tax into equal **CGST (50%) + SGST (50%)**.
   - Inter-state (e.g. 33 - Tamil Nadu $\rightarrow$ 29 - Karnataka): Computes **IGST (100%)**.
2. **Immutable Financial Snapshots:**
   - Every invoice line freezes the HSN code, tax rate, CGST/SGST/IGST amounts, unit price, and discount. Future master data price alterations never recalculate historical invoices.
3. **Authoritative Double-Entry Ledgers:**
   - `public.stock_movements`: Append-only inventory source of truth.
   - `public.customer_receivables_ledger`: Append-only customer accounting source of truth.
   - Prohibited from `UPDATE` and `DELETE` via database triggers.

---

## 6. Automated Data Reconciliation Engine (Phase 9)

An automated background and on-demand engine verifies mathematical coherence across all transactional ledgers:
- Batch Stock Quantity vs. Stock Movement Sum.
- Reserved Stock vs. Active Reservations.
- Orphaned Sales Order / Production Reservations.
- Invoice Subtotal & GST Line Tax Splits.
- Invoice Settlement Equation ($\text{Paid} + \text{Outstanding} = \text{Total}$).
- Customer Receivables Ledger vs. Unpaid Invoices.
- Production Yield Outlier Detection ($< 50\%$ or $> 125\%$).
