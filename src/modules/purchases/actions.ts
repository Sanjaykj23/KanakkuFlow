"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserSession } from "@/modules/auth/actions";
import {
  purchaseOrderSchema,
  rejectPurchaseOrderSchema,
  cancelPurchaseOrderSchema,
  PurchaseOrderInput,
  RejectPurchaseOrderInput,
  CancelPurchaseOrderInput,
} from "./schema";
import { PurchaseOrder, PurchaseOrderStatus } from "@/types/database";
import { revalidatePath } from "next/cache";

export async function createPurchaseOrder(rawInput: PurchaseOrderInput): Promise<{
  success: boolean;
  poId?: string;
  poNumber?: string;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) {
      return { success: false, error: "Unauthorized session." };
    }

    if (!["OWNER", "ADMIN", "SUPERVISOR", "ACCOUNTANT"].includes(session.role)) {
      return { success: false, error: "Access Denied: You do not have permission to create purchase orders." };
    }

    const validated = purchaseOrderSchema.safeParse(rawInput);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.issues.map((i) => i.message).join(", "),
      };
    }

    const input = validated.data;
    const admin = createAdminClient();

    // 1. Concurrency-safe PO number generation
    const { data: codeData, error: codeErr } = await admin.rpc("get_next_company_code", {
      p_company_id: session.companyId,
      p_counter_type: "PO",
      p_prefix: "PO",
      p_pad_length: 5,
    });

    let poNumber = codeData;
    if (codeErr || !poNumber) {
      const { count } = await admin
        .from("purchase_orders")
        .select("id", { count: "exact", head: true })
        .eq("company_id", session.companyId);
      poNumber = `PO-${String((count || 0) + 1).padStart(5, "0")}`;
    }

    // 2. Financial calculation in integer paisa (avoiding IEEE-754 floating point drift)
    let subtotalPaisa = 0;
    let totalTaxPaisa = 0;
    let totalDiscountPaisa = 0;

    const calculatedLines = input.lines.map((line, index) => {
      const unitPricePaisa = Math.round(line.unitPrice * 100);
      const discountPaisa = Math.round(line.discount * 100);
      const baseQty = Number((line.orderedQty * (line.conversionRate || 1.0)).toFixed(4));

      const taxablePaisa = Math.max(0, Math.round(line.orderedQty * unitPricePaisa - discountPaisa));
      const lineTaxPaisa = Math.round(taxablePaisa * (line.taxRateSnapshot / 100));
      const lineTotalPaisa = taxablePaisa + lineTaxPaisa;

      subtotalPaisa += Math.round(line.orderedQty * unitPricePaisa);
      totalDiscountPaisa += discountPaisa;
      totalTaxPaisa += lineTaxPaisa;

      return {
        company_id: session.companyId,
        line_number: index + 1,
        item_id: line.itemId,
        ordered_qty: line.orderedQty,
        unit_id: line.unitId,
        conversion_rate: line.conversionRate || 1.0,
        base_unit_qty: baseQty,
        unit_price_paisa: unitPricePaisa,
        discount_paisa: discountPaisa,
        tax_rate_id: line.taxRateId || null,
        tax_rate_snapshot: line.taxRateSnapshot,
        tax_paisa: lineTaxPaisa,
        total_paisa: lineTotalPaisa,
        received_qty: 0,
        pending_qty: line.orderedQty,
        notes: line.notes ? line.notes.trim() : null,
      };
    });

    const totalPaisa = Math.max(0, subtotalPaisa - totalDiscountPaisa + totalTaxPaisa);

    // 3. Insert Purchase Order Header
    const { data: poRecord, error: poErr } = await admin
      .from("purchase_orders")
      .insert({
        company_id: session.companyId,
        branch_id: input.branchId,
        po_number: poNumber,
        supplier_id: input.supplierId,
        delivery_warehouse_id: input.deliveryWarehouseId,
        order_date: input.orderDate,
        expected_delivery_date: input.expectedDeliveryDate,
        status: "DRAFT",
        created_by: session.userId,
        currency: "INR",
        subtotal_paisa: subtotalPaisa,
        tax_paisa: totalTaxPaisa,
        discount_paisa: totalDiscountPaisa,
        total_paisa: totalPaisa,
        notes: input.notes ? input.notes.trim() : null,
      })
      .select("id")
      .single();

    if (poErr) {
      return { success: false, error: poErr.message };
    }

    // 4. Insert Purchase Order Lines
    const linesPayload = calculatedLines.map((l) => ({
      ...l,
      purchase_order_id: poRecord.id,
    }));

    const { error: linesErr } = await admin.from("purchase_order_lines").insert(linesPayload);
    if (linesErr) {
      // Rollback PO header
      await admin.from("purchase_orders").delete().eq("id", poRecord.id);
      return { success: false, error: linesErr.message };
    }

    // 5. Audit Log
    await admin.from("audit_logs").insert({
      company_id: session.companyId,
      user_id: session.userId,
      action: "CREATE_PURCHASE_ORDER",
      entity_name: "purchase_orders",
      entity_id: poRecord.id,
      new_values: { po_number: poNumber, total_paisa: totalPaisa },
    });

    revalidatePath("/purchases");
    return { success: true, poId: poRecord.id, poNumber };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create purchase order" };
  }
}

export async function submitPurchaseOrder(poId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const supabase = await createClient();
    const { error } = await supabase.rpc("submit_purchase_order", { p_po_id: poId });

    if (error) return { success: false, error: error.message };

    revalidatePath("/purchases");
    revalidatePath(`/purchases/${poId}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to submit purchase order" };
  }
}

export async function approvePurchaseOrder(poId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    if (!["OWNER", "ADMIN"].includes(session.role)) {
      return { success: false, error: "Access Denied: Only Owner or Admin can approve purchase orders." };
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("approve_purchase_order", { p_po_id: poId });

    if (error) return { success: false, error: error.message };

    revalidatePath("/purchases");
    revalidatePath(`/purchases/${poId}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to approve purchase order" };
  }
}

export async function rejectPurchaseOrder(rawInput: RejectPurchaseOrderInput): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    if (!["OWNER", "ADMIN"].includes(session.role)) {
      return { success: false, error: "Access Denied: Only Owner or Admin can reject purchase orders." };
    }

    const validated = rejectPurchaseOrderSchema.safeParse(rawInput);
    if (!validated.success) {
      return { success: false, error: validated.error.issues.map((i) => i.message).join(", ") };
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("reject_purchase_order", {
      p_po_id: validated.data.poId,
      p_reason: validated.data.reason,
    });

    if (error) return { success: false, error: error.message };

    revalidatePath("/purchases");
    revalidatePath(`/purchases/${validated.data.poId}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to reject purchase order" };
  }
}

export async function cancelPurchaseOrder(rawInput: CancelPurchaseOrderInput): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const validated = cancelPurchaseOrderSchema.safeParse(rawInput);
    if (!validated.success) {
      return { success: false, error: validated.error.issues.map((i) => i.message).join(", ") };
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("cancel_purchase_order", {
      p_po_id: validated.data.poId,
      p_reason: validated.data.reason,
    });

    if (error) return { success: false, error: error.message };

    revalidatePath("/purchases");
    revalidatePath(`/purchases/${validated.data.poId}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to cancel purchase order" };
  }
}

export async function getPurchaseOrders(
  statusFilter?: PurchaseOrderStatus,
  branchId?: string,
  search?: string
): Promise<{ success: boolean; purchaseOrders?: PurchaseOrder[]; error?: string }> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const admin = createAdminClient();
    let query = admin
      .from("purchase_orders")
      .select(`
        *,
        branch:branch_id (id, code, name),
        supplier:supplier_id (id, code, name, contact_person, mobile),
        delivery_warehouse:delivery_warehouse_id (id, code, name),
        created_by_profile:created_by (id, full_name, email),
        approved_by_profile:approved_by (id, full_name, email)
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
      query = query.or(`po_number.ilike.${q}`);
    }

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };

    return { success: true, purchaseOrders: (data as any) || [] };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load purchase orders" };
  }
}

export async function getPurchaseOrderById(id: string): Promise<{
  success: boolean;
  purchaseOrder?: PurchaseOrder;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("purchase_orders")
      .select(`
        *,
        branch:branch_id (id, code, name),
        supplier:supplier_id (id, code, name, trade_name, contact_person, mobile, gstin, address_line1, city, state, pincode),
        delivery_warehouse:delivery_warehouse_id (id, code, name),
        created_by_profile:created_by (id, full_name, email),
        approved_by_profile:approved_by (id, full_name, email),
        lines:purchase_order_lines (
          *,
          item:item_id (id, code, name, item_type),
          unit:unit_id (id, code, name, symbol),
          tax_rate:tax_rate_id (id, name, igst_rate)
        )
      `)
      .eq("company_id", session.companyId)
      .eq("id", id)
      .single();

    if (error) return { success: false, error: error.message };

    return { success: true, purchaseOrder: data as any };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to get purchase order details" };
  }
}
