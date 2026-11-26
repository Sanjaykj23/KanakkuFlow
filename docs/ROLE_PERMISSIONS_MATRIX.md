# KanakkuFlow ERP — Role & Permissions Matrix

This document defines the authoritative access control matrix for all **7 hierarchical roles** across all modules, ledger operations, and report views.

---

## 1. Role Definitions & Scope

| Role Code | Role Name | Tenancy Scope | Operational Mandate |
| :--- | :--- | :--- | :--- |
| **`OWNER`** | Company Owner | Multi-Company | Complete governance, audit logs, financial reports, user management, and executive overrides. |
| **`ADMIN`** | Operations Director | Company-wide | Manages daily operations, master data, production, and branch operations. Cannot modify Owner/Admin accounts. |
| **`ACCOUNTANT`** | Finance Officer | Company-wide | Full read/write on invoices, customer ledgers, payment allocation, and GST tax filings. Cannot modify recipes or post stock. |
| **`SUPERVISOR`** | Plant / Branch Supervisor | Assigned Branch | Supervises branch manufacturing runs, order approvals, inventory levels, and dispatch. |
| **`SALESMAN`** | Route Sales Representative | Assigned Route/Customers | Registers retail shops, books sales orders, checks customer outstanding. Stripped of cost and margin data. |
| **`PRODUCTION`** | Plant Production Operator | Assigned Plant | Executes production runs, logs raw material usage and actual yields against BOMs. Stripped of pricing data. |
| **`WAREHOUSE`** | Warehouse & Dispatch Clerk | Assigned Warehouse | Performs GRN putaway, batch inspection, FEFO picking, transfers, and vehicle dispatch. Stripped of financial amounts. |

---

## 2. Comprehensive Module Permissions Matrix

**Legend:**
- **`CRUD`**: Create, Read, Update, Delete (or approve/post)
- **`RO`**: Read-Only
- **`BRANCH_RO`**: Read-Only, strictly scoped to assigned branch(es)
- **`BRANCH_RW`**: Read/Write, strictly scoped to assigned branch(es)
- **`STRIPPED`**: Visible with confidential columns (costs, margins, pricing) sanitized to 0
- **`DENIED`**: Completely prohibited by Row Level Security (RLS) and server actions

| Module / Operational Capability | `OWNER` | `ADMIN` | `ACCOUNTANT` | `SUPERVISOR` | `SALESMAN` | `PRODUCTION` | `WAREHOUSE` |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Company & Branch Master** | CRUD | RO | RO | RO | DENIED | DENIED | DENIED |
| **User & Role Membership** | CRUD | CRUD (Non-Admin) | DENIED | DENIED | DENIED | DENIED | DENIED |
| **HSN & GST Tax Master** | CRUD | CRUD | CRUD | RO | RO | DENIED | DENIED |
| **Items & Units Catalog** | CRUD | CRUD | RO | RO | RO | RO | RO |
| **Price Lists & Tiers** | CRUD | CRUD | RO | RO | RO (Selling Only)| DENIED | DENIED |
| **Purchase Orders & Bills** | CRUD | CRUD | CRUD | BRANCH_RO | DENIED | DENIED | DENIED |
| **Goods Receipt (GRN)** | CRUD | CRUD | RO | BRANCH_RW | DENIED | DENIED | BRANCH_RW |
| **Physical Inventory & Batches**| CRUD | CRUD | RO | BRANCH_RW | DENIED | BRANCH_RO | BRANCH_RW (No Cost) |
| **Stock Adjustments & Audit** | CRUD | CRUD | DENIED | BRANCH_RW | DENIED | DENIED | BRANCH_RW |
| **BOM Recipes & Standard Costs**| CRUD | CRUD | RO | BRANCH_RO | DENIED | BRANCH_RO (No Cost)| DENIED |
| **Production Order Execution** | CRUD | CRUD | DENIED | BRANCH_RW | DENIED | BRANCH_RW | DENIED |
| **Retail Shop Registrations** | CRUD | CRUD | RO | BRANCH_RW | CREATE (Pending)| DENIED | DENIED |
| **Sales Orders (Booking)** | CRUD | CRUD | RO | BRANCH_RW | BRANCH_RW | DENIED | DENIED |
| **Sales Order Allocation (FEFO)**| CRUD | CRUD | DENIED | BRANCH_RW | DENIED | DENIED | BRANCH_RW |
| **Warehouse Dispatch Loading** | CRUD | CRUD | DENIED | BRANCH_RW | DENIED | DENIED | BRANCH_RW |
| **GST Tax Invoices & Credit Notes**| CRUD | CRUD | CRUD | BRANCH_RO | DENIED | DENIED | DENIED |
| **Customer Payments & Allocations**| CRUD | CRUD | CRUD | DENIED | CREATE (Draft) | DENIED | DENIED |
| **Customer Receivables Ledger** | CRUD | CRUD | CRUD | BRANCH_RO | BRANCH_RO (Balance)| DENIED | DENIED |
| **Management Cockpit Dashboard** | FULL | FULL | FINANCIAL | BRANCH_OPS | STRIPPED | STRIPPED | STRIPPED |
| **Enterprise Sales Analytics** | FULL | FULL | FULL | BRANCH_OPS | BRANCH_SALES | DENIED | DENIED |
| **Inventory Valuation Reports** | FULL | FULL | FULL | BRANCH_QTY | DENIED | DENIED | BRANCH_QTY (No Cost)|
| **Production Yield Reports** | FULL | FULL | RO | BRANCH_YIELD| DENIED | BRANCH_YIELD| DENIED |
| **Data Reconciliation Engine** | CRUD | CRUD | CRUD | DENIED | DENIED | DENIED | DENIED |
| **Immutable Audit Logs Viewer** | FULL | DENIED | DENIED | DENIED | DENIED | DENIED | DENIED |

---

## 3. Confidential Field Stripping Rules (Enforced in `applyRoleRestrictions`)

When an API route or server action returns data to a user whose role lacks financial clearance, confidential fields are mathematically sanitized prior to serializing the JSON payload:

### 1. `SALESMAN` Restrictions:
- `purchases_total_paisa` $\rightarrow$ `0`
- `stock_valuation_paisa` $\rightarrow$ `0`
- `unit_cost_paisa` $\rightarrow$ `0`
- `margin_paisa` $\rightarrow$ `0`
- Cannot see vendor prices or company manufacturing margins.

### 2. `WAREHOUSE` Restrictions:
- All financial metrics (`sales_today_paisa`, `sales_month_paisa`, `sales_total_paisa`, `outstanding_receivables_paisa`, `total_valuation_paisa`) $\rightarrow$ `0`.
- Strictly sees physical batch quantities (`current_qty`, `reserved_qty`, `available_qty`), bin locations, and expiry dates.

### 3. `PRODUCTION` Restrictions:
- Customer details, retail selling prices, invoice values, and sales totals $\rightarrow$ `0` or stripped.
- Strictly sees product BOM ratios, batch quantities, actual yields, and raw material wastage.
