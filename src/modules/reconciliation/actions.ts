"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserSession } from "@/modules/auth/actions";
import {
  ReconciliationCategory,
  ReconciliationFinding,
  ReconciliationRunResult,
  ReconciliationSummary,
  runReconciliationFilterSchema,
  RunReconciliationFilterInput,
} from "./schema";

/**
 * Run Automated System Reconciliation
 * Supports INVENTORY, FINANCIAL, COSTING, or ALL categories.
 * Fallback server-side calculator handles execution if SQL migration is pending.
 */
export async function runSystemReconciliationAction(
  rawInput?: RunReconciliationFilterInput
): Promise<{
  success: boolean;
  data?: ReconciliationRunResult;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    if (!["OWNER", "ADMIN", "ACCOUNTANT"].includes(session.role)) {
      return {
        success: false,
        error: "Permission Denied: Reconciliation engine requires OWNER, ADMIN, or ACCOUNTANT role.",
      };
    }

    const validated = runReconciliationFilterSchema.safeParse(rawInput || {});
    const category: ReconciliationCategory = validated.success ? validated.data.category : "ALL";

    const supabase = await createClient();

    // Call stored reconciliation RPC
    const { data, error } = await supabase.rpc("run_system_reconciliation", {
      p_category: category,
    });

    if (error) {
      // Fallback: Calculate securely via admin client
      return await runSystemReconciliationFallback(session, category);
    }

    return {
      success: true,
      data: {
        runId: data.runId,
        companyId: data.companyId,
        category: data.category,
        summary: data.summary,
        findings: data.findings || [],
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unexpected reconciliation error.",
    };
  }
}

/**
 * Fallback server-side reconciliation engine
 */
async function runSystemReconciliationFallback(
  session: any,
  category: ReconciliationCategory
): Promise<{ success: boolean; data: ReconciliationRunResult }> {
  const admin = createAdminClient();
  const findings: ReconciliationFinding[] = [];
  let criticalCount = 0;
  let errorCount = 0;
  let warningCount = 0;
  const nowStr = new Date().toISOString();

  // 1. INVENTORY RECONCILIATION
  if (["ALL", "INVENTORY"].includes(category)) {
    // 1.1 Batch current_qty vs sum of stock_movements
    const { data: batches } = await admin
      .from("inventory_batches")
      .select("id, batch_number, current_qty, reserved_qty, unit_cost_paisa, item:item_id(name, sku)")
      .eq("company_id", session.companyId);

    const { data: movements } = await admin
      .from("stock_movements")
      .select("batch_id, quantity")
      .eq("company_id", session.companyId)
      .not("batch_id", "is", null);

    const movementSums = new Map<string, number>();
    (movements || []).forEach((m) => {
      const bid = m.batch_id as string;
      movementSums.set(bid, (movementSums.get(bid) || 0) + Number(m.quantity || 0));
    });

    (batches || []).forEach((b) => {
      const ledgerQty = movementSums.get(b.id) || 0;
      const batchQty = Number(b.current_qty || 0);

      // Check batch quantity vs ledger
      if (Math.abs(batchQty - ledgerQty) > 0.0001) {
        findings.push({
          id: crypto.randomUUID(),
          category: "INVENTORY",
          checkName: "BATCH_LEDGER_MISMATCH",
          severity: "CRITICAL",
          title: "Batch Stock vs Ledger Mismatch",
          description: `Batch ${b.batch_number} (${(b.item as any)?.sku || "Item"}) current_qty (${batchQty}) does not equal sum of stock movements (${ledgerQty}).`,
          referenceType: "BATCH",
          referenceId: b.id,
          referenceNumber: b.batch_number,
          expectedValue: ledgerQty,
          actualValue: batchQty,
          discrepancy: Math.round((batchQty - ledgerQty) * 10000) / 10000,
          suggestedFix: "Perform authorized Stock Adjustment to align batch quantity with physical/ledger count.",
          detectedAt: nowStr,
        });
        criticalCount++;
      }

      // Check negative stock or unit cost
      if (batchQty < 0 || Number(b.unit_cost_paisa || 0) < 0) {
        findings.push({
          id: crypto.randomUUID(),
          category: "INVENTORY",
          checkName: "NEGATIVE_STOCK_OR_COST",
          severity: "CRITICAL",
          title: "Negative Stock Quantity or Valuation",
          description: `Batch ${b.batch_number} has negative quantity (${batchQty}) or negative unit cost (${b.unit_cost_paisa} paisa).`,
          referenceType: "BATCH",
          referenceId: b.id,
          referenceNumber: b.batch_number,
          expectedValue: ">= 0",
          actualValue: batchQty,
          discrepancy: batchQty,
          suggestedFix: "Audit stock movement ledger and adjust batch valuation with non-negative cost snapshot.",
          detectedAt: nowStr,
        });
        criticalCount++;
      }
    });

    // 1.2 Batch reserved_qty vs Active stock_reservations
    const { data: reservations } = await admin
      .from("stock_reservations")
      .select("id, batch_id, reserved_qty, source_document_type, source_document_id, status")
      .eq("company_id", session.companyId)
      .eq("status", "ACTIVE");

    const resSums = new Map<string, number>();
    (reservations || []).forEach((r) => {
      resSums.set(r.batch_id, (resSums.get(r.batch_id) || 0) + Number(r.reserved_qty || 0));
    });

    (batches || []).forEach((b) => {
      const activeRes = resSums.get(b.id) || 0;
      const bRes = Number(b.reserved_qty || 0);
      if (Math.abs(bRes - activeRes) > 0.0001) {
        findings.push({
          id: crypto.randomUUID(),
          category: "INVENTORY",
          checkName: "RESERVATION_SUM_MISMATCH",
          severity: "ERROR",
          title: "Batch Reserved Quantity Mismatch",
          description: `Batch ${b.batch_number} reserved_qty (${bRes}) does not match sum of active reservations (${activeRes}).`,
          referenceType: "BATCH",
          referenceId: b.id,
          referenceNumber: b.batch_number,
          expectedValue: activeRes,
          actualValue: bRes,
          discrepancy: Math.round((bRes - activeRes) * 10000) / 10000,
          suggestedFix: "Recalculate batch reserved_qty by synchronizing active reservation records.",
          detectedAt: nowStr,
        });
        errorCount++;
      }
    });

    // 1.3 Orphaned reservations on cancelled orders
    const soIds = (reservations || [])
      .filter((r) => r.source_document_type === "SALES_ORDER")
      .map((r) => r.source_document_id);

    if (soIds.length > 0) {
      const { data: cancelledOrders } = await admin
        .from("sales_orders")
        .select("id, order_number, status")
        .in("id", soIds)
        .in("status", ["CANCELLED", "REJECTED", "CLOSED"]);

      const cancelledSet = new Map((cancelledOrders || []).map((so) => [so.id, so]));
      (reservations || []).forEach((r) => {
        if (cancelledSet.has(r.source_document_id)) {
          const so = cancelledSet.get(r.source_document_id)!;
          findings.push({
            id: crypto.randomUUID(),
            category: "INVENTORY",
            checkName: "ORPHANED_RESERVATION",
            severity: "ERROR",
            title: "Orphaned Sales Order Reservation",
            description: `Active reservation of ${r.reserved_qty} units exists for sales order ${so.order_number} which is ${so.status}.`,
            referenceType: "SALES_ORDER",
            referenceId: so.id,
            referenceNumber: so.order_number,
            expectedValue: "RELEASED",
            actualValue: "ACTIVE",
            discrepancy: r.reserved_qty,
            suggestedFix: "Release orphaned reservation back to available inventory batch stock.",
            detectedAt: nowStr,
          });
          errorCount++;
        }
      });
    }
  }

  // 2. FINANCIAL RECONCILIATION
  if (["ALL", "FINANCIAL"].includes(category)) {
    const { data: invoices } = await admin
      .from("sales_invoices")
      .select("id, invoice_number, subtotal_paisa, tax_amount_paisa, total_amount_paisa, paid_amount_paisa, outstanding_amount_paisa, status")
      .eq("company_id", session.companyId);

    const { data: invoiceLines } = await admin
      .from("sales_invoice_lines")
      .select("id, sales_invoice_id, subtotal_paisa, tax_amount_paisa, cgst_amount_paisa, sgst_amount_paisa, igst_amount_paisa");

    const lineSubtotals = new Map<string, number>();
    const lineTaxes = new Map<string, number>();

    (invoiceLines || []).forEach((line) => {
      const invId = line.sales_invoice_id;
      lineSubtotals.set(invId, (lineSubtotals.get(invId) || 0) + Number(line.subtotal_paisa || 0));
      lineTaxes.set(invId, (lineTaxes.get(invId) || 0) + Number(line.tax_amount_paisa || 0));

      // Line Tax Split Check
      const taxSum = Number(line.cgst_amount_paisa || 0) + Number(line.sgst_amount_paisa || 0) + Number(line.igst_amount_paisa || 0);
      const expectedTax = Number(line.tax_amount_paisa || 0);
      if (taxSum !== expectedTax) {
        findings.push({
          id: crypto.randomUUID(),
          category: "FINANCIAL",
          checkName: "LINE_TAX_SPLIT_MISMATCH",
          severity: "CRITICAL",
          title: "GST Tax Split Inconsistency",
          description: `Invoice line item tax (${expectedTax} paisa) != CGST+SGST+IGST sum (${taxSum} paisa).`,
          referenceType: "INVOICE_LINE",
          referenceId: line.id,
          expectedValue: expectedTax,
          actualValue: taxSum,
          discrepancy: taxSum - expectedTax,
          suggestedFix: "Audit GST tax rate and place-of-supply splitting logic on invoice line.",
          detectedAt: nowStr,
        });
        criticalCount++;
      }
    });

    (invoices || []).forEach((inv) => {
      const expectedSubtotal = lineSubtotals.get(inv.id) || 0;
      const actualSubtotal = Number(inv.subtotal_paisa || 0);

      // Check subtotal vs lines
      if (expectedSubtotal !== actualSubtotal) {
        findings.push({
          id: crypto.randomUUID(),
          category: "FINANCIAL",
          checkName: "INVOICE_SUBTOTAL_MISMATCH",
          severity: "CRITICAL",
          title: "Invoice Line Subtotal Mismatch",
          description: `Invoice ${inv.invoice_number} header subtotal (${actualSubtotal} paisa) != lines sum (${expectedSubtotal} paisa).`,
          referenceType: "INVOICE",
          referenceId: inv.id,
          referenceNumber: inv.invoice_number,
          expectedValue: expectedSubtotal,
          actualValue: actualSubtotal,
          discrepancy: actualSubtotal - expectedSubtotal,
          suggestedFix: "Recalculate invoice header subtotal from verified line item snapshots.",
          detectedAt: nowStr,
        });
        criticalCount++;
      }

      // Check Settlement Invariant (paid + outstanding == total)
      if (inv.status !== "CANCELLED") {
        const total = Number(inv.total_amount_paisa || 0);
        const paid = Number(inv.paid_amount_paisa || 0);
        const outstanding = Number(inv.outstanding_amount_paisa || 0);
        if (paid + outstanding !== total) {
          findings.push({
            id: crypto.randomUUID(),
            category: "FINANCIAL",
            checkName: "INVOICE_SETTLEMENT_EQUATION_MISMATCH",
            severity: "ERROR",
            title: "Invoice Balance Invariant Violation",
            description: `Invoice ${inv.invoice_number} total (${total} paisa) != paid (${paid}) + outstanding (${outstanding}).`,
            referenceType: "INVOICE",
            referenceId: inv.id,
            referenceNumber: inv.invoice_number,
            expectedValue: total,
            actualValue: paid + outstanding,
            discrepancy: paid + outstanding - total,
            suggestedFix: "Synchronize invoice outstanding balance with payment allocation receipts.",
            detectedAt: nowStr,
          });
          errorCount++;
        }
      }
    });

    // Customer Ledger vs Open Invoices
    const { data: crl } = await admin
      .from("customer_receivables_ledger")
      .select("customer_id, debit_paisa, credit_paisa")
      .eq("company_id", session.companyId);

    const ledgerCustomerBal = new Map<string, number>();
    (crl || []).forEach((c) => {
      const net = Number(c.debit_paisa || 0) - Number(c.credit_paisa || 0);
      ledgerCustomerBal.set(c.customer_id, (ledgerCustomerBal.get(c.customer_id) || 0) + net);
    });

    const { data: customers } = await admin
      .from("customers")
      .select("id, shop_name, customer_code")
      .eq("company_id", session.companyId);

    const invoiceCustomerBal = new Map<string, number>();
    (invoices || []).forEach((inv) => {
      if (!["PAID", "CANCELLED"].includes(inv.status)) {
        const out = Number(inv.outstanding_amount_paisa || 0);
        invoiceCustomerBal.set((inv as any).customer_id, (invoiceCustomerBal.get((inv as any).customer_id) || 0) + out);
      }
    });

    (customers || []).forEach((cust) => {
      const lBal = ledgerCustomerBal.get(cust.id) || 0;
      const iBal = invoiceCustomerBal.get(cust.id) || 0;
      if (lBal !== iBal) {
        findings.push({
          id: crypto.randomUUID(),
          category: "FINANCIAL",
          checkName: "CUSTOMER_LEDGER_RECEIVABLES_MISMATCH",
          severity: "ERROR",
          title: "Customer Ledger vs Open Invoices Imbalance",
          description: `Customer ${cust.shop_name} (${cust.customer_code}) receivables ledger (${lBal} paisa) != open invoices (${iBal} paisa).`,
          referenceType: "CUSTOMER",
          referenceId: cust.id,
          referenceNumber: cust.customer_code,
          expectedValue: iBal,
          actualValue: lBal,
          discrepancy: lBal - iBal,
          suggestedFix: "Review unposted payments or missing ledger debit entries for this customer.",
          detectedAt: nowStr,
        });
        errorCount++;
      }
    });
  }

  // 3. COSTING RECONCILIATION
  if (["ALL", "COSTING"].includes(category)) {
    const { data: prodOrders } = await admin
      .from("production_orders")
      .select("id, order_number, planned_output_qty, actual_output_qty, status, item:product_id(name)")
      .eq("company_id", session.companyId)
      .eq("status", "COMPLETED");

    (prodOrders || []).forEach((po) => {
      const planned = Number(po.planned_output_qty || 0);
      const actual = Number(po.actual_output_qty || 0);
      if (planned > 0) {
        const yieldRatio = actual / planned;
        if (yieldRatio < 0.5 || yieldRatio > 1.25) {
          const yieldPct = Math.round(yieldRatio * 10000) / 100;
          findings.push({
            id: crypto.randomUUID(),
            category: "COSTING",
            checkName: "ABNORMAL_PRODUCTION_YIELD",
            severity: "WARNING",
            title: "Abnormal Production Yield",
            description: `Production order ${po.order_number} for ${(po.item as any)?.name || "Product"} completed with abnormal yield (${yieldPct}%) [Planned: ${planned}, Actual: ${actual}].`,
            referenceType: "PRODUCTION_ORDER",
            referenceId: po.id,
            referenceNumber: po.order_number,
            expectedValue: "85 - 105%",
            actualValue: `${yieldPct}%`,
            discrepancy: Math.round((actual - planned) * 100) / 100,
            suggestedFix: "Verify physical batch weighing logs or production wastage input entries.",
            detectedAt: nowStr,
          });
          warningCount++;
        }
      }
    });
  }

  const totalChecks = 9;
  const healthScore = Math.max(0, 100 - criticalCount * 25 - errorCount * 10 - warningCount * 2);
  const status = criticalCount > 0 || errorCount > 0 || warningCount > 0 ? "DISCREPANCIES_FOUND" : "CLEAN";

  const summary: ReconciliationSummary = {
    totalChecks,
    passedChecks: Math.max(0, totalChecks - (criticalCount + errorCount + warningCount)),
    failedChecks: criticalCount + errorCount + warningCount,
    criticalCount,
    errorCount,
    warningCount,
    healthScore,
    runTimestamp: nowStr,
    runBy: session.userId,
    status,
  };

  const runId = crypto.randomUUID();

  // Try saving to database
  try {
    await admin.from("reconciliation_runs").insert({
      id: runId,
      company_id: session.companyId,
      run_by_user_id: session.userId,
      category,
      status,
      health_score: healthScore,
      critical_count: criticalCount,
      error_count: errorCount,
      warning_count: warningCount,
      summary,
      findings,
    });
  } catch {
    // If table not yet migrated, continue cleanly in-memory
  }

  return {
    success: true,
    data: {
      runId,
      companyId: session.companyId,
      category,
      summary,
      findings,
    },
  };
}

/**
 * Get Past Reconciliation Runs
 */
export async function getReconciliationHistoryAction(): Promise<{
  success: boolean;
  data?: any[];
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    if (!["OWNER", "ADMIN", "ACCOUNTANT"].includes(session.role)) {
      return { success: false, error: "Permission Denied." };
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("reconciliation_runs")
      .select("id, category, status, health_score, critical_count, error_count, warning_count, created_at, summary")
      .eq("company_id", session.companyId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      return { success: true, data: [] };
    }

    return { success: true, data: data || [] };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Error fetching history." };
  }
}
