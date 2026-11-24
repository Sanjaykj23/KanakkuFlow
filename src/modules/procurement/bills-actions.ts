"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserSession } from "@/modules/auth/actions";
import { supplierBillSchema, SupplierBillInput } from "./bills-schema";
import { SupplierBill, SupplierBillStatus } from "@/types/database";
import { revalidatePath } from "next/cache";

export async function createSupplierBill(rawInput: SupplierBillInput): Promise<{
  success: boolean;
  billId?: string;
  billNumber?: string;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    if (!["OWNER", "ADMIN", "ACCOUNTANT"].includes(session.role)) {
      return { success: false, error: "Access Denied: Only Accountant or Admin can record supplier bills." };
    }

    const validated = supplierBillSchema.safeParse(rawInput);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.issues.map((i) => i.message).join(", "),
      };
    }

    const d = validated.data;
    const admin = createAdminClient();

    // Prevent duplicate invoice number for the same supplier
    const { data: existingInvoice } = await admin
      .from("supplier_bills")
      .select("id")
      .eq("company_id", session.companyId)
      .eq("supplier_id", d.supplierId)
      .eq("supplier_invoice_number", d.supplierInvoiceNumber.trim().toUpperCase())
      .maybeSingle();

    if (existingInvoice) {
      return {
        success: false,
        error: `Duplicate Bill: Invoice number "${d.supplierInvoiceNumber}" has already been recorded for this supplier.`,
      };
    }

    // Concurrency-safe Bill Code
    const { data: codeData, error: codeErr } = await admin.rpc("get_next_company_code", {
      p_company_id: session.companyId,
      p_counter_type: "BILL",
      p_prefix: "BILL",
      p_pad_length: 5,
    });

    let billNumber = codeData;
    if (codeErr || !billNumber) {
      const { count } = await admin
        .from("supplier_bills")
        .select("id", { count: "exact", head: true })
        .eq("company_id", session.companyId);
      billNumber = `BILL-${String((count || 0) + 1).padStart(5, "0")}`;
    }

    const taxablePaisa = Math.round(d.taxableAmount * 100);
    const taxPaisa = Math.round(d.taxAmount * 100);
    const freightPaisa = Math.round(d.freightCharges * 100);
    const discountPaisa = Math.round(d.discount * 100);
    const totalPaisa = Math.max(0, taxablePaisa + taxPaisa + freightPaisa - discountPaisa);

    const { data: billRecord, error: billErr } = await admin
      .from("supplier_bills")
      .insert({
        company_id: session.companyId,
        branch_id: d.branchId,
        bill_number: billNumber,
        supplier_id: d.supplierId,
        supplier_invoice_number: d.supplierInvoiceNumber.trim().toUpperCase(),
        invoice_date: d.invoiceDate,
        due_date: d.dueDate,
        purchase_order_id: d.purchaseOrderId || null,
        grn_id: d.grnId || null,
        taxable_amount_paisa: taxablePaisa,
        tax_amount_paisa: taxPaisa,
        freight_charges_paisa: freightPaisa,
        discount_paisa: discountPaisa,
        total_amount_paisa: totalPaisa,
        status: "DRAFT",
        created_by: session.userId,
      })
      .select("id")
      .single();

    if (billErr) return { success: false, error: billErr.message };

    // Auto-match against PO/GRN to detect discrepancies
    const supabase = await createClient();
    await supabase.rpc("match_supplier_bill", { p_bill_id: billRecord.id });

    // Audit Log
    await admin.from("audit_logs").insert({
      company_id: session.companyId,
      user_id: session.userId,
      action: "CREATE_SUPPLIER_BILL",
      entity_name: "supplier_bills",
      entity_id: billRecord.id,
      new_values: { bill_number: billNumber, total_paisa: totalPaisa },
    });

    revalidatePath("/supplier-bills");
    return { success: true, billId: billRecord.id, billNumber };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to record supplier bill" };
  }
}

export async function getSupplierBills(
  statusFilter?: SupplierBillStatus,
  supplierId?: string
): Promise<{ success: boolean; bills?: SupplierBill[]; error?: string }> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const admin = createAdminClient();
    let query = admin
      .from("supplier_bills")
      .select(`
        *,
        supplier:supplier_id (id, code, name),
        branch:branch_id (id, code, name),
        purchase_order:purchase_order_id (id, po_number),
        grn:grn_id (id, grn_number)
      `)
      .eq("company_id", session.companyId)
      .order("created_at", { ascending: false });

    if (statusFilter) query = query.eq("status", statusFilter);
    if (supplierId) query = query.eq("supplier_id", supplierId);

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };

    return { success: true, bills: (data as any) || [] };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load supplier bills" };
  }
}

export async function getSupplierPurchaseHistory(supplierId: string): Promise<{
  success: boolean;
  history?: {
    purchaseOrders: any[];
    goodsReceipts: any[];
    supplierBills: any[];
    metrics: {
      totalOrders: number;
      totalSpendPaisa: number;
      pendingOrders: number;
    };
  };
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const admin = createAdminClient();
    const [poRes, grnRes, billRes] = await Promise.all([
      admin
        .from("purchase_orders")
        .select("id, po_number, order_date, status, total_paisa, lines:purchase_order_lines(item:item_id(name), ordered_qty, unit:unit_id(symbol), unit_price_paisa)")
        .eq("company_id", session.companyId)
        .eq("supplier_id", supplierId)
        .order("created_at", { ascending: false }),
      admin
        .from("goods_receipt_notes")
        .select("id, grn_number, receipt_date, status, supplier_delivery_challan, lines:goods_receipt_note_lines(item:item_id(name), received_qty, accepted_qty, unit:unit_id(symbol))")
        .eq("company_id", session.companyId)
        .eq("supplier_id", supplierId)
        .order("created_at", { ascending: false }),
      admin
        .from("supplier_bills")
        .select("id, bill_number, supplier_invoice_number, invoice_date, due_date, total_amount_paisa, status, discrepancy_notes")
        .eq("company_id", session.companyId)
        .eq("supplier_id", supplierId)
        .order("created_at", { ascending: false }),
    ]);

    const pos = poRes.data || [];
    const grns = grnRes.data || [];
    const bills = billRes.data || [];

    const totalSpendPaisa = bills.reduce((acc, b) => acc + (b.total_amount_paisa || 0), 0);
    const pendingOrders = pos.filter((p) => ["SUBMITTED", "APPROVED", "PARTIALLY_RECEIVED"].includes(p.status)).length;

    return {
      success: true,
      history: {
        purchaseOrders: pos,
        goodsReceipts: grns,
        supplierBills: bills,
        metrics: {
          totalOrders: pos.length,
          totalSpendPaisa,
          pendingOrders,
        },
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load supplier purchase history" };
  }
}
