# KanakkuFlow ERP — Backup, Disaster Recovery & High-Availability Runbook

## 1. Overview & Objectives

KanakkuFlow is an enterprise multi-tenant ERP system governing mission-critical manufacturing operations, inventory valuations, statutory GST invoices, and financial receivables. Data loss or corruption directly affects production lines and statutory compliance under Indian tax law.

### Target Recovery Metrics:
- **Recovery Point Objective (RPO):** $\le \mathbf{5\text{ minutes}}$ (Maximum allowable data loss window).
- **Recovery Time Objective (RTO):** $\le \mathbf{60\text{ minutes}}$ (Maximum allowable downtime during total regional failover).
- **Statutory Retention Invariant:** **6 years (72 months)** minimum retention for all GST tax invoices, credit notes, payment receipts, and customer ledgers pursuant to **Section 36 of the Central Goods and Services Tax (CGST) Act, 2017**.

---

## 2. Backup Architecture & Scheduling

| Backup Type | Frequency | Tool / Mechanism | Storage Target | Retention Period |
| :--- | :--- | :--- | :--- | :--- |
| **Continuous WAL Archiving** | Continuous (streaming) | Supabase Physical WAL Archiving (pg_wal) | Encrypted S3 / Cloud Storage | 30 Days (PITR Window) |
| **Automated Daily Snapshot** | Every 24 hours (02:00 IST) | Supabase Managed Backup (`pg_dump` full) | Multi-region Georedundant Vault | 90 Days |
| **Monthly Milestone Archive** | 1st of every month | Encrypted custom logical dump (`pg_dump -Fc`) | AWS S3 Glacier Deep Archive | **7 Years (Statutory)** |
| **Pre-Migration Snapshot** | Prior to any DDL execution | Manual snapshot trigger (`pg_dump`) | Isolated Hot Storage | 14 Days post-migration |

---

## 3. Point-in-Time Recovery (PITR) Execution Procedure

Point-in-Time Recovery allows restoring the database to the exact second immediately prior to any accidental deletion, unauthorized data tampering, or catastrophic migration error.

### Step-by-Step PITR Runbook:

1. **Declare Incident & Halt Application Traffic:**
   - Put Next.js into maintenance mode by setting `MAINTENANCE_MODE=true` in Vercel environment variables.
   - Alternatively, revoke public connections on Supabase to prevent further client mutations.

2. **Determine Target Timestamp:**
   - Query `public.audit_logs` or PostgreSQL transaction logs to identify the exact timestamp $T_{\text{target}}$ of the incident:
     ```sql
     SELECT id, action, entity_name, created_at 
     FROM public.audit_logs 
     ORDER BY created_at DESC 
     LIMIT 20;
     ```
   - Target timestamp should be set to:
     $$T_{\text{restore}} = T_{\text{incident}} - 10\text{ seconds}$$

3. **Trigger PITR via Supabase Dashboard / CLI:**
   ```bash
   # Via Supabase CLI
   supabase backups restore --project-ref <PROJECT_ID> --recovery-target-time "2026-11-26T04:30:00Z"
   ```

4. **Verify Restored Database Invariants:**
   - Run the automated reconciliation runner via CLI or SQL:
     ```sql
     SELECT public.run_system_reconciliation('ALL');
     ```
   - Confirm that the `status` returns `'CLEAN'` and `health_score = 100`.

5. **Re-enable Application Traffic:**
   - Remove `MAINTENANCE_MODE=true` and confirm `/api/health` reports status `UP` with nominal latency ($< 15\text{ms}$).

---

## 4. Disaster Recovery (DR) Regional Failover

In the event of a total cloud region failure:

```
[ Primary Region (Mumbai) ] ---- Continuous Sync ----> [ Secondary DR Region (Hyderabad) ]
           |                                                            |
     (Failure Event)                                            (Promote to Primary)
           |                                                            |
[ DNS Cutover (Cloudflare) ] -----------------------------> Point API to Hyderabad Vault
```

### Failover Checklist:
1. **Promote Read Replica:**
   - Access secondary region database and execute `SELECT pg_promote();`.
2. **Update Application Connection String:**
   - Update `POSTGRES_URL` and `NEXT_PUBLIC_SUPABASE_URL` in the Vercel production environment vault to point to the promoted instance.
3. **Redeploy Edge Functions:**
   - Deploy Supabase Edge Functions to the secondary region endpoint.
4. **Run Smoke Tests:**
   - Execute the Phase 9 automated test suite (`pnpm test`) against the secondary instance.

---

## 5. Monthly Backup Verification & Test Restore Routine

Backups that are not tested cannot be trusted. On the **first Sunday of every month**, the operations engineer must perform a test restore:

1. Download the latest automated snapshot:
   ```bash
   supabase backups download --project-ref <PROD_PROJECT_ID> --output latest_prod_backup.dump
   ```
2. Spin up an isolated staging test container:
   ```bash
   docker run --name restore-test -e POSTGRES_PASSWORD=postgres -p 5439:5432 -d supabase/postgres:15.1
   ```
3. Restore the dump into the test container:
   ```bash
   pg_restore -h localhost -p 5439 -U postgres -d postgres latest_prod_backup.dump
   ```
4. Execute Data Integrity Verification Suite:
   - Verify row counts on `companies`, `inventory_batches`, `stock_movements`, `sales_invoices`, `customer_receivables_ledger`.
   - Run `SELECT public.run_system_reconciliation('ALL');` and confirm output matches production audit scores.
5. Log verification in `docs/backup_audit_log.csv` with operator signature and completion timestamp.

---

## 6. Statutory Compliance & 6-Year Retention Policy

Under **Section 36 of the CGST Act, 2017**, every registered taxable person must keep and maintain books of account or other records until the expiry of **72 months from the due date of furnishing of annual return** for the year pertaining to such accounts.

### Data Tables Governed by Statutory Retention:
1. `public.sales_invoices` & `public.sales_invoice_lines` (GST Tax Invoices).
2. `public.customer_payments` & `public.payment_allocations` (Bank & Cash receipts).
3. `public.customer_receivables_ledger` (Financial ledger trail).
4. `public.stock_movements` (Authoritative stock ledger).
5. `public.audit_logs` (Administrative security & price override history).

### Retention Enforcement:
- The database triggers `trg_prevent_stock_movement_mutation`, `trg_prevent_crl_mutation`, and `trg_prevent_reconciliation_runs_mutation` physically prevent any `DELETE` or `UPDATE` queries on ledger records.
- Records older than 3 years may be archived to cold storage (PostgreSQL partitioned table or S3 Parquet), but **must remain readable for statutory audits**.

---

## 7. Company Offboarding & Complete Tenant Export Procedure

If a client company requests offboarding or a portable statutory data archive:

### Tenant Archive Script:
```bash
# Export all records for a specific company_id into a standalone, portable JSON/SQL bundle
COMPANY_ID="c8f6a310-8b1e-4512-b132-7e9b41801234"

psql "$DATABASE_URL" -c "
COPY (
    SELECT json_build_object(
        'company', (SELECT row_to_json(c) FROM public.companies c WHERE c.id = '$COMPANY_ID'),
        'invoices', (SELECT json_agg(row_to_json(i)) FROM public.sales_invoices i WHERE i.company_id = '$COMPANY_ID'),
        'invoice_lines', (SELECT json_agg(row_to_json(il)) FROM public.sales_invoice_lines il WHERE il.company_id = '$COMPANY_ID'),
        'payments', (SELECT json_agg(row_to_json(p)) FROM public.customer_payments p WHERE p.company_id = '$COMPANY_ID'),
        'receivables_ledger', (SELECT json_agg(row_to_json(l)) FROM public.customer_receivables_ledger l WHERE l.company_id = '$COMPANY_ID'),
        'inventory_batches', (SELECT json_agg(row_to_json(b)) FROM public.inventory_batches b WHERE b.company_id = '$COMPANY_ID'),
        'stock_movements', (SELECT json_agg(row_to_json(sm)) FROM public.stock_movements sm WHERE sm.company_id = '$COMPANY_ID'),
        'audit_logs', (SELECT json_agg(row_to_json(al)) FROM public.audit_logs al WHERE al.company_id = '$COMPANY_ID')
    )
) TO STDOUT;" > "export_company_${COMPANY_ID}.json"
```

1. Generate SHA-256 checksum of export: `sha256sum "export_company_${COMPANY_ID}.json" > checksum.txt`.
2. Encrypt archive with client's GPG public key.
3. Deliver securely via signed S3 pre-signed URL (24-hour expiration).
4. Retain read-only statutory archive for the 72-month period in company cold archives.
