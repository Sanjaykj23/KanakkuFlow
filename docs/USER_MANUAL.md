# KanakkuFlow ERP — Operational User Manual (By Role)

This user manual provides step-by-step operational workflows tailored for Indian food manufacturing businesses (e.g. Packaged Snacks, Murukku, Mixture, Ribbon Pakoda).

---

## 1. Owner Operational Guide

As the **`OWNER`**, you possess complete strategic oversight across companies, plants, financial margins, and security logs.

### Key Workflows:
1. **Executive Cockpit Review (`/dashboard`):**
   - View real-time aggregated sales today, month-to-date, customer outstanding balances, and total warehouse stock valuation.
   - Filter by specific branch plant to compare inter-plant performance.
2. **Running System Reconciliation (`/reports/reconciliation`):**
   - Click **Run Complete Audit** to trigger the automated 9-point cross-ledger integrity check.
   - Verify that your **Audit Health Score** is 100%. If anomalies are flagged (e.g. stock movement drift or orphaned reservations), follow the **Actionable Fix** recommendations.
3. **Reviewing the Immutable Audit Trail (`/audit-logs`):**
   - Review all administrative actions, price list alterations, and state transitions.
   - Click any log entry to view the exact JSON diff comparing `old_values` with `new_values`.

---

## 2. Production Operator Guide

As the **`PRODUCTION`** operator, you are responsible for recipes (BOMs), executing manufacturing runs, and logging yields and wastage.

### Key Workflows:
1. **Defining a Bill of Materials (BOM) (`/production/boms`):**
   - Select Output Product (e.g., *Bulk Murukku Fried Batch — 50kg*).
   - Add Raw Material Lines:
     - Rice Flour: $35.00\text{ kg}$
     - Urad Dal Flour: $10.00\text{ kg}$
     - Cooking Oil: $5.00\text{ kg}$
     - Spices & Salt: $1.50\text{ kg}$
   - Save BOM.
2. **Executing a Production Run (`/production/orders`):**
   - Click **Create Production Order** and select the target BOM.
   - Reserve materials: System locks batches using FEFO.
   - Click **Start Run**: Physical status shifts to `IN_PROGRESS`.
   - On completion, enter **Actual Output Qty** (e.g. $48.50\text{ kg}$) and **Wastage Qty** (e.g. $1.50\text{ kg}$).
   - Click **Complete Run**: System automatically creates a new batch for the finished goods with computed perpetual unit cost and registers negative stock movements for consumed ingredients.

---

## 3. Warehouse Clerk Guide

As the **`WAREHOUSE`** clerk, you manage physical goods receipts, storage bin locations, FEFO batch picking, and dispatch loading.

### Key Workflows:
1. **Goods Receipt (GRN) Inwarding (`/inventory/grn`):**
   - Select Purchase Order and enter incoming vendor delivery challan.
   - Enter physical batch number, manufacturing date, and vendor expiry date.
   - Accept inspected quantities: System creates active `inventory_batches` and updates stock ledger.
2. **FEFO Picking for Approved Sales Orders (`/sales/orders`):**
   - Select order in `APPROVED` status and click **Auto-Allocate Stock**.
   - System automatically allocates batches expiring soonest (**First-Expired, First-Out**).
3. **Dispatch & Loading (`/dispatch`):**
   - Review allocated order lines and assign delivery vehicle number.
   - Click **Post Dispatch**: Physical stock is decremented from warehouse batches.

---

## 4. Sales Representative Guide

As the **`SALESMAN`**, you are on the route registering retail shops and booking customer sales orders.

### Key Workflows:
1. **Registering a New Retail Shop (`/customers/new`):**
   - Enter Shop Legal Name (e.g., *Sri Murugan Sweet & Snacks*).
   - Enter Owner Name, Mobile Number, GSTIN (if registered), and Route Address.
   - Submit for approval: Shop enters `PENDING_APPROVAL` status until reviewed by Admin.
2. **Booking a Sales Order (`/sales/orders/new`):**
   - Select Customer and Delivery Branch Plant.
   - Add Product Line Items (e.g., *200g Murukku Pouch — 50 boxes*).
   - Price and GST taxes are automatically computed based on customer price tier and delivery state.
   - Check customer's existing credit limit and outstanding balance before submitting.

---

## 5. Accountant Guide

As the **`ACCOUNTANT`**, you oversee GST tax invoices, credit management, customer payments, and statutory financial ledgers.

### Key Workflows:
1. **Generating GST Tax Invoices (`/finance/invoices`):**
   - Select posted dispatch and click **Generate Tax Invoice**.
   - System auto-generates consecutive tax invoice number (e.g. `INV-2026-00042`).
   - Verifies place of supply and computes CGST + SGST (33 - Tamil Nadu intra-state) or IGST (inter-state).
   - Posts debit to `customer_receivables_ledger`.
2. **Recording Customer Payments (`/finance/payments`):**
   - Click **Record Payment** $\rightarrow$ Select Customer, Payment Date, Mode (NEFT, UPI, Cheque, Cash), and Amount.
   - Allocate payment to outstanding open invoices using **FIFO Auto-Allocate** or custom line allocation.
   - Posts credit to `customer_receivables_ledger` and updates invoice outstanding balance.
