"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserSession } from "@/modules/auth/actions";
import {
  goodsReceiptSchema,
  GoodsReceiptInput,
} from "./grn-schema";
import {
  GoodsReceiptNote,
  InventoryBatch,
  StockMovement,
  GrnStatus,
} from "@/types/database";
import { revalidatePath } from "next/cache";

export async function createGoodsReceipt(rawInput: GoodsReceiptInput): Promise<{
  success: boolean;
  grnId?: string;
  grnNumber?: string;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    if (!["OWNER", "ADMIN", "SUPERVISOR", "WAREHOUSE"].includes(session.role)) {
      return { success: false, error: "Access Denied: Only Warehouse or Admin staff can create goods receipts." };
    }

    const validated = goodsReceiptSchema.safeParse(rawInput);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.issues.map((i) => i.message).join(", "),
      };
    }

    const input = validated.data;
    const admin = createAdminClient();

    // Verify PO is eligible
    const { data: po, error: poErr } = await admin
      .from("purchase_orders")
      .select("id, status, supplier_id, branch_id, delivery_warehouse_id")
      .eq("company_id", session.companyId)
      .eq("id", input.purchaseOrderId)
      .single();

    if (poErr || !po) {
      return { success: false, error: "Selected Purchase Order not found." };
    }

    if (!["APPROVED", "PARTIALLY_RECEIVED"].includes(po.status)) {
      return {
        success: false,
        error: `Purchase Order cannot be received. Current status: ${po.status}. Must be APPROVED.`,
      };
    }

    // Generate concurrency-safe GRN code
    const { data: codeData, error: codeErr } = await admin.rpc("get_next_company_code", {
      p_company_id: session.companyId,
      p_counter_type: "GRN",
      p_prefix: "GRN",
      p_pad_length: 5,
    });

    let grnNumber = codeData;
    if (codeErr || !grnNumber) {
      const { count } = await admin
        .from("goods_receipt_notes")
        .select("id", { count: "exact", head: true })
        .eq("company_id", session.companyId);
      grnNumber = `GRN-${String((count || 0) + 1).padStart(5, "0")}`;
    }

    // Insert Header
    const { data: grnRecord, error: grnErr } = await admin
      .from("goods_receipt_notes")
      .insert({
        company_id: session.companyId,
        branch_id: input.branchId,
        warehouse_id: input.warehouseId,
        grn_number: grnNumber,
        purchase_order_id: input.purchaseOrderId,
        supplier_id: input.supplierId,
        receiving_employee_id: session.userId,
        receipt_date: input.receiptDate,
        supplier_delivery_challan: input.supplierDeliveryChallan.trim(),
        status: "DRAFT",
        notes: input.notes ? input.notes.trim() : null,
      })
      .select("id")
      .single();

    if (grnErr) return { success: false, error: grnErr.message };

    // Insert Lines
    const linesPayload = input.lines.map((l) => ({
      company_id: session.companyId,
      grn_id: grnRecord.id,
      po_line_id: l.poLineId,
      item_id: l.itemId,
      received_qty: l.receivedQty,
      accepted_qty: l.acceptedQty,
      rejected_qty: l.rejectedQty,
      damaged_qty: l.damagedQty,
      unit_id: l.unitId,
      conversion_rate: l.conversionRate || 1.0,
      base_accepted_qty: Number((l.acceptedQty * (l.conversionRate || 1.0)).toFixed(4)),
      supplier_batch_number: l.supplierBatchNumber ? l.supplierBatchNumber.trim() : null,
      manufacturing_date: l.manufacturingDate || null,
      expiry_date: l.expiryDate || null,
      qc_status: l.qcStatus,
      rejection_reason: l.rejectionReason ? l.rejectionReason.trim() : null,
    }));

    const { error: linesErr } = await admin.from("goods_receipt_note_lines").insert(linesPayload);
    if (linesErr) {
      await admin.from("goods_receipt_notes").delete().eq("id", grnRecord.id);
      return { success: false, error: linesErr.message };
    }

    // Audit Log
    await admin.from("audit_logs").insert({
      company_id: session.companyId,
      user_id: session.userId,
      action: "CREATE_GOODS_RECEIPT",
      entity_name: "goods_receipt_notes",
      entity_id: grnRecord.id,
      new_values: { grn_number: grnNumber, po_id: input.purchaseOrderId },
    });

    revalidatePath("/goods-receipts");
    return { success: true, grnId: grnRecord.id, grnNumber };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create goods receipt" };
  }
}

export async function postGoodsReceipt(grnId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    if (!["OWNER", "ADMIN", "SUPERVISOR", "WAREHOUSE"].includes(session.role)) {
      return { success: false, error: "Access Denied: Only authorized warehouse personnel can post goods receipts." };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("post_goods_receipt", { p_grn_id: grnId });

    if (error) return { success: false, error: error.message };

    revalidatePath("/goods-receipts");
    revalidatePath(`/goods-receipts/${grnId}`);
    revalidatePath("/purchases");
    revalidatePath("/inventory/batches");
    revalidatePath("/inventory/stock");

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to post goods receipt" };
  }
}

export async function getGoodsReceipts(
  statusFilter?: GrnStatus,
  branchId?: string,
  search?: string
): Promise<{ success: boolean; goodsReceipts?: GoodsReceiptNote[]; error?: string }> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const admin = createAdminClient();
    let query = admin
      .from("goods_receipt_notes")
      .select(`
        *,
        branch:branch_id (id, code, name),
        warehouse:warehouse_id (id, code, name),
        purchase_order:purchase_order_id (id, po_number),
        supplier:supplier_id (id, code, name),
        receiving_employee:receiving_employee_id (id, full_name, email),
        posted_by_profile:posted_by (id, full_name, email)
      `)
      .eq("company_id", session.companyId)
      .order("created_at", { ascending: false });

    if (branchId) {
      query = query.eq("branch_id", branchId);
    } else if (session.role === "SUPERVISOR" && session.accessibleBranches?.length > 0) {
      query = query.in("branch_id", session.accessibleBranches.map((b) => b.id));
    }

    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      query = query.or(`grn_number.ilike.${q},supplier_delivery_challan.ilike.${q}`);
    }

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };

    return { success: true, goodsReceipts: (data as any) || [] };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load goods receipts" };
  }
}

export async function getGoodsReceiptById(id: string): Promise<{
  success: boolean;
  goodsReceipt?: GoodsReceiptNote;
  batches?: InventoryBatch[];
  stockMovements?: StockMovement[];
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const admin = createAdminClient();
    const { data: grn, error: grnErr } = await admin
      .from("goods_receipt_notes")
      .select(`
        *,
        branch:branch_id (id, code, name),
        warehouse:warehouse_id (id, code, name),
        purchase_order:purchase_order_id (id, po_number, order_date),
        supplier:supplier_id (id, code, name, trade_name, contact_person, mobile, gstin),
        receiving_employee:receiving_employee_id (id, full_name, email),
        posted_by_profile:posted_by (id, full_name, email),
        lines:goods_receipt_note_lines (
          *,
          item:item_id (id, code, name, item_type),
          unit:unit_id (id, code, name, symbol),
          po_line:po_line_id (ordered_qty, unit_price_paisa)
        )
      `)
      .eq("company_id", session.companyId)
      .eq("id", id)
      .single();

    if (grnErr) return { success: false, error: grnErr.message };

    // Fetch associated batches if posted
    const { data: batches } = await admin
      .from("inventory_batches")
      .select("*, item:item_id (code, name), base_unit:base_unit_id (code, symbol)")
      .eq("company_id", session.companyId)
      .eq("grn_id", id);

    // Fetch stock movements
    const { data: movements } = await admin
      .from("stock_movements")
      .select("*, item:item_id (code, name), base_unit:base_unit_id (code, symbol)")
      .eq("company_id", session.companyId)
      .eq("reference_type", "GOODS_RECEIPT_NOTE")
      .eq("reference_id", id);

    return {
      success: true,
      goodsReceipt: grn as any,
      batches: (batches as any) || [],
      stockMovements: (movements as any) || [],
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load goods receipt note" };
  }
}

export async function getInventoryBatches(
  itemId?: string,
  warehouseId?: string
): Promise<{ success: boolean; batches?: InventoryBatch[]; error?: string }> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const admin = createAdminClient();
    let query = admin
      .from("inventory_batches")
      .select(`
        *,
        item:item_id (id, code, name, item_type),
        warehouse:warehouse_id (id, code, name),
        base_unit:base_unit_id (id, code, symbol),
        supplier:supplier_id (id, code, name),
        grn:grn_id (id, grn_number)
      `)
      .eq("company_id", session.companyId)
      .order("created_at", { ascending: false });

    if (itemId) query = query.eq("item_id", itemId);
    if (warehouseId) query = query.eq("warehouse_id", warehouseId);

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };

    return { success: true, batches: (data as any) || [] };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load inventory batches" };
  }
}

export async function getStockMovements(
  itemId?: string,
  warehouseId?: string
): Promise<{ success: boolean; movements?: StockMovement[]; error?: string }> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const admin = createAdminClient();
    let query = admin
      .from("stock_movements")
      .select(`
        *,
        item:item_id (id, code, name),
        warehouse:warehouse_id (id, code, name),
        base_unit:base_unit_id (id, code, symbol),
        batch:batch_id (id, batch_number, expiry_date),
        creator:created_by (id, full_name, email)
      `)
      .eq("company_id", session.companyId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (itemId) query = query.eq("item_id", itemId);
    if (warehouseId) query = query.eq("warehouse_id", warehouseId);

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };

    return { success: true, movements: (data as any) || [] };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load stock movements" };
  }
}
