"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserSession } from "@/modules/auth/actions";
import {
  reportDateRangeSchema,
  ReportDateRangeInput,
  salesReportFilterSchema,
  SalesReportFilterInput,
  inventoryReportFilterSchema,
  InventoryReportFilterInput,
  productionReportFilterSchema,
  ProductionReportFilterInput,
} from "./schema";

/**
 * Enforce branch access based on session roles
 */
function enforceBranchAccess(session: any, requestedBranchId: string | null | undefined): string | null {
  if (["OWNER", "ADMIN", "ACCOUNTANT"].includes(session.role)) {
    return requestedBranchId || null;
  }
  const accessibleBranchIds = (session.accessibleBranches || []).map((b: any) => b.id);
  if (accessibleBranchIds.length === 0) return requestedBranchId || null;

  if (requestedBranchId && !accessibleBranchIds.includes(requestedBranchId)) {
    throw new Error("Access Denied: You do not have permission to view reports for this branch.");
  }

  return requestedBranchId || accessibleBranchIds[0];
}

/**
 * Strip confidential financial/cost columns for non-privileged roles (Checkpoint 4 Hardening)
 */
function applyRoleRestrictions(data: any, role: string): any {
  if (["OWNER", "ADMIN"].includes(role)) return data; // Full access

  const sanitized = JSON.parse(JSON.stringify(data));

  if (role === "ACCOUNTANT") {
    // Accountant has financial access; no changes needed on financial fields
    return sanitized;
  }

  if (role === "SALESMAN") {
    // Salesman sees sales totals, but NO purchase costs, NO stock valuation, NO margins
    if (sanitized.procurement) sanitized.procurement.purchases_total_paisa = 0;
    if (sanitized.inventory) sanitized.inventory.stock_valuation_paisa = 0;
    if (sanitized.summary?.total_valuation_paisa !== undefined) {
      sanitized.summary.total_valuation_paisa = 0;
    }
    if (Array.isArray(sanitized.batches)) {
      sanitized.batches.forEach((b: any) => {
        b.unit_cost_paisa = 0;
        b.total_cost_paisa = 0;
      });
    }
    return sanitized;
  }

  if (role === "WAREHOUSE") {
    // Warehouse sees strictly physical quantities and locations - NO financial/pricing data
    if (sanitized.sales) {
      sanitized.sales.sales_today_paisa = 0;
      sanitized.sales.sales_month_paisa = 0;
      sanitized.sales.sales_total_paisa = 0;
    }
    if (sanitized.finance) {
      sanitized.finance.outstanding_receivables_paisa = 0;
      sanitized.finance.payments_received_paisa = 0;
    }
    if (sanitized.procurement) sanitized.procurement.purchases_total_paisa = 0;
    if (sanitized.inventory) sanitized.inventory.stock_valuation_paisa = 0;
    if (sanitized.summary?.total_valuation_paisa !== undefined) {
      sanitized.summary.total_valuation_paisa = 0;
    }
    if (Array.isArray(sanitized.batches)) {
      sanitized.batches.forEach((b: any) => {
        b.unit_cost_paisa = 0;
        b.total_cost_paisa = 0;
      });
    }
    if (Array.isArray(sanitized.recent_orders)) {
      sanitized.recent_orders.forEach((o: any) => {
        o.total_amount_paisa = 0;
      });
    }
    if (Array.isArray(sanitized.orders)) {
      sanitized.orders.forEach((o: any) => {
        o.total_amount_paisa = 0;
        if (Array.isArray(o.lines)) {
          o.lines.forEach((l: any) => {
            l.line_total_paisa = 0;
          });
        }
      });
    }
    return sanitized;
  }

  if (role === "PRODUCTION") {
    // Production sees output, yield, wastage - NO customer pricing or company finances
    if (sanitized.sales) {
      sanitized.sales.sales_today_paisa = 0;
      sanitized.sales.sales_month_paisa = 0;
      sanitized.sales.sales_total_paisa = 0;
    }
    if (sanitized.finance) {
      sanitized.finance.outstanding_receivables_paisa = 0;
      sanitized.finance.payments_received_paisa = 0;
    }
    if (sanitized.procurement) sanitized.procurement.purchases_total_paisa = 0;
    if (sanitized.summary?.total_valuation_paisa !== undefined) {
      sanitized.summary.total_valuation_paisa = 0;
    }
    if (Array.isArray(sanitized.recent_orders)) sanitized.recent_orders = [];
    return sanitized;
  }

  if (role === "SUPERVISOR") {
    // Supervisor sees branch operational data
    return sanitized;
  }

  return sanitized;
}

/**
 * 1. Authoritative Management Dashboard Data
 */
export async function getManagementDashboardData(rawInput?: Partial<ReportDateRangeInput>): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const branchId = enforceBranchAccess(session, rawInput?.branchId);

    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const startDate = rawInput?.startDate || thirtyDaysAgo.toISOString().split("T")[0];
    const endDate = rawInput?.endDate || today.toISOString().split("T")[0];

    const supabase = await createClient();

    // Call stored reporting RPC
    const { data, error } = await supabase.rpc("get_management_dashboard_metrics", {
      p_start_date: startDate,
      p_end_date: endDate,
      p_branch_id: branchId || undefined,
    });

    if (error) {
      // Fallback: If RPC not yet applied, calculate securely server-side via admin client
      const fallbackResult = await getManagementDashboardFallback(session, startDate, endDate, branchId);
      if (!fallbackResult.success) return fallbackResult;
      return {
        success: true,
        data: applyRoleRestrictions(fallbackResult.data, session.role),
      };
    }

    return {
      success: true,
      data: applyRoleRestrictions(data, session.role),
    };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Unexpected reporting error." };
  }
}

/**
 * Fallback server-side calculator if migration is pending execution
 */
async function getManagementDashboardFallback(
  session: any,
  startDate: string,
  endDate: string,
  branchId: string | null
): Promise<{ success: boolean; data: any }> {
  const admin = createAdminClient();

  // 1. Sales
  let salesQ = admin
    .from("sales_orders")
    .select("id, order_date, total_amount_paisa, status, customer:customer_id(shop_name, owner_name)")
    .eq("company_id", session.companyId)
    .not("status", "in", '("CANCELLED","REJECTED")')
    .gte("order_date", startDate)
    .lte("order_date", endDate);

  if (branchId) salesQ = salesQ.eq("branch_id", branchId);
  const { data: salesOrders } = await salesQ;

  const todayStr = new Date().toISOString().split("T")[0];
  const currentMonthStr = todayStr.substring(0, 7);

  let salesToday = 0;
  let salesMonth = 0;
  let salesTotal = 0;

  (salesOrders || []).forEach((so) => {
    const val = Number(so.total_amount_paisa || 0);
    salesTotal += val;
    if (so.order_date === todayStr) salesToday += val;
    if (so.order_date.startsWith(currentMonthStr)) salesMonth += val;
  });

  // 2. Pending orders count
  let pendingQ = admin
    .from("sales_orders")
    .select("id", { count: "exact", head: true })
    .eq("company_id", session.companyId)
    .in("status", ["SUBMITTED", "PENDING_APPROVAL", "APPROVED", "ALLOCATED", "READY_FOR_DISPATCH"]);
  if (branchId) pendingQ = pendingQ.eq("branch_id", branchId);
  const { count: pendingOrdersCount } = await pendingQ;

  // 3. Receivables & Payments
  let crlQ = admin
    .from("customer_receivables_ledger")
    .select("debit_paisa, credit_paisa")
    .eq("company_id", session.companyId);
  if (branchId) crlQ = crlQ.eq("branch_id", branchId);
  const { data: crlData } = await crlQ;

  let outstandingPaisa = 0;
  (crlData || []).forEach((c) => {
    outstandingPaisa += Number(c.debit_paisa || 0) - Number(c.credit_paisa || 0);
  });

  let payQ = admin
    .from("customer_payments")
    .select("amount_paisa")
    .eq("company_id", session.companyId)
    .gte("payment_date", startDate)
    .lte("payment_date", endDate);
  if (branchId) payQ = payQ.eq("branch_id", branchId);
  const { data: payData } = await payQ;

  const paymentsReceivedPaisa = (payData || []).reduce((acc, p) => acc + Number(p.amount_paisa || 0), 0);

  // 4. Purchases Total
  let poQ = admin
    .from("purchase_orders")
    .select("total_paisa")
    .eq("company_id", session.companyId)
    .not("status", "in", '("CANCELLED","REJECTED")')
    .gte("order_date", startDate)
    .lte("order_date", endDate);
  if (branchId) poQ = poQ.eq("branch_id", branchId);
  const { data: poData } = await poQ;

  const purchasesTotalPaisa = (poData || []).reduce((acc, p) => acc + Number(p.total_paisa || 0), 0);

  // 5. Inventory Valuation & Expiring Batches
  let batchQ = admin
    .from("inventory_batches")
    .select("current_qty, unit_cost_paisa, expiry_date")
    .eq("company_id", session.companyId)
    .eq("batch_status", "ACTIVE")
    .gt("current_qty", 0);
  if (branchId) batchQ = batchQ.eq("branch_id", branchId);
  const { data: batchData } = await batchQ;

  let stockValuationPaisa = 0;
  let expiringBatchesCount = 0;
  const thirtyDaysFuture = new Date();
  thirtyDaysFuture.setDate(thirtyDaysFuture.getDate() + 30);
  const thirtyDaysFutureStr = thirtyDaysFuture.toISOString().split("T")[0];

  (batchData || []).forEach((b) => {
    stockValuationPaisa += Math.round(Number(b.current_qty) * Number(b.unit_cost_paisa || 0));
    if (b.expiry_date && b.expiry_date <= thirtyDaysFutureStr) {
      expiringBatchesCount += 1;
    }
  });

  // 6. Production Orders
  let prodQ = admin
    .from("production_orders")
    .select("status")
    .eq("company_id", session.companyId)
    .gte("planned_start_date", startDate)
    .lte("planned_start_date", endDate);
  if (branchId) prodQ = prodQ.eq("branch_id", branchId);
  const { data: prodData } = await prodQ;

  let activeRuns = 0;
  let completedRuns = 0;
  (prodData || []).forEach((po) => {
    if (["SUBMITTED", "APPROVED", "MATERIAL_RESERVED", "IN_PROGRESS"].includes(po.status)) activeRuns += 1;
    if (po.status === "COMPLETED") completedRuns += 1;
  });

  return {
    success: true,
    data: {
      period: { start_date: startDate, end_date: endDate },
      sales: {
        sales_today_paisa: salesToday,
        sales_month_paisa: salesMonth,
        sales_total_paisa: salesTotal,
        pending_orders_count: pendingOrdersCount || 0,
      },
      finance: {
        outstanding_receivables_paisa: outstandingPaisa,
        payments_received_paisa: paymentsReceivedPaisa,
      },
      procurement: {
        purchases_total_paisa: purchasesTotalPaisa,
      },
      inventory: {
        stock_valuation_paisa: stockValuationPaisa,
        expiring_batches_count: expiringBatchesCount,
        low_stock_items_count: 0,
      },
      production: {
        active_runs_count: activeRuns,
        completed_runs_count: completedRuns,
      },
      recent_orders: (salesOrders || []).slice(0, 5).map((so) => ({
        id: so.id,
        order_number: so.id,
        customer_name: (so.customer as any)?.shop_name || "Customer",
        order_date: so.order_date,
        total_amount_paisa: so.total_amount_paisa,
        status: so.status,
      })),
      top_products: [],
    },
  };
}

/**
 * 2. Sales Analytics Report
 */
export async function getSalesAnalyticsData(rawInput?: Partial<SalesReportFilterInput>): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const branchId = enforceBranchAccess(session, rawInput?.branchId);

    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const startDate = rawInput?.startDate || thirtyDaysAgo.toISOString().split("T")[0];
    const endDate = rawInput?.endDate || today.toISOString().split("T")[0];

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_sales_analytics", {
      p_start_date: startDate,
      p_end_date: endDate,
      p_branch_id: branchId || undefined,
    });

    if (error) {
      // Fallback query via admin
      const admin = createAdminClient();
      let q = admin
        .from("sales_orders")
        .select(`
          id, order_number, order_date, status, total_amount_paisa,
          customer:customer_id(id, shop_name, owner_name),
          branch:branch_id(id, name),
          lines:sales_order_lines(item_id, sku, ordered_qty, line_total_paisa)
        `)
        .eq("company_id", session.companyId)
        .gte("order_date", startDate)
        .lte("order_date", endDate);

      if (branchId) q = q.eq("branch_id", branchId);
      const { data: orders, error: oErr } = await q;

      if (oErr) return { success: false, error: oErr.message };

      const fallbackData = {
        by_customer: [],
        by_product: [],
        by_salesman: [],
        by_status: [],
        by_branch: [],
        daily_trend: [],
        orders: orders || [],
      };

      return {
        success: true,
        data: applyRoleRestrictions(fallbackData, session.role),
      };
    }

    return {
      success: true,
      data: applyRoleRestrictions(data, session.role),
    };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Unexpected sales analytics error." };
  }
}

/**
 * 3. Inventory Analytics Report
 */
export async function getInventoryAnalyticsData(rawInput?: Partial<InventoryReportFilterInput>): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const branchId = enforceBranchAccess(session, rawInput?.branchId);
    const warehouseId = rawInput?.warehouseId || null;

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_inventory_analytics", {
      p_branch_id: branchId || undefined,
      p_warehouse_id: warehouseId || undefined,
    });

    if (error) {
      // Fallback query
      const admin = createAdminClient();
      let bQ = admin
        .from("inventory_batches")
        .select(`
          id, batch_number, current_qty, reserved_qty, unit_cost_paisa, expiry_date, batch_status, qc_status,
          item:item_id(id, name, sku),
          warehouse:warehouse_id(id, name)
        `)
        .eq("company_id", session.companyId)
        .eq("batch_status", "ACTIVE");

      if (branchId) bQ = bQ.eq("branch_id", branchId);
      if (warehouseId) bQ = bQ.eq("warehouse_id", warehouseId);

      const { data: batches } = await bQ;

      const totalPhysical = (batches || []).reduce((acc, b) => acc + Number(b.current_qty || 0), 0);
      const totalReserved = (batches || []).reduce((acc, b) => acc + Number(b.reserved_qty || 0), 0);
      const totalValuation = (batches || []).reduce(
        (acc, b) => acc + Math.round(Number(b.current_qty) * Number(b.unit_cost_paisa || 0)),
        0
      );

      const fallbackData = {
        summary: {
          total_batches: (batches || []).length,
          total_physical_qty: totalPhysical,
          total_reserved_qty: totalReserved,
          total_available_qty: totalPhysical - totalReserved,
          total_valuation_paisa: totalValuation,
        },
        by_warehouse: [],
        by_category: [],
        expiry_schedule: {
          expired_qty: 0,
          expiring_30_days_qty: 0,
          expiring_60_days_qty: 0,
          expiring_90_days_qty: 0,
          good_condition_qty: totalPhysical,
        },
      };

      return {
        success: true,
        data: applyRoleRestrictions(fallbackData, session.role),
      };
    }

    return {
      success: true,
      data: applyRoleRestrictions(data, session.role),
    };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Unexpected inventory analytics error." };
  }
}

/**
 * 4. Production Analytics Report
 */
export async function getProductionAnalyticsData(rawInput?: Partial<ProductionReportFilterInput>): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const branchId = enforceBranchAccess(session, rawInput?.branchId);

    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const startDate = rawInput?.startDate || thirtyDaysAgo.toISOString().split("T")[0];
    const endDate = rawInput?.endDate || today.toISOString().split("T")[0];

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_production_analytics", {
      p_start_date: startDate,
      p_end_date: endDate,
      p_branch_id: branchId || undefined,
    });

    if (error) {
      // Fallback query
      const admin = createAdminClient();
      let pQ = admin
        .from("production_orders")
        .select(`
          id, order_number, planned_start_date, status, planned_output_qty, actual_output_qty,
          product:product_id(id, name, sku)
        `)
        .eq("company_id", session.companyId)
        .gte("planned_start_date", startDate)
        .lte("planned_start_date", endDate);

      if (branchId) pQ = pQ.eq("branch_id", branchId);
      const { data: prodOrders } = await pQ;

      const completed = (prodOrders || []).filter((p) => p.status === "COMPLETED").length;

      const fallbackData = {
        summary: {
          total_orders: (prodOrders || []).length,
          completed_orders: completed,
          in_progress_orders: (prodOrders || []).length - completed,
          planned_qty_total: (prodOrders || []).reduce((acc, p) => acc + Number(p.planned_output_qty || 0), 0),
          actual_qty_total: (prodOrders || []).reduce((acc, p) => acc + Number(p.actual_output_qty || 0), 0),
        },
        by_product: [],
        material_consumption: [],
      };

      return {
        success: true,
        data: applyRoleRestrictions(fallbackData, session.role),
      };
    }

    return {
      success: true,
      data: applyRoleRestrictions(data, session.role),
    };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Unexpected production analytics error." };
  }
}

/**
 * 5. Secure CSV Export Action with Role-Enforced Field Stripping
 */
export async function exportReportCsvAction(
  reportType: "sales" | "inventory" | "production",
  filterInput?: any
): Promise<{ success: boolean; csvContent?: string; filename?: string; error?: string }> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    let filename = `report_${reportType}_${new Date().toISOString().split("T")[0]}.csv`;
    let csvRows: string[] = [];

    if (reportType === "sales") {
      const res = await getSalesAnalyticsData(filterInput);
      if (!res.success || !res.data) return { success: false, error: res.error || "Failed to generate report" };

      const orders = res.data.orders || [];
      const includeAmount = !["WAREHOUSE", "PRODUCTION"].includes(session.role);

      const header = includeAmount
        ? ["Order Number", "Order Date", "Customer", "Branch", "Status", "Total Amount (₹)"]
        : ["Order Number", "Order Date", "Customer", "Branch", "Status"];

      csvRows.push(header.join(","));

      orders.forEach((o: any) => {
        const row = [
          `"${o.order_number || o.id}"`,
          `"${o.order_date}"`,
          `"${(o.customer as any)?.shop_name || "N/A"}"`,
          `"${(o.branch as any)?.name || "N/A"}"`,
          `"${o.status}"`,
        ];
        if (includeAmount) {
          row.push((Number(o.total_amount_paisa || 0) / 100).toFixed(2));
        }
        csvRows.push(row.join(","));
      });
    } else if (reportType === "inventory") {
      const res = await getInventoryAnalyticsData(filterInput);
      if (!res.success || !res.data) return { success: false, error: res.error || "Failed to generate report" };

      const summary = res.data.summary || {};
      const includeCost = ["OWNER", "ADMIN", "ACCOUNTANT"].includes(session.role);

      csvRows.push(["Metric", "Value"].join(","));
      csvRows.push([`"Total Physical Quantity"`, summary.total_physical_qty || 0].join(","));
      csvRows.push([`"Total Reserved Quantity"`, summary.total_reserved_qty || 0].join(","));
      csvRows.push([`"Total Available Quantity"`, summary.total_available_qty || 0].join(","));
      if (includeCost) {
        csvRows.push([`"Total Valuation (₹)"`, (Number(summary.total_valuation_paisa || 0) / 100).toFixed(2)].join(","));
      }
    } else if (reportType === "production") {
      const res = await getProductionAnalyticsData(filterInput);
      if (!res.success || !res.data) return { success: false, error: res.error || "Failed to generate report" };

      const summary = res.data.summary || {};
      csvRows.push(["Metric", "Value"].join(","));
      csvRows.push([`"Total Orders"`, summary.total_orders || 0].join(","));
      csvRows.push([`"Completed Orders"`, summary.completed_orders || 0].join(","));
      csvRows.push([`"Planned Quantity Total"`, summary.planned_qty_total || 0].join(","));
      csvRows.push([`"Actual Output Total"`, summary.actual_qty_total || 0].join(","));
    }

    return {
      success: true,
      csvContent: csvRows.join("\n"),
      filename,
    };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Export failed." };
  }
}
