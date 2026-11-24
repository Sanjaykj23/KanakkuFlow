"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserSession } from "@/modules/auth/actions";
import {
  priceListSchema,
  priceListItemSchema,
  customerPricingSchema,
  salesOrderSchema,
  salesOrderApprovalSchema,
  salesOrderAllocationSchema,
  salesOrderCancellationSchema,
  PriceListInput,
  CustomerPricingInput,
  SalesOrderInput,
  SalesOrderApprovalInput,
  SalesOrderAllocationInput,
  SalesOrderCancellationInput,
} from "./schema";
import {
  PriceList,
  CustomerPricing,
  SalesOrder,
  SalesOrderLine,
  SalesOrderStatus,
} from "@/types/database";
import { revalidatePath } from "next/cache";

// ============================================================================
// 1. PRICE LISTS & PRICING ACTIONS
// ============================================================================

export async function getPriceLists(): Promise<{
  success: boolean;
  priceLists?: PriceList[];
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("price_lists")
      .select(`
        *,
        items:price_list_items (
          id,
          item_id,
          unit_id,
          price_paisa,
          min_selling_price_paisa,
          item:item_id (id, name, code),
          unit:unit_id (id, name, symbol)
        )
      `)
      .eq("company_id", session.companyId)
      .order("created_at", { ascending: false });

    if (error) return { success: false, error: error.message };
    return { success: true, priceLists: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load price lists" };
  }
}

export async function savePriceList(rawInput: PriceListInput): Promise<{
  success: boolean;
  priceListId?: string;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
      return { success: false, error: "Access Denied: Only Owner or Admin can manage price lists." };
    }

    const validated = priceListSchema.safeParse(rawInput);
    if (!validated.success) {
      return { success: false, error: validated.error.issues.map((i) => i.message).join(", ") };
    }

    const d = validated.data;
    const admin = createAdminClient();

    let listId = d.id;

    if (d.isDefault) {
      // Unset previous default
      await admin
        .from("price_lists")
        .update({ is_default: false })
        .eq("company_id", session.companyId);
    }

    if (listId) {
      const { error: updateErr } = await admin
        .from("price_lists")
        .update({
          code: d.code.toUpperCase(),
          name: d.name,
          list_type: d.listType,
          is_default: d.isDefault,
          is_active: d.isActive,
          valid_from: d.validFrom,
          valid_to: d.validTo || null,
          notes: d.notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq("company_id", session.companyId)
        .eq("id", listId);

      if (updateErr) return { success: false, error: updateErr.message };

      // Delete old items and insert fresh
      await admin
        .from("price_list_items")
        .delete()
        .eq("company_id", session.companyId)
        .eq("price_list_id", listId);
    } else {
      const { data: created, error: createErr } = await admin
        .from("price_lists")
        .insert({
          company_id: session.companyId,
          code: d.code.toUpperCase(),
          name: d.name,
          list_type: d.listType,
          is_default: d.isDefault,
          is_active: d.isActive,
          valid_from: d.validFrom,
          valid_to: d.validTo || null,
          notes: d.notes || null,
        })
        .select()
        .single();

      if (createErr) return { success: false, error: createErr.message };
      listId = created.id;
    }

    // Insert items
    const lineRecords = d.items.map((item) => ({
      company_id: session.companyId,
      price_list_id: listId,
      item_id: item.itemId,
      unit_id: item.unitId,
      price_paisa: Math.round(item.price * 100),
      min_selling_price_paisa: Math.round(item.minSellingPrice * 100),
    }));

    const { error: linesErr } = await admin.from("price_list_items").insert(lineRecords);
    if (linesErr) return { success: false, error: linesErr.message };

    await admin.from("audit_logs").insert({
      company_id: session.companyId,
      user_id: session.userId,
      action: d.id ? "UPDATE_PRICE_LIST" : "CREATE_PRICE_LIST",
      entity_name: "price_lists",
      entity_id: listId,
      new_values: { code: d.code, name: d.name, items_count: d.items.length },
    });

    revalidatePath("/sales/pricing");
    return { success: true, priceListId: listId };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to save price list" };
  }
}

export async function resolveItemPrice(
  customerId: string,
  itemId: string,
  unitId: string,
  priceListId?: string
): Promise<{
  success: boolean;
  pricePaisa?: number;
  minSellingPricePaisa?: number;
  source?: string;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_item_selling_price", {
      p_company_id: session.companyId,
      p_customer_id: customerId,
      p_item_id: itemId,
      p_unit_id: unitId,
      p_price_list_id: priceListId || null,
    });

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) {
      return { success: true, pricePaisa: 0, minSellingPricePaisa: 0, source: "NONE" };
    }

    return {
      success: true,
      pricePaisa: Number(data[0].price_paisa),
      minSellingPricePaisa: Number(data[0].min_selling_price_paisa),
      source: data[0].price_source,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to resolve item price" };
  }
}

// ============================================================================
// 2. CREDIT LIMIT & EXPOSURE CHECK
// ============================================================================

export async function checkCustomerCredit(customerId: string): Promise<{
  success: boolean;
  creditLimitPaisa?: number;
  pendingExposurePaisa?: number;
  availableCreditPaisa?: number;
  isCreditExceeded?: boolean;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("calculate_customer_available_credit", {
      p_company_id: session.companyId,
      p_customer_id: customerId,
    });

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) {
      return { success: false, error: "No credit data found" };
    }

    return {
      success: true,
      creditLimitPaisa: Number(data[0].credit_limit_paisa),
      pendingExposurePaisa: Number(data[0].pending_orders_exposure_paisa),
      availableCreditPaisa: Number(data[0].available_credit_paisa),
      isCreditExceeded: Boolean(data[0].is_credit_exceeded),
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to check credit limit" };
  }
}

// ============================================================================
// 3. SALES ORDER CRUD & WORKFLOW
// ============================================================================

export async function getSalesOrders(filters?: {
  status?: string;
  branchId?: string;
  customerId?: string;
}): Promise<{
  success: boolean;
  orders?: SalesOrder[];
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const admin = createAdminClient();
    let query = admin
      .from("sales_orders")
      .select(`
        *,
        customer:customer_id (id, customer_code, shop_name, owner_name, mobile_number, gstin),
        branch:branch_id (id, name, code, state_code),
        delivery_address:delivery_address_id (id, address_line1, city, state, pincode),
        salesman:assigned_salesman_id (id, email, raw_user_meta_data),
        price_list:price_list_id (id, name, code),
        lines:sales_order_lines (
          id,
          sku,
          ordered_qty,
          allocated_qty,
          dispatched_qty,
          unit_price_paisa,
          discount_amount_paisa,
          taxable_amount_paisa,
          line_total_paisa,
          item:item_id (id, name, code),
          unit:unit_id (id, name, symbol)
        )
      `)
      .eq("company_id", session.companyId)
      .order("created_at", { ascending: false });

    if (filters?.status && filters.status !== "ALL") {
      query = query.eq("status", filters.status);
    }
    if (filters?.branchId && filters.branchId !== "ALL") {
      query = query.eq("branch_id", filters.branchId);
    }
    if (filters?.customerId) {
      query = query.eq("customer_id", filters.customerId);
    }
    if (session.role === "SALESMAN") {
      query = query.eq("assigned_salesman_id", session.userId);
    }

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };

    return { success: true, orders: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load sales orders" };
  }
}

export async function getSalesOrderById(id: string): Promise<{
  success: boolean;
  order?: SalesOrder;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("sales_orders")
      .select(`
        *,
        customer:customer_id (*),
        branch:branch_id (*),
        delivery_address:delivery_address_id (*),
        salesman:assigned_salesman_id (id, email, raw_user_meta_data),
        price_list:price_list_id (*),
        lines:sales_order_lines (
          *,
          item:item_id (*),
          unit:unit_id (*),
          tax_rate:tax_rate_id (*)
        ),
        allocations:sales_order_allocations (
          *,
          batch:batch_id (*),
          warehouse:warehouse_id (*)
        )
      `)
      .eq("company_id", session.companyId)
      .eq("id", id)
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, order: data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load sales order" };
  }
}

export async function createSalesOrder(rawInput: SalesOrderInput): Promise<{
  success: boolean;
  orderId?: string;
  orderNumber?: string;
  status?: SalesOrderStatus;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const validated = salesOrderSchema.safeParse(rawInput);
    if (!validated.success) {
      return { success: false, error: validated.error.issues.map((i) => i.message).join(", ") };
    }

    const d = validated.data;
    const admin = createAdminClient();

    // 1. Verify Customer is Active and belongs to Company
    const { data: customer, error: custErr } = await admin
      .from("customers")
      .select("id, is_active, credit_limit, branch_id")
      .eq("company_id", session.companyId)
      .eq("id", d.customerId)
      .single();

    if (custErr || !customer) return { success: false, error: "Invalid customer selected." };
    if (!customer.is_active) {
      return { success: false, error: "Customer is suspended or inactive. Sales orders cannot be created." };
    }

    // 2. Resolve Tax Treatment (Seller Branch State vs Delivery Address State)
    const { data: branch } = await admin
      .from("branches")
      .select("state_code")
      .eq("company_id", session.companyId)
      .eq("id", d.branchId)
      .single();

    const { data: address } = await admin
      .from("customer_addresses")
      .select("state")
      .eq("company_id", session.companyId)
      .eq("id", d.deliveryAddressId)
      .single();

    const isIntraState =
      branch?.state_code && address?.state
        ? branch.state_code.trim().toUpperCase() === address.state.trim().toUpperCase()
        : true;

    // 3. Calculate Line Totals & Tax Snapshots in Integer Paisa
    let subtotalPaisa = 0;
    let totalDiscountPaisa = 0;
    let totalTaxPaisa = 0;
    let approvalReasons: string[] = [];

    const preparedLines: any[] = [];

    for (const line of d.lines) {
      const lineUnitRatePaisa = Math.round(line.unitPrice * 100);
      const grossLinePaisa = Math.round(line.orderedQty * lineUnitRatePaisa);

      const discountPercent = line.discountPercent || 0;
      const lineDiscountPaisa = Math.round((grossLinePaisa * discountPercent) / 100);
      const taxableAmountPaisa = Math.max(0, grossLinePaisa - lineDiscountPaisa);

      // Check discount approval threshold
      if (discountPercent > 5.0) {
        approvalReasons.push(`Line discount for SKU ${line.sku} exceeds 5% (${discountPercent}%)`);
      }

      // Fetch Tax Rate Snapshot
      let taxPercent = 0;
      if (line.taxRateId) {
        const { data: tr } = await admin
          .from("tax_rates")
          .select("rate")
          .eq("company_id", session.companyId)
          .eq("id", line.taxRateId)
          .single();
        if (tr) taxPercent = Number(tr.rate);
      }

      const totalLineTaxPaisa = Math.round((taxableAmountPaisa * taxPercent) / 100);
      let cgstPaisa = 0;
      let sgstPaisa = 0;
      let igstPaisa = 0;

      if (isIntraState) {
        cgstPaisa = Math.round(totalLineTaxPaisa / 2);
        sgstPaisa = totalLineTaxPaisa - cgstPaisa;
      } else {
        igstPaisa = totalLineTaxPaisa;
      }

      const lineTotalPaisa = taxableAmountPaisa + totalLineTaxPaisa;

      subtotalPaisa += grossLinePaisa;
      totalDiscountPaisa += lineDiscountPaisa;
      totalTaxPaisa += totalLineTaxPaisa;

      preparedLines.push({
        company_id: session.companyId,
        item_id: line.itemId,
        sku: line.sku,
        ordered_qty: line.orderedQty,
        allocated_qty: 0,
        dispatched_qty: 0,
        unit_id: line.unitId,
        conversion_rate: line.conversionRate,
        base_ordered_qty: line.orderedQty * line.conversionRate,
        base_allocated_qty: 0,
        unit_price_paisa: lineUnitRatePaisa,
        discount_percent: discountPercent,
        discount_amount_paisa: lineDiscountPaisa,
        tax_rate_id: line.taxRateId || null,
        tax_rate_percent: taxPercent,
        taxable_amount_paisa: taxableAmountPaisa,
        cgst_paisa: cgstPaisa,
        sgst_paisa: sgstPaisa,
        igst_paisa: igstPaisa,
        line_total_paisa: lineTotalPaisa,
      });
    }

    const totalOrderAmountPaisa = subtotalPaisa - totalDiscountPaisa + totalTaxPaisa;

    // 4. Check Credit Limit & Available Credit
    const creditRes = await checkCustomerCredit(d.customerId);
    if (creditRes.success && creditRes.availableCreditPaisa !== undefined) {
      if (totalOrderAmountPaisa > creditRes.availableCreditPaisa) {
        const excess = ((totalOrderAmountPaisa - creditRes.availableCreditPaisa) / 100).toFixed(2);
        approvalReasons.push(`Order total exceeds customer available credit by ₹${excess}`);
      }
    }

    // 5. Benchmark Order Value Check (e.g. ₹7,875 threshold = 787500 paisa)
    if (totalOrderAmountPaisa > 787500) {
      approvalReasons.push(`Order value (₹${(totalOrderAmountPaisa / 100).toFixed(2)}) exceeds standard approval threshold`);
    }

    // 6. Determine Initial Status
    const requiresApproval = approvalReasons.length > 0;
    const initialStatus: SalesOrderStatus = requiresApproval ? "PENDING_APPROVAL" : "APPROVED";
    const initialApprovalStatus = requiresApproval ? "PENDING" : "NOT_REQUIRED";

    // 7. Atomic Order Number Generation
    const supabase = await createClient();
    const { data: nextCode, error: seqErr } = await supabase.rpc("get_next_company_code", {
      p_company_id: session.companyId,
      p_counter_type: "SALES_ORDER",
      p_prefix: "SO",
      p_pad_length: 5,
    });

    const orderNumber = nextCode || `SO-${Date.now().toString().slice(-6)}`;

    // 8. Insert Sales Order Header
    const { data: orderRecord, error: orderErr } = await admin
      .from("sales_orders")
      .insert({
        company_id: session.companyId,
        branch_id: d.branchId,
        order_number: orderNumber,
        customer_id: d.customerId,
        delivery_address_id: d.deliveryAddressId,
        assigned_salesman_id: d.assignedSalesmanId || session.userId,
        order_date: d.orderDate,
        requested_delivery_date: d.requestedDeliveryDate,
        payment_terms_days: d.paymentTermsDays,
        price_list_id: d.priceListId || null,
        status: initialStatus,
        approval_status: initialApprovalStatus,
        approval_required_reason: requiresApproval ? approvalReasons.join(" | ") : null,
        subtotal_paisa: subtotalPaisa,
        discount_paisa: totalDiscountPaisa,
        tax_paisa: totalTaxPaisa,
        total_amount_paisa: totalOrderAmountPaisa,
        notes: d.notes || null,
        created_by: session.userId,
      })
      .select()
      .single();

    if (orderErr) return { success: false, error: orderErr.message };

    // 9. Insert Lines
    const linesWithOrderId = preparedLines.map((l) => ({
      ...l,
      sales_order_id: orderRecord.id,
    }));

    const { error: linesInsertErr } = await admin
      .from("sales_order_lines")
      .insert(linesWithOrderId);

    if (linesInsertErr) return { success: false, error: linesInsertErr.message };

    // 10. Audit Log
    await admin.from("audit_logs").insert({
      company_id: session.companyId,
      user_id: session.userId,
      action: "CREATE_SALES_ORDER",
      entity_name: "sales_orders",
      entity_id: orderRecord.id,
      new_values: {
        order_number: orderNumber,
        status: initialStatus,
        total_paisa: totalOrderAmountPaisa,
        requires_approval: requiresApproval,
      },
    });

    revalidatePath("/sales/orders");
    return {
      success: true,
      orderId: orderRecord.id,
      orderNumber,
      status: initialStatus,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create sales order" };
  }
}

// ============================================================================
// 4. APPROVAL, ALLOCATION & CANCELLATION ACTIONS
// ============================================================================

export async function approveSalesOrderAction(
  rawInput: SalesOrderApprovalInput
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session || !["OWNER", "ADMIN", "SUPERVISOR"].includes(session.role)) {
      return { success: false, error: "Access Denied: Only authorized managers can approve sales orders." };
    }

    const validated = salesOrderApprovalSchema.safeParse(rawInput);
    if (!validated.success) {
      return { success: false, error: validated.error.issues.map((i) => i.message).join(", ") };
    }

    const d = validated.data;
    const admin = createAdminClient();

    if (d.decision === "APPROVED") {
      const supabase = await createClient();
      const { data, error: rpcErr } = await supabase.rpc("approve_sales_order", {
        p_order_id: d.orderId,
        p_notes: d.notes || null,
      });

      if (rpcErr) return { success: false, error: rpcErr.message };
    } else {
      // Rejection
      const { error: rejErr } = await admin
        .from("sales_orders")
        .update({
          status: "REJECTED",
          approval_status: "REJECTED",
          approved_by: session.userId,
          approved_at: new Date().toISOString(),
          approval_notes: d.notes || "Order rejected by manager.",
          updated_at: new Date().toISOString(),
        })
        .eq("company_id", session.companyId)
        .eq("id", d.orderId);

      if (rejErr) return { success: false, error: rejErr.message };
    }

    revalidatePath(`/sales/orders/${d.orderId}`);
    revalidatePath("/sales/approvals");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update order approval" };
  }
}

export async function allocateSalesOrderStockAction(
  rawInput: SalesOrderAllocationInput
): Promise<{
  success: boolean;
  newStatus?: string;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const validated = salesOrderAllocationSchema.safeParse(rawInput);
    if (!validated.success) {
      return { success: false, error: validated.error.issues.map((i) => i.message).join(", ") };
    }

    const d = validated.data;
    const supabase = await createClient();

    const { data, error: rpcErr } = await supabase.rpc("allocate_sales_order_stock", {
      p_order_id: d.orderId,
      p_warehouse_id: d.warehouseId || null,
    });

    if (rpcErr) return { success: false, error: rpcErr.message };

    revalidatePath(`/sales/orders/${d.orderId}`);
    return { success: true, newStatus: data?.status };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to allocate stock" };
  }
}

export async function cancelSalesOrderAction(
  rawInput: SalesOrderCancellationInput
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const validated = salesOrderCancellationSchema.safeParse(rawInput);
    if (!validated.success) {
      return { success: false, error: validated.error.issues.map((i) => i.message).join(", ") };
    }

    const d = validated.data;
    const supabase = await createClient();

    const { error: rpcErr } = await supabase.rpc("cancel_sales_order", {
      p_order_id: d.orderId,
      p_reason: d.reason,
    });

    if (rpcErr) return { success: false, error: rpcErr.message };

    revalidatePath(`/sales/orders/${d.orderId}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to cancel order" };
  }
}

// ============================================================================
// 5. SALES METRICS & REPORTS
// ============================================================================

export async function getSalesMetrics(): Promise<{
  success: boolean;
  metrics?: {
    todayBookingsCount: number;
    pendingApprovalCount: number;
    awaitingDispatchCount: number;
    totalBookedValuePaisa: number;
  };
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const admin = createAdminClient();
    const { data: orders, error } = await admin
      .from("sales_orders")
      .select("status, total_amount_paisa, created_at")
      .eq("company_id", session.companyId);

    if (error) return { success: false, error: error.message };

    const list = orders || [];
    const todayStr = new Date().toISOString().split("T")[0];

    const todayBookingsCount = list.filter((o) =>
      o.created_at && o.created_at.startsWith(todayStr)
    ).length;

    const pendingApprovalCount = list.filter((o) => o.status === "PENDING_APPROVAL").length;
    const awaitingDispatchCount = list.filter((o) =>
      ["ALLOCATED", "READY_FOR_DISPATCH", "PARTIALLY_ALLOCATED"].includes(o.status)
    ).length;

    const totalBookedValuePaisa = list
      .filter((o) => !["REJECTED", "CANCELLED"].includes(o.status))
      .reduce((acc, o) => acc + (o.total_amount_paisa || 0), 0);

    return {
      success: true,
      metrics: {
        todayBookingsCount,
        pendingApprovalCount,
        awaitingDispatchCount,
        totalBookedValuePaisa,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load sales metrics" };
  }
}
