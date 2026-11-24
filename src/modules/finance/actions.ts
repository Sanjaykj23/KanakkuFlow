"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserSession } from "@/modules/auth/actions";
import {
  createInvoiceFromOrderSchema,
  customerPaymentSchema,
  creditNoteSchema,
  customerCreditLimitUpdateSchema,
  CreateInvoiceFromOrderInput,
  CustomerPaymentInput,
  CreditNoteInput,
  CustomerCreditLimitUpdateInput,
} from "./schema";
import {
  SalesInvoice,
  CustomerPayment,
  CreditNote,
  CustomerReceivablesLedgerEntry,
} from "@/types/database";
import { revalidatePath } from "next/cache";

// ============================================================================
// 1. SALES INVOICE ACTIONS
// ============================================================================

export async function getSalesInvoices(filters?: {
  customerId?: string;
  status?: string;
  branchId?: string;
}): Promise<{
  success: boolean;
  invoices?: SalesInvoice[];
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const admin = createAdminClient();
    let query = admin
      .from("sales_invoices")
      .select(`
        *,
        customer:customer_id (id, customer_code, shop_name, owner_name, mobile_number, gstin),
        branch:branch_id (id, name, code, state_code),
        sales_order:sales_order_id (id, order_number),
        lines:sales_invoice_lines (
          id,
          sku,
          item_name,
          hsn_code,
          quantity,
          unit_code,
          unit_price_paisa,
          discount_amount_paisa,
          taxable_value_paisa,
          gst_rate_percent,
          line_total_paisa
        )
      `)
      .eq("company_id", session.companyId)
      .order("invoice_date", { ascending: false });

    if (filters?.customerId) {
      query = query.eq("customer_id", filters.customerId);
    }
    if (filters?.status && filters.status !== "ALL") {
      query = query.eq("status", filters.status);
    }
    if (filters?.branchId && filters.branchId !== "ALL") {
      query = query.eq("branch_id", filters.branchId);
    }

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };

    return { success: true, invoices: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load sales invoices" };
  }
}

export async function getSalesInvoiceById(id: string): Promise<{
  success: boolean;
  invoice?: SalesInvoice;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("sales_invoices")
      .select(`
        *,
        customer:customer_id (*),
        branch:branch_id (*),
        sales_order:sales_order_id (*),
        lines:sales_invoice_lines (*),
        allocations:customer_payment_allocations (
          *,
          payment:payment_id (*)
        ),
        credit_notes:credit_notes (*)
      `)
      .eq("company_id", session.companyId)
      .eq("id", id)
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, invoice: data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load sales invoice" };
  }
}

export async function createInvoiceFromOrderAction(
  rawInput: CreateInvoiceFromOrderInput
): Promise<{
  success: boolean;
  invoiceId?: string;
  invoiceNumber?: string;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    if (!["OWNER", "ADMIN", "ACCOUNTANT", "SUPERVISOR"].includes(session.role)) {
      return { success: false, error: "Access Denied: Only billing managers can post tax invoices." };
    }

    const validated = createInvoiceFromOrderSchema.safeParse(rawInput);
    if (!validated.success) {
      return { success: false, error: validated.error.issues.map((i) => i.message).join(", ") };
    }

    const d = validated.data;
    const supabase = await createClient();

    const { data, error: rpcErr } = await supabase.rpc("create_and_post_sales_invoice", {
      p_order_id: d.orderId,
      p_notes: d.notes || null,
    });

    if (rpcErr) return { success: false, error: rpcErr.message };

    revalidatePath("/finance/invoices");
    revalidatePath(`/sales/orders/${d.orderId}`);
    return {
      success: true,
      invoiceId: data?.invoice_id,
      invoiceNumber: data?.invoice_number,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to post invoice" };
  }
}

// ============================================================================
// 2. CUSTOMER PAYMENT & ALLOCATION ACTIONS
// ============================================================================

export async function getCustomerPayments(filters?: {
  customerId?: string;
  branchId?: string;
}): Promise<{
  success: boolean;
  payments?: CustomerPayment[];
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const admin = createAdminClient();
    let query = admin
      .from("customer_payments")
      .select(`
        *,
        customer:customer_id (id, customer_code, shop_name, owner_name),
        branch:branch_id (id, name, code),
        allocations:customer_payment_allocations (
          id,
          allocated_amount_paisa,
          invoice:invoice_id (id, invoice_number, total_amount_paisa)
        )
      `)
      .eq("company_id", session.companyId)
      .order("payment_date", { ascending: false });

    if (filters?.customerId) {
      query = query.eq("customer_id", filters.customerId);
    }
    if (filters?.branchId && filters.branchId !== "ALL") {
      query = query.eq("branch_id", filters.branchId);
    }

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };

    return { success: true, payments: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load customer payments" };
  }
}

export async function recordCustomerPaymentAction(
  rawInput: CustomerPaymentInput
): Promise<{
  success: boolean;
  paymentId?: string;
  paymentNumber?: string;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    if (!["OWNER", "ADMIN", "ACCOUNTANT"].includes(session.role)) {
      return { success: false, error: "Access Denied: Only finance managers can post payments." };
    }

    const validated = customerPaymentSchema.safeParse(rawInput);
    if (!validated.success) {
      return { success: false, error: validated.error.issues.map((i) => i.message).join(", ") };
    }

    const d = validated.data;
    const amountPaisa = Math.round(d.amount * 100);

    const allocationsPayload = (d.allocations || []).map((a) => ({
      invoice_id: a.invoiceId,
      amount_paisa: Math.round(a.amount * 100),
    }));

    const supabase = await createClient();
    const { data, error: rpcErr } = await supabase.rpc("record_customer_payment", {
      p_customer_id: d.customerId,
      p_branch_id: d.branchId,
      p_payment_method: d.paymentMethod,
      p_amount_paisa: amountPaisa,
      p_reference_number: d.referenceNumber || null,
      p_notes: d.notes || null,
      p_allocations: allocationsPayload,
    });

    if (rpcErr) return { success: false, error: rpcErr.message };

    revalidatePath("/finance/payments");
    revalidatePath("/finance/invoices");
    revalidatePath("/finance/outstanding");
    return {
      success: true,
      paymentId: data?.payment_id,
      paymentNumber: data?.payment_number,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to record customer payment" };
  }
}

// ============================================================================
// 3. CREDIT NOTES
// ============================================================================

export async function getCreditNotes(filters?: {
  customerId?: string;
  invoiceId?: string;
}): Promise<{
  success: boolean;
  creditNotes?: CreditNote[];
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const admin = createAdminClient();
    let query = admin
      .from("credit_notes")
      .select(`
        *,
        customer:customer_id (id, shop_name, owner_name),
        branch:branch_id (id, name, code),
        original_invoice:original_invoice_id (id, invoice_number, total_amount_paisa)
      `)
      .eq("company_id", session.companyId)
      .order("credit_note_date", { ascending: false });

    if (filters?.customerId) {
      query = query.eq("customer_id", filters.customerId);
    }
    if (filters?.invoiceId) {
      query = query.eq("original_invoice_id", filters.invoiceId);
    }

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };

    return { success: true, creditNotes: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load credit notes" };
  }
}

export async function issueCreditNoteAction(
  rawInput: CreditNoteInput
): Promise<{
  success: boolean;
  creditNoteId?: string;
  creditNoteNumber?: string;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    if (!["OWNER", "ADMIN", "ACCOUNTANT"].includes(session.role)) {
      return { success: false, error: "Access Denied: Only finance managers can issue credit notes." };
    }

    const validated = creditNoteSchema.safeParse(rawInput);
    if (!validated.success) {
      return { success: false, error: validated.error.issues.map((i) => i.message).join(", ") };
    }

    const d = validated.data;
    const admin = createAdminClient();

    // Verify invoice
    const { data: invoice, error: invErr } = await admin
      .from("sales_invoices")
      .select("id, place_of_supply, branch_id, branches:branch_id(state_code)")
      .eq("company_id", session.companyId)
      .eq("id", d.invoiceId)
      .single();

    if (invErr || !invoice) return { success: false, error: "Invoice not found." };

    const branchData = invoice.branches as unknown as { state_code?: string } | { state_code?: string }[] | null;
    const branchStateCode = Array.isArray(branchData) ? branchData[0]?.state_code : branchData?.state_code;
    const isIntraState =
      branchStateCode && invoice.place_of_supply
        ? branchStateCode.trim().toUpperCase() === invoice.place_of_supply.trim().toUpperCase()
        : true;

    let totalTaxablePaisa = 0;
    let totalCgstPaisa = 0;
    let totalSgstPaisa = 0;
    let totalIgstPaisa = 0;

    for (const l of d.lines) {
      const taxablePaisa = Math.round(l.taxableAmount * 100);
      const taxPaisa = Math.round((taxablePaisa * (l.gstRate || 0)) / 100);

      totalTaxablePaisa += taxablePaisa;

      if (isIntraState) {
        const cgst = Math.round(taxPaisa / 2);
        const sgst = taxPaisa - cgst;
        totalCgstPaisa += cgst;
        totalSgstPaisa += sgst;
      } else {
        totalIgstPaisa += taxPaisa;
      }
    }

    const totalCreditAmountPaisa =
      totalTaxablePaisa + totalCgstPaisa + totalSgstPaisa + totalIgstPaisa;

    const supabase = await createClient();
    const { data, error: rpcErr } = await supabase.rpc("issue_credit_note", {
      p_invoice_id: d.invoiceId,
      p_reason: d.reason,
      p_amount_paisa: totalCreditAmountPaisa,
      p_taxable_paisa: totalTaxablePaisa,
      p_cgst_paisa: totalCgstPaisa,
      p_sgst_paisa: totalSgstPaisa,
      p_igst_paisa: totalIgstPaisa,
    });

    if (rpcErr) return { success: false, error: rpcErr.message };

    revalidatePath("/finance/credit-notes");
    revalidatePath(`/finance/invoices/${d.invoiceId}`);
    return {
      success: true,
      creditNoteId: data?.credit_note_id,
      creditNoteNumber: data?.credit_note_number,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to issue credit note" };
  }
}

// ============================================================================
// 4. RECEIVABLES LEDGER & AGING SUMMARY
// ============================================================================

export async function getCustomerReceivablesLedger(
  customerId?: string
): Promise<{
  success: boolean;
  ledger?: CustomerReceivablesLedgerEntry[];
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const admin = createAdminClient();
    let query = admin
      .from("customer_receivables_ledger")
      .select(`
        *,
        customer:customer_id (id, shop_name, owner_name),
        branch:branch_id (id, name, code)
      `)
      .eq("company_id", session.companyId)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (customerId) {
      query = query.eq("customer_id", customerId);
    }

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };

    return { success: true, ledger: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load receivables ledger" };
  }
}

export interface AgingBucketSummary {
  customerId: string;
  customerCode: string;
  shopName: string;
  ownerName: string;
  mobileNumber: string;
  creditLimitPaisa: number;
  totalOutstandingPaisa: number;
  notYetDuePaisa: number;
  days1To30Paisa: number;
  days31To60Paisa: number;
  days61To90Paisa: number;
  daysOver90Paisa: number;
}

export async function getCustomerOutstandingAging(): Promise<{
  success: boolean;
  aging?: AgingBucketSummary[];
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const admin = createAdminClient();
    // Retrieve all posted/partially paid invoices with outstanding > 0
    const { data: invoices, error } = await admin
      .from("sales_invoices")
      .select(`
        id,
        invoice_number,
        due_date,
        outstanding_amount_paisa,
        customer:customer_id (
          id,
          customer_code,
          shop_name,
          owner_name,
          mobile_number,
          credit_limit
        )
      `)
      .eq("company_id", session.companyId)
      .in("status", ["POSTED", "PARTIALLY_PAID"])
      .gt("outstanding_amount_paisa", 0);

    if (error) return { success: false, error: error.message };

    const now = new Date();
    const customerMap: Record<string, AgingBucketSummary> = {};

    for (const inv of invoices || []) {
      const c = inv.customer as any;
      if (!c) continue;

      if (!customerMap[c.id]) {
        customerMap[c.id] = {
          customerId: c.id,
          customerCode: c.customer_code,
          shopName: c.shop_name,
          ownerName: c.owner_name,
          mobileNumber: c.mobile_number,
          creditLimitPaisa: Math.round(Number(c.credit_limit || 0) * 100),
          totalOutstandingPaisa: 0,
          notYetDuePaisa: 0,
          days1To30Paisa: 0,
          days31To60Paisa: 0,
          days61To90Paisa: 0,
          daysOver90Paisa: 0,
        };
      }

      const bal = Number(inv.outstanding_amount_paisa || 0);
      customerMap[c.id].totalOutstandingPaisa += bal;

      const dueDate = new Date(inv.due_date);
      const diffDays = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) {
        customerMap[c.id].notYetDuePaisa += bal;
      } else if (diffDays <= 30) {
        customerMap[c.id].days1To30Paisa += bal;
      } else if (diffDays <= 60) {
        customerMap[c.id].days31To60Paisa += bal;
      } else if (diffDays <= 90) {
        customerMap[c.id].days61To90Paisa += bal;
      } else {
        customerMap[c.id].daysOver90Paisa += bal;
      }
    }

    const agingList = Object.values(customerMap).sort(
      (a, b) => b.totalOutstandingPaisa - a.totalOutstandingPaisa
    );

    return { success: true, aging: agingList };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to calculate aging summary" };
  }
}

// ============================================================================
// 5. FINANCE METRICS & CREDIT LIMIT UPDATE
// ============================================================================

export async function getFinanceMetrics(): Promise<{
  success: boolean;
  metrics?: {
    totalInvoicedPaisa: number;
    totalCollectionsPaisa: number;
    totalOutstandingPaisa: number;
    overdueInvoicesCount: number;
  };
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const admin = createAdminClient();
    const [invRes, payRes] = await Promise.all([
      admin
        .from("sales_invoices")
        .select("total_amount_paisa, outstanding_amount_paisa, due_date, status")
        .eq("company_id", session.companyId),
      admin
        .from("customer_payments")
        .select("amount_paisa")
        .eq("company_id", session.companyId)
        .eq("status", "POSTED"),
    ]);

    const invoices = invRes.data || [];
    const payments = payRes.data || [];

    const totalInvoicedPaisa = invoices
      .filter((i) => !["CANCELLED", "DRAFT"].includes(i.status))
      .reduce((acc, i) => acc + (i.total_amount_paisa || 0), 0);

    const totalCollectionsPaisa = payments.reduce((acc, p) => acc + (p.amount_paisa || 0), 0);

    const totalOutstandingPaisa = invoices
      .filter((i) => ["POSTED", "PARTIALLY_PAID"].includes(i.status))
      .reduce((acc, i) => acc + (i.outstanding_amount_paisa || 0), 0);

    const todayStr = new Date().toISOString().split("T")[0];
    const overdueInvoicesCount = invoices.filter(
      (i) =>
        ["POSTED", "PARTIALLY_PAID"].includes(i.status) &&
        i.outstanding_amount_paisa > 0 &&
        i.due_date < todayStr
    ).length;

    return {
      success: true,
      metrics: {
        totalInvoicedPaisa,
        totalCollectionsPaisa,
        totalOutstandingPaisa,
        overdueInvoicesCount,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load finance metrics" };
  }
}

export async function updateCustomerCreditLimitAction(
  rawInput: CustomerCreditLimitUpdateInput
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
      return { success: false, error: "Access Denied: Only Owner or Admin can alter customer credit limits." };
    }

    const validated = customerCreditLimitUpdateSchema.safeParse(rawInput);
    if (!validated.success) {
      return { success: false, error: validated.error.issues.map((i) => i.message).join(", ") };
    }

    const d = validated.data;
    const admin = createAdminClient();

    const { error } = await admin
      .from("customers")
      .update({
        credit_limit: d.newCreditLimit,
        payment_terms_days: d.paymentTermsDays,
        updated_at: new Date().toISOString(),
      })
      .eq("company_id", session.companyId)
      .eq("id", d.customerId);

    if (error) return { success: false, error: error.message };

    await admin.from("audit_logs").insert({
      company_id: session.companyId,
      user_id: session.userId,
      action: "UPDATE_CUSTOMER_CREDIT_LIMIT",
      entity_name: "customers",
      entity_id: d.customerId,
      new_values: {
        new_credit_limit: d.newCreditLimit,
        payment_terms_days: d.paymentTermsDays,
        reason: d.reason,
      },
    });

    revalidatePath("/finance/outstanding");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update credit limit" };
  }
}
