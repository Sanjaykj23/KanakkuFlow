# KanakkuFlow ERP — Operations & Production Administration Runbook

## 1. System Administration & Daily Operations

This operational runbook provides daily procedures, deployment guidelines, performance monitoring, and incident response workflows for the KanakkuFlow engineering and DevOps teams.

---

## 2. Daily Operational Routine

| Time (IST) | Target Activity | Responsible Role | Verification Method |
| :--- | :--- | :--- | :--- |
| **08:00 AM** | Health Check & Connection Pool Audit | DevOps / On-Call | Query `GET /api/health` $\rightarrow$ Confirm `status: "UP"`, `dbLatencyMs < 25ms`. |
| **08:30 AM** | Daily Production Reconcile Dry-Run | Production Admin | Execute `runSystemReconciliationAction({ category: "INVENTORY" })` $\rightarrow$ Confirm zero orphaned reservations. |
| **01:00 PM** | Mid-Day Dispatch & Ledger Check | Finance / Accountant | Verify dispatches posted align with invoice debits in `customer_receivables_ledger`. |
| **07:00 PM** | End-of-Day Complete System Audit | System Admin / Owner | Run Complete Audit on `/reports/reconciliation` $\rightarrow$ Confirm 100% Health Score. |
| **02:00 AM** | Automated Database Full Snapshot | Supabase Automated | Verify automated WAL archive in Supabase Storage Vault. |

---

## 3. Deployment Workflow

KanakkuFlow follows an automated Continuous Deployment pipeline via Git:

```
[ Local Development / Branch ]
              |
         (pnpm test) ---> 117 Tests Must Pass
              |
    (git push origin main)
              |
[ GitHub Actions / Vercel Webhook ]
              |
    (Next.js Build & Lint)
              |
[ Vercel Edge / Serverless Production ]
```

### Deployment Commands:
```bash
# 1. Pre-Deployment Verification
pnpm test
pnpm exec tsc --noEmit
pnpm lint

# 2. Database Migration (If new SQL migrations exist)
supabase db push --project-ref <PRODUCTION_PROJECT_REF>

# 3. Trigger Production Deployment
git push origin main
```

---

## 4. Monitoring & Alerting

### 1. Health Check Endpoint (`/api/health`):
Set up an external uptime monitor (e.g., BetterStack, UptimeRobot, or Cloudflare Health Checks) pinging:
```
GET https://app.kanakkuflow.com/api/health
```
- **Interval:** 60 seconds
- **Alert Condition:** HTTP status code $\neq 200$ or `responseTimeMs > 2000`.

### 2. Database Metric Thresholds:
- **CPU Utilization:** Alert at $> 75\%$ sustained for 5 minutes.
- **Connection Pool Exhaustion:** Alert if PgBouncer active connections exceed 80% of `pool_size`.
- **Disk Space:** Alert if database volume exceeds 80% capacity.

---

## 5. Incident Response Protocols

### Incident 1: Orphaned Stock Reservations
- **Symptom:** Physical batch shows available stock, but allocation fails with `"Insufficient unreserved stock"`.
- **Diagnosis:** Active reservations exist referencing a sales order or production run that was cancelled or closed.
- **Resolution:**
  1. Open `/reports/reconciliation` and navigate to the **Inventory** tab.
  2. Locate the anomaly titled `Orphaned Sales Order Reservation`.
  3. Click the referenced order number and confirm status is `CANCELLED`.
  4. Execute the authorized stock reservation release action to restore batch availability.

### Incident 2: Customer Ledger vs. Open Invoices Mismatch
- **Symptom:** Customer's statement shows a balance different from the sum of open invoices.
- **Diagnosis:** An unallocated payment receipt exists or a payment allocation was partially posted.
- **Resolution:**
  1. Open `/reports/reconciliation` $\rightarrow$ **Financial** tab.
  2. View `CUSTOMER_LEDGER_RECEIVABLES_MISMATCH` finding for the customer.
  3. Inspect `/finance/payments` for unallocated payments from this customer.
  4. Allocate remaining unallocated funds to oldest open invoices via FIFO payment allocation.

### Incident 3: Slow Reporting Queries
- **Symptom:** Management dashboard takes $> 3$ seconds to load metrics.
- **Diagnosis:** Missing composite indexes or date range queries causing table scans.
- **Resolution:**
  1. Confirm that migration `20261125000001_phase9_reports_hardening.sql` is applied.
  2. Check `EXPLAIN ANALYZE` on `public.get_management_dashboard_metrics()`.
  3. Verify that `idx_so_company_date_status`, `idx_inv_company_date_status`, and `idx_crl_company_trans_date` are being utilized by PostgreSQL planner.
