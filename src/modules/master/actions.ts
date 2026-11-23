"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserSession } from "@/modules/auth/actions";
import {
  unitSchema,
  unitConversionSchema,
  hsnCodeSchema,
  taxRateSchema,
  itemSchema,
  supplierSchema,
  warehouseSchema,
  UnitInput,
  UnitConversionInput,
  HsnCodeInput,
  TaxRateInput,
  ItemInput,
  SupplierInput,
  WarehouseInput,
} from "./schema";
import {
  Unit,
  UnitConversion,
  HsnCode,
  TaxRate,
  Item,
  Supplier,
  Warehouse,
} from "@/types/database";
import { revalidatePath } from "next/cache";

// ============================================================================
// 1. UNITS & CONVERSIONS
// ============================================================================

export async function getUnits(): Promise<{ success: boolean; units?: Unit[]; error?: string }> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("units")
      .select("*")
      .eq("company_id", session.companyId)
      .order("code", { ascending: true });

    if (error) return { success: false, error: error.message };
    return { success: true, units: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function saveUnit(
  input: UnitInput
): Promise<{ success: boolean; unit?: Unit; error?: string }> {
  try {
    const session = await getCurrentUserSession();
    if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
      return { success: false, error: "Access Denied: Only Owner or Admin can manage units." };
    }

    const validated = unitSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: validated.error.issues.map((i) => i.message).join(", ") };
    }

    const admin = createAdminClient();
    const payload = {
      company_id: session.companyId,
      code: validated.data.code.trim().toUpperCase(),
      name: validated.data.name.trim(),
      symbol: validated.data.symbol.trim(),
      is_base_unit: validated.data.isBaseUnit,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (validated.data.id) {
      result = await admin
        .from("units")
        .update(payload)
        .eq("company_id", session.companyId)
        .eq("id", validated.data.id)
        .select()
        .single();
    } else {
      result = await admin.from("units").insert(payload).select().single();
    }

    if (result.error) return { success: false, error: result.error.message };

    await admin.from("audit_logs").insert({
      company_id: session.companyId,
      user_id: session.userId,
      action: validated.data.id ? "UPDATE_UNIT" : "CREATE_UNIT",
      entity_name: "units",
      entity_id: result.data.id,
      new_values: payload,
    });

    revalidatePath("/master/units");
    return { success: true, unit: result.data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getUnitConversions(): Promise<{
  success: boolean;
  conversions?: UnitConversion[];
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("unit_conversions")
      .select(`
        *,
        from_unit:from_unit_id (id, code, name, symbol),
        to_unit:to_unit_id (id, code, name, symbol)
      `)
      .eq("company_id", session.companyId)
      .order("created_at", { ascending: false });

    if (error) return { success: false, error: error.message };
    return { success: true, conversions: (data as any) || [] };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function saveUnitConversion(
  input: UnitConversionInput
): Promise<{ success: boolean; conversion?: UnitConversion; error?: string }> {
  try {
    const session = await getCurrentUserSession();
    if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
      return { success: false, error: "Access Denied: Only Owner or Admin can manage unit conversions." };
    }

    const validated = unitConversionSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: validated.error.issues.map((i) => i.message).join(", ") };
    }

    if (validated.data.fromUnitId === validated.data.toUnitId) {
      return { success: false, error: "Source unit and target unit must be different." };
    }

    const admin = createAdminClient();
    const payload = {
      company_id: session.companyId,
      from_unit_id: validated.data.fromUnitId,
      to_unit_id: validated.data.toUnitId,
      conversion_rate: validated.data.conversionRate,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (validated.data.id) {
      result = await admin
        .from("unit_conversions")
        .update(payload)
        .eq("company_id", session.companyId)
        .eq("id", validated.data.id)
        .select()
        .single();
    } else {
      result = await admin.from("unit_conversions").insert(payload).select().single();
    }

    if (result.error) return { success: false, error: result.error.message };

    await admin.from("audit_logs").insert({
      company_id: session.companyId,
      user_id: session.userId,
      action: validated.data.id ? "UPDATE_UNIT_CONVERSION" : "CREATE_UNIT_CONVERSION",
      entity_name: "unit_conversions",
      entity_id: result.data.id,
      new_values: payload,
    });

    revalidatePath("/master/units");
    return { success: true, conversion: result.data as any };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================================================
// 2. HSN CODES & TAX RATES
// ============================================================================

export async function getHsnCodes(): Promise<{
  success: boolean;
  hsnCodes?: HsnCode[];
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("hsn_codes")
      .select("*")
      .eq("company_id", session.companyId)
      .order("code", { ascending: true });

    if (error) return { success: false, error: error.message };
    return { success: true, hsnCodes: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function saveHsnCode(
  input: HsnCodeInput
): Promise<{ success: boolean; hsnCode?: HsnCode; error?: string }> {
  try {
    const session = await getCurrentUserSession();
    if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
      return { success: false, error: "Access Denied: Only Owner or Admin can manage HSN codes." };
    }

    const validated = hsnCodeSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: validated.error.issues.map((i) => i.message).join(", ") };
    }

    const admin = createAdminClient();
    const payload = {
      company_id: session.companyId,
      code: validated.data.code.trim(),
      description: validated.data.description.trim(),
      updated_at: new Date().toISOString(),
    };

    let result;
    if (validated.data.id) {
      result = await admin
        .from("hsn_codes")
        .update(payload)
        .eq("company_id", session.companyId)
        .eq("id", validated.data.id)
        .select()
        .single();
    } else {
      result = await admin.from("hsn_codes").insert(payload).select().single();
    }

    if (result.error) return { success: false, error: result.error.message };

    await admin.from("audit_logs").insert({
      company_id: session.companyId,
      user_id: session.userId,
      action: validated.data.id ? "UPDATE_HSN_CODE" : "CREATE_HSN_CODE",
      entity_name: "hsn_codes",
      entity_id: result.data.id,
      new_values: payload,
    });

    revalidatePath("/master/hsn-tax");
    return { success: true, hsnCode: result.data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getTaxRates(): Promise<{
  success: boolean;
  taxRates?: TaxRate[];
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("tax_rates")
      .select("*")
      .eq("company_id", session.companyId)
      .order("igst_rate", { ascending: true });

    if (error) return { success: false, error: error.message };
    return { success: true, taxRates: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function saveTaxRate(
  input: TaxRateInput
): Promise<{ success: boolean; taxRate?: TaxRate; error?: string }> {
  try {
    const session = await getCurrentUserSession();
    if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
      return { success: false, error: "Access Denied: Only Owner or Admin can manage tax rates." };
    }

    const validated = taxRateSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: validated.error.issues.map((i) => i.message).join(", ") };
    }

    const d = validated.data;
    if (Math.abs(d.igstRate - (d.cgstRate + d.sgstRate)) > 0.001) {
      return { success: false, error: "GST Rule Violation: IGST rate must equal CGST + SGST." };
    }

    const admin = createAdminClient();
    const payload = {
      company_id: session.companyId,
      name: d.name.trim(),
      igst_rate: d.igstRate,
      cgst_rate: d.cgstRate,
      sgst_rate: d.sgstRate,
      cess_rate: d.cessRate,
      effective_from: d.effectiveFrom,
      effective_to: d.effectiveTo || null,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (d.id) {
      result = await admin
        .from("tax_rates")
        .update(payload)
        .eq("company_id", session.companyId)
        .eq("id", d.id)
        .select()
        .single();
    } else {
      result = await admin.from("tax_rates").insert(payload).select().single();
    }

    if (result.error) return { success: false, error: result.error.message };

    await admin.from("audit_logs").insert({
      company_id: session.companyId,
      user_id: session.userId,
      action: d.id ? "UPDATE_TAX_RATE" : "CREATE_TAX_RATE",
      entity_name: "tax_rates",
      entity_id: result.data.id,
      new_values: payload,
    });

    revalidatePath("/master/hsn-tax");
    return { success: true, taxRate: result.data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================================================
// 3. ITEMS & PRODUCTS
// ============================================================================

export async function getItems(): Promise<{ success: boolean; items?: Item[]; error?: string }> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("items")
      .select(`
        *,
        primary_unit:primary_unit_id (id, code, name, symbol),
        hsn_code:hsn_code_id (id, code, description),
        tax_rate:default_tax_rate_id (id, name, igst_rate)
      `)
      .eq("company_id", session.companyId)
      .order("code", { ascending: true });

    if (error) return { success: false, error: error.message };
    return { success: true, items: (data as any) || [] };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function saveItem(
  input: ItemInput
): Promise<{ success: boolean; item?: Item; error?: string }> {
  try {
    const session = await getCurrentUserSession();
    if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
      return { success: false, error: "Access Denied: Only Owner or Admin can manage items." };
    }

    const validated = itemSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: validated.error.issues.map((i) => i.message).join(", ") };
    }

    const d = validated.data;
    const admin = createAdminClient();
    const payload = {
      company_id: session.companyId,
      code: d.code.trim().toUpperCase(),
      name: d.name.trim(),
      item_type: d.itemType,
      category: d.category.trim().toUpperCase(),
      primary_unit_id: d.primaryUnitId,
      hsn_code_id: d.hsnCodeId || null,
      default_tax_rate_id: d.defaultTaxRateId || null,
      mrp: d.mrp,
      base_price: d.basePrice,
      reorder_level: d.reorderLevel,
      shelf_life_days: d.shelfLifeDays || null,
      is_fefo_tracked: d.isFefoTracked,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (d.id) {
      result = await admin
        .from("items")
        .update(payload)
        .eq("company_id", session.companyId)
        .eq("id", d.id)
        .select()
        .single();
    } else {
      result = await admin.from("items").insert(payload).select().single();
    }

    if (result.error) return { success: false, error: result.error.message };

    await admin.from("audit_logs").insert({
      company_id: session.companyId,
      user_id: session.userId,
      action: d.id ? "UPDATE_ITEM" : "CREATE_ITEM",
      entity_name: "items",
      entity_id: result.data.id,
      new_values: payload,
    });

    revalidatePath("/master/items");
    return { success: true, item: result.data as any };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================================================
// 4. SUPPLIERS
// ============================================================================

export async function getSuppliers(): Promise<{
  success: boolean;
  suppliers?: Supplier[];
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("suppliers")
      .select("*")
      .eq("company_id", session.companyId)
      .order("name", { ascending: true });

    if (error) return { success: false, error: error.message };
    return { success: true, suppliers: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function saveSupplier(
  input: SupplierInput
): Promise<{ success: boolean; supplier?: Supplier; error?: string }> {
  try {
    const session = await getCurrentUserSession();
    if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
      return { success: false, error: "Access Denied: Only Owner or Admin can manage suppliers." };
    }

    const validated = supplierSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: validated.error.issues.map((i) => i.message).join(", ") };
    }

    const d = validated.data;
    const admin = createAdminClient();
    const payload = {
      company_id: session.companyId,
      code: d.code.trim().toUpperCase(),
      name: d.name.trim(),
      trade_name: d.tradeName ? d.tradeName.trim() : null,
      gstin: d.gstin ? d.gstin.trim().toUpperCase() : null,
      pan: d.pan ? d.pan.trim().toUpperCase() : null,
      contact_person: d.contactPerson ? d.contactPerson.trim() : null,
      email: d.email ? d.email.trim().toLowerCase() : null,
      mobile: d.mobile.trim(),
      address_line1: d.addressLine1.trim(),
      address_line2: d.addressLine2 ? d.addressLine2.trim() : null,
      city: d.city.trim(),
      state: d.state.trim(),
      pincode: d.pincode.trim(),
      payment_terms_days: d.paymentTermsDays,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (d.id) {
      result = await admin
        .from("suppliers")
        .update(payload)
        .eq("company_id", session.companyId)
        .eq("id", d.id)
        .select()
        .single();
    } else {
      result = await admin.from("suppliers").insert(payload).select().single();
    }

    if (result.error) return { success: false, error: result.error.message };

    await admin.from("audit_logs").insert({
      company_id: session.companyId,
      user_id: session.userId,
      action: d.id ? "UPDATE_SUPPLIER" : "CREATE_SUPPLIER",
      entity_name: "suppliers",
      entity_id: result.data.id,
      new_values: payload,
    });

    revalidatePath("/master/suppliers");
    return { success: true, supplier: result.data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ============================================================================
// 5. WAREHOUSES
// ============================================================================

export async function getWarehouses(): Promise<{
  success: boolean;
  warehouses?: Warehouse[];
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("warehouses")
      .select(`
        *,
        branch:branch_id (id, code, name)
      `)
      .eq("company_id", session.companyId)
      .order("code", { ascending: true });

    if (error) return { success: false, error: error.message };
    return { success: true, warehouses: (data as any) || [] };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function saveWarehouse(
  input: WarehouseInput
): Promise<{ success: boolean; warehouse?: Warehouse; error?: string }> {
  try {
    const session = await getCurrentUserSession();
    if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
      return { success: false, error: "Access Denied: Only Owner or Admin can manage warehouses." };
    }

    const validated = warehouseSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: validated.error.issues.map((i) => i.message).join(", ") };
    }

    const d = validated.data;
    const admin = createAdminClient();
    const payload = {
      company_id: session.companyId,
      branch_id: d.branchId,
      code: d.code.trim().toUpperCase(),
      name: d.name.trim(),
      updated_at: new Date().toISOString(),
    };

    let result;
    if (d.id) {
      result = await admin
        .from("warehouses")
        .update(payload)
        .eq("company_id", session.companyId)
        .eq("id", d.id)
        .select()
        .single();
    } else {
      result = await admin.from("warehouses").insert(payload).select().single();
    }

    if (result.error) return { success: false, error: result.error.message };

    await admin.from("audit_logs").insert({
      company_id: session.companyId,
      user_id: session.userId,
      action: d.id ? "UPDATE_WAREHOUSE" : "CREATE_WAREHOUSE",
      entity_name: "warehouses",
      entity_id: result.data.id,
      new_values: payload,
    });

    revalidatePath("/master/warehouses");
    return { success: true, warehouse: result.data as any };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
