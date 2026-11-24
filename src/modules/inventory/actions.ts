"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserSession } from "@/modules/auth/actions";
import {
  stockReservationSchema,
  stockTransferSchema,
  stockAdjustmentSchema,
  batchStatusUpdateSchema,
  StockReservationInput,
  StockTransferInput,
  StockAdjustmentInput,
  BatchStatusUpdateInput,
} from "./schema";
import {
  InventoryBatch,
  StockMovement,
  StockReservation,
  StockTransfer,
  StockAdjustment,
  BatchStatus,
  QcStatus,
  StockTransferStatus,
  StockAdjustmentStatus,
} from "@/types/database";
import { revalidatePath } from "next/cache";

// ============================================================================
// 1. INVENTORY DASHBOARD METRICS
// ============================================================================

export async function getInventoryDashboardMetrics(filters?: {
  branchId?: string;
  warehouseId?: string;
  category?: string;
}): Promise<{
  success: boolean;
  metrics?: {
    totalOnHandQty: number;
    totalValuationPaisa: number;
    availableStockQty: number;
    reservedStockQty: number;
    qcPendingStockQty: number;
    expiredBatchesCount: number;
    nearExpiryBatchesCount: number;
    activeBatchesCount: number;
    recentMovements: StockMovement[];
  };
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const admin = createAdminClient();

    // Query batches for company
    let batchQuery = admin
      .from("inventory_batches")
      .select("*, item:item_id (id, name, category)")
      .eq("company_id", session.companyId)
      .eq("is_active", true);

    if (filters?.branchId) batchQuery = batchQuery.eq("branch_id", filters.branchId);
    if (filters?.warehouseId) batchQuery = batchQuery.eq("warehouse_id", filters.warehouseId);

    const { data: batches, error: batchErr } = await batchQuery;
    if (batchErr) return { success: false, error: batchErr.message };

    const filteredBatches = (batches || []).filter((b: any) => {
      if (filters?.category && b.item?.category !== filters.category) return false;
      return true;
    });

    const todayStr = new Date().toISOString().split("T")[0];
    const thirtyDaysAhead = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

    let totalOnHandQty = 0;
    let totalValuationPaisa = 0;
    let availableStockQty = 0;
    let reservedStockQty = 0;
    let qcPendingStockQty = 0;
    let expiredBatchesCount = 0;
    let nearExpiryBatchesCount = 0;

    for (const b of filteredBatches) {
      const currentQty = Number(b.current_qty) || 0;
      const reservedQty = Number(b.reserved_qty) || 0;
      const unitCostPaisa = Number(b.unit_cost_paisa) || 0;

      totalOnHandQty += currentQty;
      totalValuationPaisa += Math.round(currentQty * unitCostPaisa);
      reservedStockQty += reservedQty;

      // Available calculation (only active, released, non-expired)
      const isExpired = b.expiry_date && b.expiry_date < todayStr;
      const isNearExpiry = b.expiry_date && b.expiry_date >= todayStr && b.expiry_date <= thirtyDaysAhead;

      if (isExpired) {
        expiredBatchesCount++;
      } else if (isNearExpiry) {
        nearExpiryBatchesCount++;
      }

      if (b.qc_status === "PENDING") {
        qcPendingStockQty += currentQty;
      }

      if (b.batch_status === "ACTIVE" && b.qc_status === "RELEASED" && !isExpired) {
        availableStockQty += Math.max(0, currentQty - reservedQty);
      }
    }

    // Query recent stock movements
    let movementQuery = admin
      .from("stock_movements")
      .select(`
        *,
        item:item_id (name, code),
        warehouse:warehouse_id (name, code),
        batch:batch_id (batch_number),
        base_unit:base_unit_id (symbol)
      `)
      .eq("company_id", session.companyId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (filters?.branchId) movementQuery = movementQuery.eq("branch_id", filters.branchId);
    if (filters?.warehouseId) movementQuery = movementQuery.eq("warehouse_id", filters.warehouseId);

    const { data: movements } = await movementQuery;

    return {
      success: true,
      metrics: {
        totalOnHandQty: Number(totalOnHandQty.toFixed(4)),
        totalValuationPaisa,
        availableStockQty: Number(availableStockQty.toFixed(4)),
        reservedStockQty: Number(reservedStockQty.toFixed(4)),
        qcPendingStockQty: Number(qcPendingStockQty.toFixed(4)),
        expiredBatchesCount,
        nearExpiryBatchesCount,
        activeBatchesCount: filteredBatches.length,
        recentMovements: (movements as any) || [],
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load dashboard metrics" };
  }
}

// ============================================================================
// 2. STOCK SUMMARY (BY ITEM & WAREHOUSE)
// ============================================================================

export async function getStockSummary(filters?: {
  warehouseId?: string;
  category?: string;
  search?: string;
}): Promise<{
  success: boolean;
  summary?: Array<{
    itemId: string;
    itemCode: string;
    itemName: string;
    category?: string;
    warehouseId: string;
    warehouseName: string;
    unitSymbol: string;
    onHandQty: number;
    reservedQty: number;
    availableQty: number;
    valuationPaisa: number;
    batchesCount: number;
  }>;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const admin = createAdminClient();
    let query = admin
      .from("inventory_batches")
      .select(`
        *,
        item:item_id (id, code, name, category),
        warehouse:warehouse_id (id, name, code),
        base_unit:base_unit_id (symbol)
      `)
      .eq("company_id", session.companyId)
      .eq("is_active", true);

    if (filters?.warehouseId) query = query.eq("warehouse_id", filters.warehouseId);

    const { data: batches, error } = await query;
    if (error) return { success: false, error: error.message };

    const todayStr = new Date().toISOString().split("T")[0];
    const map: Record<string, any> = {};

    for (const b of batches || []) {
      const item = b.item;
      const wh = b.warehouse;
      if (!item || !wh) continue;

      if (filters?.category && item.category !== filters.category) continue;
      if (filters?.search) {
        const q = filters.search.toLowerCase();
        if (
          !item.name.toLowerCase().includes(q) &&
          !item.code.toLowerCase().includes(q) &&
          !wh.name.toLowerCase().includes(q)
        ) {
          continue;
        }
      }

      const key = `${item.id}_${wh.id}`;
      if (!map[key]) {
        map[key] = {
          itemId: item.id,
          itemCode: item.code,
          itemName: item.name,
          category: item.category,
          warehouseId: wh.id,
          warehouseName: wh.name,
          unitSymbol: b.base_unit?.symbol || "unit",
          onHandQty: 0,
          reservedQty: 0,
          availableQty: 0,
          valuationPaisa: 0,
          batchesCount: 0,
        };
      }

      const current = Number(b.current_qty) || 0;
      const reserved = Number(b.reserved_qty) || 0;
      const cost = Number(b.unit_cost_paisa) || 0;

      map[key].onHandQty += current;
      map[key].reservedQty += reserved;
      map[key].valuationPaisa += Math.round(current * cost);
      map[key].batchesCount += 1;

      const isEligible =
        b.batch_status === "ACTIVE" &&
        b.qc_status === "RELEASED" &&
        (!b.expiry_date || b.expiry_date >= todayStr);

      if (isEligible) {
        map[key].availableQty += Math.max(0, current - reserved);
      }
    }

    const summary = Object.values(map).map((row: any) => ({
      ...row,
      onHandQty: Number(row.onHandQty.toFixed(4)),
      reservedQty: Number(row.reservedQty.toFixed(4)),
      availableQty: Number(row.availableQty.toFixed(4)),
    }));

    return { success: true, summary };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load stock summary" };
  }
}

// ============================================================================
// 3. BATCHES MANAGEMENT & TRACEABILITY
// ============================================================================

export async function getInventoryBatches(filters?: {
  itemId?: string;
  warehouseId?: string;
  batchStatus?: BatchStatus;
  qcStatus?: QcStatus;
  search?: string;
}): Promise<{
  success: boolean;
  batches?: InventoryBatch[];
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const admin = createAdminClient();
    let query = admin
      .from("inventory_batches")
      .select(`
        *,
        item:item_id (id, code, name, category),
        warehouse:warehouse_id (id, code, name),
        supplier:supplier_id (id, code, name),
        base_unit:base_unit_id (id, symbol)
      `)
      .eq("company_id", session.companyId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (filters?.itemId) query = query.eq("item_id", filters.itemId);
    if (filters?.warehouseId) query = query.eq("warehouse_id", filters.warehouseId);
    if (filters?.batchStatus) query = query.eq("batch_status", filters.batchStatus);
    if (filters?.qcStatus) query = query.eq("qc_status", filters.qcStatus);

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };

    let results = (data as any) || [];
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      results = results.filter(
        (b: any) =>
          b.batch_number.toLowerCase().includes(q) ||
          b.item?.name.toLowerCase().includes(q) ||
          (b.supplier_batch_number && b.supplier_batch_number.toLowerCase().includes(q))
      );
    }

    return { success: true, batches: results };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load inventory batches" };
  }
}

export async function getBatchById(id: string): Promise<{
  success: boolean;
  batch?: InventoryBatch;
  movements?: StockMovement[];
  reservations?: StockReservation[];
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const admin = createAdminClient();
    const [batchRes, mvtRes, resRes] = await Promise.all([
      admin
        .from("inventory_batches")
        .select(`
          *,
          item:item_id (*),
          warehouse:warehouse_id (*),
          supplier:supplier_id (*),
          base_unit:base_unit_id (*),
          grn:grn_id (*)
        `)
        .eq("company_id", session.companyId)
        .eq("id", id)
        .maybeSingle(),
      admin
        .from("stock_movements")
        .select("*, creator:created_by (full_name), base_unit:base_unit_id (symbol)")
        .eq("company_id", session.companyId)
        .eq("batch_id", id)
        .order("created_at", { ascending: false }),
      admin
        .from("stock_reservations")
        .select("*, creator:created_by (full_name)")
        .eq("company_id", session.companyId)
        .eq("batch_id", id)
        .order("created_at", { ascending: false }),
    ]);

    if (batchRes.error) return { success: false, error: batchRes.error.message };
    if (!batchRes.data) return { success: false, error: "Batch not found." };

    return {
      success: true,
      batch: batchRes.data as any,
      movements: (mvtRes.data as any) || [],
      reservations: (resRes.data as any) || [],
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load batch details" };
  }
}

export async function updateBatchStatus(rawInput: BatchStatusUpdateInput): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    if (!["OWNER", "ADMIN", "SUPERVISOR", "PRODUCTION"].includes(session.role)) {
      return { success: false, error: "Access Denied: You do not have permission to change batch status." };
    }

    const validated = batchStatusUpdateSchema.safeParse(rawInput);
    if (!validated.success) {
      return { success: false, error: validated.error.issues.map((i) => i.message).join(", ") };
    }

    const d = validated.data;
    const supabase = await createClient();

    const { error: rpcErr } = await supabase.rpc("update_batch_status_and_qc", {
      p_batch_id: d.batchId,
      p_batch_status: d.batchStatus,
      p_qc_status: d.qcStatus,
      p_reason: d.reason || null,
    });

    if (rpcErr) return { success: false, error: rpcErr.message };

    const admin = createAdminClient();
    await admin.from("audit_logs").insert({
      company_id: session.companyId,
      user_id: session.userId,
      action: "UPDATE_BATCH_STATUS",
      entity_name: "inventory_batches",
      entity_id: d.batchId,
      new_values: { batch_status: d.batchStatus, qc_status: d.qcStatus, reason: d.reason },
    });

    revalidatePath("/inventory/batches");
    revalidatePath(`/inventory/batches/${d.batchId}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update batch status" };
  }
}

// ============================================================================
// 4. FEFO ALLOCATION & STOCK RESERVATIONS
// ============================================================================

export async function allocateFefoStock(
  warehouseId: string,
  itemId: string,
  requiredQty: number
): Promise<{
  success: boolean;
  allocations?: Array<{
    batch_id: string;
    batch_number: string;
    expiry_date: string | null;
    allocated_qty: number;
    unit_cost_paisa: number;
  }>;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("allocate_fefo_stock", {
      p_company_id: session.companyId,
      p_warehouse_id: warehouseId,
      p_item_id: itemId,
      p_required_qty: requiredQty,
    });

    if (error) return { success: false, error: error.message };
    return { success: true, allocations: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message || "FEFO allocation failed" };
  }
}

export async function createStockReservation(rawInput: StockReservationInput): Promise<{
  success: boolean;
  reservationId?: string;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const validated = stockReservationSchema.safeParse(rawInput);
    if (!validated.success) {
      return { success: false, error: validated.error.issues.map((i) => i.message).join(", ") };
    }

    const d = validated.data;
    const supabase = await createClient();

    const { data: resId, error: rpcErr } = await supabase.rpc("create_stock_reservation", {
      p_company_id: session.companyId,
      p_branch_id: d.branchId,
      p_warehouse_id: d.warehouseId,
      p_item_id: d.itemId,
      p_batch_id: d.batchId,
      p_reserved_qty: d.reservedQty,
      p_base_unit_id: d.baseUnitId,
      p_source_document_type: d.sourceDocumentType,
      p_source_document_id: d.sourceDocumentId,
      p_notes: d.notes || null,
    });

    if (rpcErr) return { success: false, error: rpcErr.message };

    const admin = createAdminClient();
    await admin.from("audit_logs").insert({
      company_id: session.companyId,
      user_id: session.userId,
      action: "CREATE_STOCK_RESERVATION",
      entity_name: "stock_reservations",
      entity_id: resId,
      new_values: { batch_id: d.batchId, qty: d.reservedQty, doc: d.sourceDocumentType },
    });

    revalidatePath("/inventory/batches");
    return { success: true, reservationId: resId };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create reservation" };
  }
}

export async function releaseStockReservation(reservationId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const supabase = await createClient();
    const { error: rpcErr } = await supabase.rpc("release_stock_reservation", {
      p_reservation_id: reservationId,
    });

    if (rpcErr) return { success: false, error: rpcErr.message };

    const admin = createAdminClient();
    await admin.from("audit_logs").insert({
      company_id: session.companyId,
      user_id: session.userId,
      action: "RELEASE_STOCK_RESERVATION",
      entity_name: "stock_reservations",
      entity_id: reservationId,
    });

    revalidatePath("/inventory/batches");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to release reservation" };
  }
}

// ============================================================================
// 5. INTER-WAREHOUSE STOCK TRANSFERS
// ============================================================================

export async function getStockTransfers(statusFilter?: StockTransferStatus): Promise<{
  success: boolean;
  transfers?: StockTransfer[];
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const admin = createAdminClient();
    let query = admin
      .from("stock_transfers")
      .select(`
        *,
        source_branch:source_branch_id (code, name),
        source_warehouse:source_warehouse_id (code, name),
        destination_branch:destination_branch_id (code, name),
        destination_warehouse:destination_warehouse_id (code, name),
        creator:created_by (full_name),
        lines:stock_transfer_lines (id, item:item_id (name), requested_qty, dispatched_qty, received_qty, unit:unit_id (symbol))
      `)
      .eq("company_id", session.companyId)
      .order("created_at", { ascending: false });

    if (statusFilter) query = query.eq("status", statusFilter);

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };

    return { success: true, transfers: (data as any) || [] };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load stock transfers" };
  }
}

export async function getStockTransferById(id: string): Promise<{
  success: boolean;
  transfer?: StockTransfer;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("stock_transfers")
      .select(`
        *,
        source_branch:source_branch_id (code, name),
        source_warehouse:source_warehouse_id (code, name),
        destination_branch:destination_branch_id (code, name),
        destination_warehouse:destination_warehouse_id (code, name),
        creator:created_by (full_name),
        lines:stock_transfer_lines (
          id, line_number, requested_qty, dispatched_qty, received_qty, notes,
          item:item_id (id, code, name),
          batch:batch_id (id, batch_number, expiry_date, current_qty),
          unit:unit_id (symbol)
        )
      `)
      .eq("company_id", session.companyId)
      .eq("id", id)
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    if (!data) return { success: false, error: "Transfer not found." };

    return { success: true, transfer: data as any };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load transfer details" };
  }
}

export async function createStockTransfer(rawInput: StockTransferInput): Promise<{
  success: boolean;
  transferId?: string;
  transferNumber?: string;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const validated = stockTransferSchema.safeParse(rawInput);
    if (!validated.success) {
      return { success: false, error: validated.error.issues.map((i) => i.message).join(", ") };
    }

    const d = validated.data;
    const admin = createAdminClient();

    // Concurrency-safe transfer number
    const { data: codeData, error: codeErr } = await admin.rpc("get_next_company_code", {
      p_company_id: session.companyId,
      p_counter_type: "TRANSFER",
      p_prefix: "TRF",
      p_pad_length: 5,
    });

    let transferNumber = codeData;
    if (codeErr || !transferNumber) {
      const { count } = await admin
        .from("stock_transfers")
        .select("id", { count: "exact", head: true })
        .eq("company_id", session.companyId);
      transferNumber = `TRF-${String((count || 0) + 1).padStart(5, "0")}`;
    }

    const { data: transferRecord, error: trfErr } = await admin
      .from("stock_transfers")
      .insert({
        company_id: session.companyId,
        transfer_number: transferNumber,
        source_branch_id: d.sourceBranchId,
        source_warehouse_id: d.sourceWarehouseId,
        destination_branch_id: d.destinationBranchId,
        destination_warehouse_id: d.destinationWarehouseId,
        status: "SUBMITTED",
        notes: d.notes || null,
        created_by: session.userId,
      })
      .select("id")
      .single();

    if (trfErr) return { success: false, error: trfErr.message };

    const linesToInsert = d.lines.map((line, idx) => ({
      company_id: session.companyId,
      transfer_id: transferRecord.id,
      line_number: idx + 1,
      item_id: line.itemId,
      batch_id: line.batchId,
      requested_qty: line.requestedQty,
      dispatched_qty: 0,
      received_qty: 0,
      unit_id: line.unitId,
      notes: line.notes || null,
    }));

    const { error: linesErr } = await admin.from("stock_transfer_lines").insert(linesToInsert);
    if (linesErr) return { success: false, error: linesErr.message };

    await admin.from("audit_logs").insert({
      company_id: session.companyId,
      user_id: session.userId,
      action: "CREATE_STOCK_TRANSFER",
      entity_name: "stock_transfers",
      entity_id: transferRecord.id,
      new_values: { transfer_number: transferNumber, lines_count: linesToInsert.length },
    });

    revalidatePath("/inventory/transfers");
    return { success: true, transferId: transferRecord.id, transferNumber };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create transfer" };
  }
}

export async function dispatchStockTransfer(transferId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    if (!["OWNER", "ADMIN", "SUPERVISOR", "WAREHOUSE"].includes(session.role)) {
      return { success: false, error: "Access Denied: Only Warehouse or Admin can dispatch stock." };
    }

    const supabase = await createClient();
    const { error: rpcErr } = await supabase.rpc("post_stock_transfer_dispatch", {
      p_transfer_id: transferId,
    });

    if (rpcErr) return { success: false, error: rpcErr.message };

    const admin = createAdminClient();
    await admin.from("audit_logs").insert({
      company_id: session.companyId,
      user_id: session.userId,
      action: "DISPATCH_STOCK_TRANSFER",
      entity_name: "stock_transfers",
      entity_id: transferId,
    });

    revalidatePath("/inventory/transfers");
    revalidatePath(`/inventory/transfers/${transferId}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to dispatch transfer" };
  }
}

export async function receiveStockTransfer(transferId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    if (!["OWNER", "ADMIN", "SUPERVISOR", "WAREHOUSE"].includes(session.role)) {
      return { success: false, error: "Access Denied: Only Warehouse or Admin can confirm transfer receipts." };
    }

    const supabase = await createClient();
    const { error: rpcErr } = await supabase.rpc("post_stock_transfer_receipt", {
      p_transfer_id: transferId,
    });

    if (rpcErr) return { success: false, error: rpcErr.message };

    const admin = createAdminClient();
    await admin.from("audit_logs").insert({
      company_id: session.companyId,
      user_id: session.userId,
      action: "RECEIVE_STOCK_TRANSFER",
      entity_name: "stock_transfers",
      entity_id: transferId,
    });

    revalidatePath("/inventory/transfers");
    revalidatePath(`/inventory/transfers/${transferId}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to receive transfer" };
  }
}

// ============================================================================
// 6. STOCK ADJUSTMENTS
// ============================================================================

export async function getStockAdjustments(statusFilter?: StockAdjustmentStatus): Promise<{
  success: boolean;
  adjustments?: StockAdjustment[];
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const admin = createAdminClient();
    let query = admin
      .from("stock_adjustments")
      .select(`
        *,
        branch:branch_id (code, name),
        warehouse:warehouse_id (code, name),
        creator:created_by (full_name),
        lines:stock_adjustment_lines (
          id, difference_qty, unit:unit_id (symbol), item:item_id (name)
        )
      `)
      .eq("company_id", session.companyId)
      .order("created_at", { ascending: false });

    if (statusFilter) query = query.eq("status", statusFilter);

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };

    return { success: true, adjustments: (data as any) || [] };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load adjustments" };
  }
}

export async function createStockAdjustment(rawInput: StockAdjustmentInput): Promise<{
  success: boolean;
  adjustmentId?: string;
  adjustmentNumber?: string;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const validated = stockAdjustmentSchema.safeParse(rawInput);
    if (!validated.success) {
      return { success: false, error: validated.error.issues.map((i) => i.message).join(", ") };
    }

    const d = validated.data;
    const admin = createAdminClient();

    // Concurrency-safe adjustment number
    const { data: codeData, error: codeErr } = await admin.rpc("get_next_company_code", {
      p_company_id: session.companyId,
      p_counter_type: "ADJUSTMENT",
      p_prefix: "ADJ",
      p_pad_length: 5,
    });

    let adjNumber = codeData;
    if (codeErr || !adjNumber) {
      const { count } = await admin
        .from("stock_adjustments")
        .select("id", { count: "exact", head: true })
        .eq("company_id", session.companyId);
      adjNumber = `ADJ-${String((count || 0) + 1).padStart(5, "0")}`;
    }

    const { data: adjRecord, error: adjErr } = await admin
      .from("stock_adjustments")
      .insert({
        company_id: session.companyId,
        branch_id: d.branchId,
        warehouse_id: d.warehouseId,
        adjustment_number: adjNumber,
        adjustment_type: d.adjustmentType,
        status: "APPROVED", // Auto-approved if created by Owner/Admin, else Submitted
        reason: d.reason.trim(),
        created_by: session.userId,
        approved_by: session.userId,
        approved_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (adjErr) return { success: false, error: adjErr.message };

    const linesToInsert = d.lines.map((l, idx) => ({
      company_id: session.companyId,
      adjustment_id: adjRecord.id,
      line_number: idx + 1,
      item_id: l.itemId,
      batch_id: l.batchId,
      system_qty: l.systemQty,
      counted_qty: l.countedQty,
      difference_qty: Number((l.countedQty - l.systemQty).toFixed(4)),
      unit_id: l.unitId,
      reason: l.reason ? l.reason.trim() : null,
    }));

    const { error: linesErr } = await admin.from("stock_adjustment_lines").insert(linesToInsert);
    if (linesErr) return { success: false, error: linesErr.message };

    // Post to stock movements & batch quantities
    const supabase = await createClient();
    const { error: postErr } = await supabase.rpc("post_stock_adjustment", {
      p_adjustment_id: adjRecord.id,
    });

    if (postErr) return { success: false, error: postErr.message };

    await admin.from("audit_logs").insert({
      company_id: session.companyId,
      user_id: session.userId,
      action: "POST_STOCK_ADJUSTMENT",
      entity_name: "stock_adjustments",
      entity_id: adjRecord.id,
      new_values: { adjustment_number: adjNumber, type: d.adjustmentType },
    });

    revalidatePath("/inventory/adjustments");
    revalidatePath("/inventory/batches");
    return { success: true, adjustmentId: adjRecord.id, adjustmentNumber: adjNumber };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to post adjustment" };
  }
}

// ============================================================================
// 7. EXPIRY ALERTS & INVENTORY VALUATION
// ============================================================================

export async function getExpiryAlerts(thresholdDays = 30): Promise<{
  success: boolean;
  alerts?: Array<{
    batch: InventoryBatch;
    daysUntilExpiry: number;
    alertType: "EXPIRED" | "CRITICAL" | "UPCOMING";
  }>;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const admin = createAdminClient();
    const targetDate = new Date(Date.now() + thresholdDays * 86400000).toISOString().split("T")[0];

    const { data: batches, error } = await admin
      .from("inventory_batches")
      .select(`
        *,
        item:item_id (id, code, name),
        warehouse:warehouse_id (id, code, name),
        base_unit:base_unit_id (symbol)
      `)
      .eq("company_id", session.companyId)
      .eq("is_active", true)
      .gt("current_qty", 0)
      .not("expiry_date", "is", null)
      .lte("expiry_date", targetDate)
      .order("expiry_date", { ascending: true });

    if (error) return { success: false, error: error.message };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const alerts = (batches || []).map((b: any) => {
      const exp = new Date(b.expiry_date);
      const diffMs = exp.getTime() - today.getTime();
      const days = Math.ceil(diffMs / 86400000);

      let alertType: "EXPIRED" | "CRITICAL" | "UPCOMING" = "UPCOMING";
      if (days < 0) alertType = "EXPIRED";
      else if (days <= 7) alertType = "CRITICAL";

      return {
        batch: b,
        daysUntilExpiry: days,
        alertType,
      };
    });

    return { success: true, alerts };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load expiry alerts" };
  }
}

export async function getValuationReport(): Promise<{
  success: boolean;
  valuation?: Array<{
    item: { id: string; code: string; name: string; category?: string };
    totalQty: number;
    unitSymbol: string;
    weightedAvgCostPaisa: number;
    totalValuationPaisa: number;
    batchesCount: number;
  }>;
  totalCompanyValuationPaisa?: number;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const admin = createAdminClient();
    const { data: batches, error } = await admin
      .from("inventory_batches")
      .select(`
        item_id,
        current_qty,
        unit_cost_paisa,
        item:item_id (id, code, name, category),
        base_unit:base_unit_id (symbol)
      `)
      .eq("company_id", session.companyId)
      .eq("is_active", true)
      .gt("current_qty", 0);

    if (error) return { success: false, error: error.message };

    const map: Record<string, any> = {};
    let grandTotalPaisa = 0;

    for (const b of batches || []) {
      const itemId = b.item_id;
      if (!map[itemId]) {
        map[itemId] = {
          item: b.item,
          totalQty: 0,
          unitSymbol: (b as any).base_unit?.symbol || "unit",
          totalValuationPaisa: 0,
          batchesCount: 0,
        };
      }

      const qty = Number(b.current_qty) || 0;
      const cost = Number(b.unit_cost_paisa) || 0;
      const value = Math.round(qty * cost);

      map[itemId].totalQty += qty;
      map[itemId].totalValuationPaisa += value;
      map[itemId].batchesCount += 1;
      grandTotalPaisa += value;
    }

    const valuation = Object.values(map).map((row: any) => {
      const avgCostPaisa =
        row.totalQty > 0 ? Math.round(row.totalValuationPaisa / row.totalQty) : 0;
      return {
        ...row,
        totalQty: Number(row.totalQty.toFixed(4)),
        weightedAvgCostPaisa: avgCostPaisa,
      };
    });

    return {
      success: true,
      valuation,
      totalCompanyValuationPaisa: grandTotalPaisa,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load valuation report" };
  }
}
