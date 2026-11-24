"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserSession } from "@/modules/auth/actions";
import {
  bomSchema,
  productionOrderSchema,
  productionConsumptionSchema,
  productionOutputSchema,
  productionQcReleaseSchema,
  BomInput,
  ProductionOrderInput,
  ProductionConsumptionInput,
  ProductionOutputInput,
  ProductionQcReleaseInput,
} from "./schema";
import {
  BillOfMaterials,
  ProductionOrder,
  ProductionOrderStatus,
  QcStatus,
} from "@/types/database";
import { revalidatePath } from "next/cache";

// ============================================================================
// 1. BILL OF MATERIALS (BOM)
// ============================================================================

export async function getBoms(productId?: string): Promise<{
  success: boolean;
  boms?: BillOfMaterials[];
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const admin = createAdminClient();
    let query = admin
      .from("bill_of_materials")
      .select(`
        *,
        product:product_id (id, code, name, category),
        output_unit:output_unit_id (symbol),
        creator:created_by (full_name),
        lines:bom_lines (id, component_item:component_item_id (name), quantity, unit:unit_id (symbol))
      `)
      .eq("company_id", session.companyId)
      .order("created_at", { ascending: false });

    if (productId) query = query.eq("product_id", productId);

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };

    return { success: true, boms: (data as any) || [] };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load BOMs" };
  }
}

export async function getBomById(id: string): Promise<{
  success: boolean;
  bom?: BillOfMaterials;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("bill_of_materials")
      .select(`
        *,
        product:product_id (*),
        output_unit:output_unit_id (*),
        creator:created_by (full_name),
        lines:bom_lines (
          id, line_number, component_type, quantity, conversion_rate, base_unit_qty, expected_wastage_percent, notes,
          component_item:component_item_id (*),
          unit:unit_id (*)
        )
      `)
      .eq("company_id", session.companyId)
      .eq("id", id)
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    if (!data) return { success: false, error: "BOM not found." };

    return { success: true, bom: data as any };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load BOM details" };
  }
}

export async function createBom(rawInput: BomInput): Promise<{
  success: boolean;
  bomId?: string;
  bomNumber?: string;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    if (!["OWNER", "ADMIN", "SUPERVISOR", "PRODUCTION"].includes(session.role)) {
      return { success: false, error: "Access Denied: Only Production or Admin can manage BOMs." };
    }

    const validated = bomSchema.safeParse(rawInput);
    if (!validated.success) {
      return { success: false, error: validated.error.issues.map((i) => i.message).join(", ") };
    }

    const d = validated.data;
    const admin = createAdminClient();

    // Concurrency-safe BOM code
    const { data: codeData, error: codeErr } = await admin.rpc("get_next_company_code", {
      p_company_id: session.companyId,
      p_counter_type: "BOM",
      p_prefix: "BOM",
      p_pad_length: 5,
    });

    let bomNumber = codeData;
    if (codeErr || !bomNumber) {
      const { count } = await admin
        .from("bill_of_materials")
        .select("id", { count: "exact", head: true })
        .eq("company_id", session.companyId);
      bomNumber = `BOM-${String((count || 0) + 1).padStart(5, "0")}`;
    }

    const { data: bomRecord, error: bomErr } = await admin
      .from("bill_of_materials")
      .insert({
        company_id: session.companyId,
        bom_number: bomNumber,
        product_id: d.productId,
        bom_type: d.bomType,
        version: d.version.trim(),
        effective_date: d.effectiveDate,
        status: d.status,
        expected_output_qty: d.expectedOutputQty,
        output_unit_id: d.outputUnitId,
        expected_yield_percent: d.expectedYieldPercent,
        expected_wastage_percent: d.expectedWastagePercent,
        labor_overhead_cost_paisa: d.laborOverheadCostPaisa,
        notes: d.notes ? d.notes.trim() : null,
        created_by: session.userId,
      })
      .select("id")
      .single();

    if (bomErr) return { success: false, error: bomErr.message };

    const linesToInsert = d.lines.map((l, idx) => ({
      company_id: session.companyId,
      bom_id: bomRecord.id,
      line_number: idx + 1,
      component_item_id: l.componentItemId,
      component_type: l.componentType,
      quantity: l.quantity,
      unit_id: l.unitId,
      conversion_rate: l.conversionRate,
      base_unit_qty: Number((l.quantity * l.conversionRate).toFixed(4)),
      expected_wastage_percent: l.expectedWastagePercent,
      notes: l.notes ? l.notes.trim() : null,
    }));

    const { error: linesErr } = await admin.from("bom_lines").insert(linesToInsert);
    if (linesErr) return { success: false, error: linesErr.message };

    await admin.from("audit_logs").insert({
      company_id: session.companyId,
      user_id: session.userId,
      action: "CREATE_BOM",
      entity_name: "bill_of_materials",
      entity_id: bomRecord.id,
      new_values: { bom_number: bomNumber, version: d.version, lines_count: linesToInsert.length },
    });

    revalidatePath("/production/recipes");
    return { success: true, bomId: bomRecord.id, bomNumber };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create BOM" };
  }
}

// ============================================================================
// 2. PRODUCTION ORDERS (WORK ORDERS)
// ============================================================================

export async function getProductionOrders(
  statusFilter?: ProductionOrderStatus,
  branchId?: string
): Promise<{
  success: boolean;
  orders?: ProductionOrder[];
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const admin = createAdminClient();
    let query = admin
      .from("production_orders")
      .select(`
        *,
        branch:branch_id (code, name),
        product:product_id (code, name),
        bom:bom_id (bom_number, version),
        unit:unit_id (symbol),
        production_warehouse:production_warehouse_id (code, name),
        finished_warehouse:finished_warehouse_id (code, name),
        creator:created_by (full_name)
      `)
      .eq("company_id", session.companyId)
      .order("created_at", { ascending: false });

    if (statusFilter) query = query.eq("status", statusFilter);
    if (branchId) query = query.eq("branch_id", branchId);

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };

    return { success: true, orders: (data as any) || [] };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load production orders" };
  }
}

export async function getProductionOrderById(id: string): Promise<{
  success: boolean;
  order?: ProductionOrder;
  materialRequirements?: Array<{
    item: any;
    requiredQty: number;
    unit: any;
  }>;
  consumptions?: any[];
  outputs?: any[];
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const admin = createAdminClient();
    const [orderRes, consRes, outRes] = await Promise.all([
      admin
        .from("production_orders")
        .select(`
          *,
          branch:branch_id (*),
          product:product_id (*),
          bom:bom_id (*, lines:bom_lines (*, component_item:component_item_id (*), unit:unit_id (*))),
          unit:unit_id (*),
          production_warehouse:production_warehouse_id (*),
          finished_warehouse:finished_warehouse_id (*),
          source_bulk_batch:source_bulk_batch_id (*),
          creator:created_by (full_name)
        `)
        .eq("company_id", session.companyId)
        .eq("id", id)
        .maybeSingle(),
      admin
        .from("production_consumptions")
        .select("*, item:item_id (*), batch:batch_id (*), unit:unit_id (*)")
        .eq("company_id", session.companyId)
        .eq("production_order_id", id)
        .order("created_at", { ascending: false }),
      admin
        .from("production_outputs")
        .select("*, item:item_id (*), output_batch:output_batch_id (*), unit:unit_id (*)")
        .eq("company_id", session.companyId)
        .eq("production_order_id", id)
        .order("created_at", { ascending: false }),
    ]);

    if (orderRes.error) return { success: false, error: orderRes.error.message };
    if (!orderRes.data) return { success: false, error: "Production order not found." };

    const order = orderRes.data as any;

    // Calculate material requirements proportionally from BOM
    const bom = order.bom;
    const materialRequirements: any[] = [];
    if (bom && bom.lines) {
      for (const line of bom.lines) {
        const requiredQty = Number(
          (
            (order.planned_qty / bom.expected_output_qty) *
            line.quantity *
            (1 + (line.expected_wastage_percent || 0) / 100)
          ).toFixed(4)
        );

        materialRequirements.push({
          item: line.component_item,
          requiredQty,
          unit: line.unit,
        });
      }
    }

    return {
      success: true,
      order,
      materialRequirements,
      consumptions: consRes.data || [],
      outputs: outRes.data || [],
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load order details" };
  }
}

export async function createProductionOrder(rawInput: ProductionOrderInput): Promise<{
  success: boolean;
  orderId?: string;
  orderNumber?: string;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    if (!["OWNER", "ADMIN", "SUPERVISOR", "PRODUCTION"].includes(session.role)) {
      return { success: false, error: "Access Denied: You do not have permission to create production orders." };
    }

    const validated = productionOrderSchema.safeParse(rawInput);
    if (!validated.success) {
      return { success: false, error: validated.error.issues.map((i) => i.message).join(", ") };
    }

    const d = validated.data;
    const admin = createAdminClient();

    // Concurrency-safe order code
    const { data: codeData, error: codeErr } = await admin.rpc("get_next_company_code", {
      p_company_id: session.companyId,
      p_counter_type: "PROD",
      p_prefix: "PROD",
      p_pad_length: 5,
    });

    let orderNumber = codeData;
    if (codeErr || !orderNumber) {
      const { count } = await admin
        .from("production_orders")
        .select("id", { count: "exact", head: true })
        .eq("company_id", session.companyId);
      orderNumber = `PROD-${String((count || 0) + 1).padStart(5, "0")}`;
    }

    const { data: orderRecord, error: orderErr } = await admin
      .from("production_orders")
      .insert({
        company_id: session.companyId,
        branch_id: d.branchId,
        order_number: orderNumber,
        bom_id: d.bomId,
        product_id: d.productId,
        order_type: d.orderType,
        planned_qty: d.plannedQty,
        produced_qty: 0,
        unit_id: d.unitId,
        production_warehouse_id: d.productionWarehouseId,
        finished_warehouse_id: d.finishedWarehouseId,
        planned_start_date: d.plannedStartDate,
        planned_completion_date: d.plannedCompletionDate,
        status: "APPROVED", // Auto-approved if created by authorized supervisor/admin
        source_bulk_batch_id: d.sourceBulkBatchId || null,
        notes: d.notes ? d.notes.trim() : null,
        created_by: session.userId,
        approved_by: session.userId,
        approved_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (orderErr) return { success: false, error: orderErr.message };

    await admin.from("audit_logs").insert({
      company_id: session.companyId,
      user_id: session.userId,
      action: "CREATE_PRODUCTION_ORDER",
      entity_name: "production_orders",
      entity_id: orderRecord.id,
      new_values: { order_number: orderNumber, type: d.orderType, planned_qty: d.plannedQty },
    });

    revalidatePath("/production/runs");
    return { success: true, orderId: orderRecord.id, orderNumber };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create work order" };
  }
}

// ============================================================================
// 3. MATERIAL RESERVATION & CONSUMPTION
// ============================================================================

export async function reserveProductionMaterialsAction(orderId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const supabase = await createClient();
    const { error: rpcErr } = await supabase.rpc("reserve_production_materials", {
      p_order_id: orderId,
    });

    if (rpcErr) return { success: false, error: rpcErr.message };

    const admin = createAdminClient();
    await admin.from("audit_logs").insert({
      company_id: session.companyId,
      user_id: session.userId,
      action: "RESERVE_PRODUCTION_MATERIALS",
      entity_name: "production_orders",
      entity_id: orderId,
    });

    revalidatePath(`/production/runs/${orderId}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to reserve materials" };
  }
}

export async function recordProductionConsumptionAction(
  rawInput: ProductionConsumptionInput
): Promise<{
  success: boolean;
  consumptionId?: string;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const validated = productionConsumptionSchema.safeParse(rawInput);
    if (!validated.success) {
      return { success: false, error: validated.error.issues.map((i) => i.message).join(", ") };
    }

    const d = validated.data;
    const supabase = await createClient();

    const { data: consId, error: rpcErr } = await supabase.rpc("record_production_consumption", {
      p_order_id: d.orderId,
      p_item_id: d.itemId,
      p_batch_id: d.batchId,
      p_warehouse_id: d.warehouseId,
      p_consumed_qty: d.consumedQty,
      p_wastage_qty: d.wastageQty,
      p_unit_id: d.unitId,
      p_reason: d.reason || null,
    });

    if (rpcErr) return { success: false, error: rpcErr.message };

    revalidatePath(`/production/runs/${d.orderId}`);
    return { success: true, consumptionId: consId };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to record consumption" };
  }
}

// ============================================================================
// 4. PRODUCTION OUTPUT & QC INSPECTION
// ============================================================================

export async function postProductionOutputAction(
  rawInput: ProductionOutputInput
): Promise<{
  success: boolean;
  outputId?: string;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const validated = productionOutputSchema.safeParse(rawInput);
    if (!validated.success) {
      return { success: false, error: validated.error.issues.map((i) => i.message).join(", ") };
    }

    const d = validated.data;
    const supabase = await createClient();

    const { data: outId, error: rpcErr } = await supabase.rpc("post_production_output", {
      p_order_id: d.orderId,
      p_produced_qty: d.producedQty,
      p_rejected_qty: d.rejectedQty,
      p_manufacturing_date: d.manufacturingDate,
      p_expiry_date: d.expiryDate,
      p_additional_costs_paisa: d.additionalCostsPaisa,
    });

    if (rpcErr) return { success: false, error: rpcErr.message };

    revalidatePath(`/production/runs/${d.orderId}`);
    return { success: true, outputId: outId };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to post output" };
  }
}

export async function releaseProductionQcAction(
  rawInput: ProductionQcReleaseInput
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    if (!["OWNER", "ADMIN", "SUPERVISOR", "PRODUCTION"].includes(session.role)) {
      return { success: false, error: "Access Denied: Quality release requires supervisor authorization." };
    }

    const validated = productionQcReleaseSchema.safeParse(rawInput);
    if (!validated.success) {
      return { success: false, error: validated.error.issues.map((i) => i.message).join(", ") };
    }

    const d = validated.data;
    const supabase = await createClient();

    const { error: rpcErr } = await supabase.rpc("release_production_qc", {
      p_output_id: d.outputId,
      p_status: d.qcStatus,
      p_notes: d.qcNotes || null,
    });

    if (rpcErr) return { success: false, error: rpcErr.message };

    revalidatePath("/production/qc");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to release QC" };
  }
}

export async function getProductionOutputs(qcStatus?: string): Promise<{
  success: boolean;
  outputs?: any[];
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const admin = createAdminClient();
    let query = admin
      .from("production_outputs")
      .select(`
        *,
        production_order:production_order_id (
          id,
          order_number,
          order_type,
          product:product_id (id, name, code)
        ),
        batch:batch_id (
          id,
          batch_number,
          manufacturing_date,
          expiry_date,
          qc_status
        ),
        warehouse:warehouse_id (
          id,
          name,
          code
        ),
        inspector:qc_inspected_by (
          id,
          email
        )
      `)
      .eq("company_id", session.companyId)
      .order("created_at", { ascending: false });

    if (qcStatus && qcStatus !== "ALL") {
      query = query.eq("qc_status", qcStatus);
    }

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };

    return { success: true, outputs: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch production outputs" };
  }
}

// ============================================================================
// 5. PRODUCTION METRICS & REPORTS
// ============================================================================

export async function getProductionMetrics(): Promise<{
  success: boolean;
  metrics?: {
    activeOrdersCount: number;
    completedOrdersCount: number;
    totalProductionSpendPaisa: number;
    bulkRunsCount: number;
    packagingRunsCount: number;
  };
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const admin = createAdminClient();
    const { data: orders, error } = await admin
      .from("production_orders")
      .select("status, order_type, total_production_cost_paisa")
      .eq("company_id", session.companyId);

    if (error) return { success: false, error: error.message };

    const list = orders || [];
    const activeOrdersCount = list.filter((o) =>
      ["SUBMITTED", "APPROVED", "MATERIAL_RESERVED", "IN_PROGRESS", "PARTIALLY_COMPLETED"].includes(o.status)
    ).length;
    const completedOrdersCount = list.filter((o) => o.status === "COMPLETED").length;
    const totalProductionSpendPaisa = list.reduce((acc, o) => acc + (o.total_production_cost_paisa || 0), 0);
    const bulkRunsCount = list.filter((o) => o.order_type === "BULK_PRODUCTION").length;
    const packagingRunsCount = list.filter((o) => o.order_type === "PACKAGING_PRODUCTION").length;

    return {
      success: true,
      metrics: {
        activeOrdersCount,
        completedOrdersCount,
        totalProductionSpendPaisa,
        bulkRunsCount,
        packagingRunsCount,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load metrics" };
  }
}
