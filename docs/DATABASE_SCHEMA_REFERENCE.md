# KanakkuFlow ERP — Complete Database Schema Reference (Phases 1–9)

## 1. Core Platform & Multi-Tenant Entities (Phase 1)

### `public.companies`
- `id` (UUID, PK) — Unique company identifier.
- `legal_name` (VARCHAR) — Statutory registered legal entity name.
- `trade_name` (VARCHAR) — Brand / operating trade name.
- `gstin` (VARCHAR) — 15-character Goods and Services Tax Identification Number.
- `pan` (VARCHAR) — 10-character Permanent Account Number.
- `address_line1`, `city`, `state`, `postal_code`, `country` (TEXT).
- `created_at`, `updated_at` (TIMESTAMPTZ).

### `public.branches`
- `id` (UUID, PK) — Unique branch identifier.
- `company_id` (UUID, FK $\rightarrow$ `companies.id`) — Tenant owner.
- `code` (VARCHAR) — Unique alphanumeric branch code (e.g. `BR01`, `PLANT1`).
- `name` (VARCHAR) — Branch name.
- `branch_type` (ENUM: `PLANT`, `WAREHOUSE`, `OFFICE`).
- `gstin` (VARCHAR, NULL) — Branch-specific GSTIN if separately registered.
- `is_active` (BOOLEAN).

### `public.company_memberships`
- `id` (UUID, PK).
- `company_id` (UUID, FK $\rightarrow$ `companies.id`).
- `user_id` (UUID, FK $\rightarrow$ `auth.users.id`).
- `role` (ENUM: `OWNER`, `ADMIN`, `SUPERVISOR`, `SALESMAN`, `ACCOUNTANT`, `PRODUCTION`, `WAREHOUSE`).
- `status` (ENUM: `ACTIVE`, `INVITED`, `SUSPENDED`).

### `public.membership_branches`
- Maps non-admin users to specific operational branches for branch-level data isolation.

### `public.audit_logs`
- `id` (UUID, PK).
- `company_id` (UUID, FK $\rightarrow$ `companies.id`).
- `user_id` (UUID, NULL).
- `action` (VARCHAR) — `LOGIN`, `CREATE`, `UPDATE`, `APPROVE`, `PRICE_OVERRIDE`, etc.
- `entity_name` (VARCHAR) — Target table name.
- `entity_id` (VARCHAR) — Target record UUID.
- `old_values`, `new_values` (JSONB) — Pre- and post-mutation state diff.
- `ip_address`, `user_agent` (TEXT/INET).
- *Guarded by trigger:* `trg_prevent_audit_logs_mutation` (Strictly append-only).

---

## 2. Master Data Entities (Phase 2)

### `public.units`
- Measurement units (`kg`, `g`, `litre`, `box`, `packet`, `piece`). Supports decimal precision.

### `public.hsn_tax_rates`
- HSN Code (e.g., `1905` for Murukku / Bakery snacks).
- Tax Rates: `igst_rate`, `cgst_rate`, `sgst_rate` (NUMERIC(5,2)).

### `public.items`
- Product catalog covering `RAW_MATERIAL`, `PACKAGING`, `SEMI_FINISHED` (Bulk WIP), `FINISHED_GOODS`.
- `sku` (VARCHAR, UNIQUE per company).
- `hsn_id` (UUID, FK $\rightarrow$ `hsn_tax_rates.id`).
- `base_unit_id` (UUID, FK $\rightarrow$ `units.id`).
- `shelf_life_days` (INT).
- `cost_price_paisa`, `selling_price_paisa` (BIGINT).

### `public.warehouses`
- Physical storage locations linked to specific branches.

---

## 3. Procurement & Inward Stock Ledger (Phase 3)

### `public.purchase_orders` & `public.purchase_order_lines`
- Commercial orders placed with raw material and packaging suppliers.
- Tracks `status`: `DRAFT`, `SUBMITTED`, `APPROVED`, `PARTIALLY_RECEIVED`, `COMPLETED`, `CANCELLED`.

### `public.goods_receipt_notes` (GRN) & `public.grn_lines`
- Inward physical gate receipt and QC verification.
- Recording a GRN automatically creates `inventory_batches` and posts positive records to `stock_movements`.

### `public.stock_movements` (Immutable Physical Ledger)
- `id` (UUID, PK).
- `company_id`, `branch_id`, `warehouse_id`, `item_id`, `batch_id`.
- `movement_type` (`GRN_RECEIPT`, `PRODUCTION_CONSUMPTION`, `PRODUCTION_OUTPUT`, `STOCK_TRANSFER_IN`, `STOCK_TRANSFER_OUT`, `SALES_DISPATCH`, `STOCK_ADJUSTMENT_IN`, `STOCK_ADJUSTMENT_OUT`).
- `quantity` (NUMERIC(14,4)) — **Signed invariant: Positive for inflows, Negative for outflows.**
- `unit_cost_paisa` (BIGINT).
- `reference_type`, `reference_id` (Document linkage).
- *Guarded by trigger:* `trg_prevent_stock_movement_mutation` (Append-only).

---

## 4. Inventory Batches & FEFO Control (Phase 4)

### `public.inventory_batches`
- Physical batch tracking: `batch_number`, `manufacturing_date`, `expiry_date`.
- `current_qty` (NUMERIC(14,4)) — Actual physical on-hand stock.
- `reserved_qty` (NUMERIC(14,4)) — Stock allocated to active sales orders or production runs.
- `unit_cost_paisa` (BIGINT) — Perpetual weighted-average cost snapshot.
- `batch_status` (`ACTIVE`, `QUARANTINE`, `BLOCKED`, `EXPIRED`, `CONSUMED`).
- *Constraint:* `CHECK (current_qty >= reserved_qty)`.

### `public.stock_reservations`
- Binds a specific batch quantity to a `SALES_ORDER` or `PRODUCTION_RUN`. Prevents double-allocation.

### `public.stock_transfers` & `public.stock_adjustments`
- Inter-warehouse transfers and physical stock count audit adjustments.

---

## 5. Production & Manufacturing Costing (Phase 5)

### `public.bills_of_materials` (BOM) & `public.bom_items`
- Standard manufacturing recipe for finished goods and bulk intermediates.
- Declares standard raw material ratios and standard batch yields.

### `public.production_orders` & `public.production_order_lines`
- Manufacturing execution orders.
- Tracks input material consumption vs. actual output yield.
- Computes actual production cost rollup based on consumed batch unit costs.

---

## 6. Sales & Customer Orders (Phase 6)

### `public.customers`
- Retail shop accounts.
- `shop_name`, `owner_name`, `phone`, `gstin`, `credit_limit_paisa`, `outstanding_balance_paisa`.
- Approval workflow: salesman submissions start as `PENDING_APPROVAL`.

### `public.sales_orders` & `public.sales_order_lines`
- Customer sales commitments.
- Workflow: `DRAFT` $\rightarrow$ `SUBMITTED` $\rightarrow$ `APPROVED` $\rightarrow$ `ALLOCATED` (FEFO stock reserved) $\rightarrow$ `READY_FOR_DISPATCH` $\rightarrow$ `DISPATCHED` $\rightarrow$ `CLOSED`.

---

## 7. Invoicing, Receivables & Dispatches (Phase 7)

### `public.dispatches` & `public.dispatch_lines`
- Physical warehouse packing and vehicle loading.
- Deducts batch `reserved_qty` and `current_qty` and records negative `SALES_DISPATCH` stock movements.

### `public.sales_invoices` & `public.sales_invoice_lines`
- Statutory GST Tax Invoices.
- Columns: `invoice_number`, `invoice_date`, `subtotal_paisa`, `tax_amount_paisa`, `total_amount_paisa`, `paid_amount_paisa`, `outstanding_amount_paisa`.
- Frozen lines snapshot: `item_name`, `hsn_code`, `unit_price_paisa`, `tax_rate`, `cgst_amount_paisa`, `sgst_amount_paisa`, `igst_amount_paisa`.

### `public.customer_payments` & `public.payment_allocations`
- Cash/bank receipt recording with support for partial payments and multi-invoice FIFO/custom allocation.

### `public.customer_receivables_ledger` (Immutable Financial Ledger)
- Double-entry accounting ledger.
- `debit_paisa` (invoices posted) vs. `credit_paisa` (payments and credit notes applied).
- *Guarded by trigger:* `trg_prevent_crl_mutation` (Append-only).

---

## 8. Data Reconciliation & Reporting (Phase 9)

### `public.reconciliation_runs`
- `id` (UUID, PK).
- `company_id` (UUID, FK $\rightarrow$ `companies.id`).
- `run_by_user_id` (UUID, FK $\rightarrow$ `auth.users.id`).
- `status` (`CLEAN`, `DISCREPANCIES_FOUND`, `FAILED`).
- `health_score` (INT, 0-100).
- `critical_count`, `error_count`, `warning_count` (INT).
- `summary`, `findings` (JSONB).
- `created_at` (TIMESTAMPTZ).
- *Guarded by trigger:* `trg_prevent_reconciliation_runs_mutation` (Append-only).

### Stored Reporting RPCs:
1. `public.get_management_dashboard_metrics(p_start_date, p_end_date, p_branch_id)`
2. `public.get_sales_analytics(p_start_date, p_end_date, p_branch_id)`
3. `public.get_inventory_analytics(p_branch_id, p_warehouse_id)`
4. `public.get_production_analytics(p_start_date, p_end_date, p_branch_id)`
5. `public.run_system_reconciliation(p_category)`
