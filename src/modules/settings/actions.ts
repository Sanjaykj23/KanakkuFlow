"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserSession } from "@/modules/auth/actions";

export interface CompanySettingsData {
  company: {
    id: string;
    legalName: string;
    tradeName: string;
    gstin: string;
    pan: string;
    email: string;
    phone: string;
    addressLine1: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  branches: {
    id: string;
    code: string;
    name: string;
    branchType: string;
    gstin: string | null;
    city: string;
    state: string;
    isActive: boolean;
  }[];
  systemConfig: {
    baseCurrency: string;
    stateCode: string;
    securityPolicy: string;
    inventoryMethod: string;
    gstFormat: string;
  };
}

export async function getCompanySettingsAction(): Promise<{
  success: boolean;
  data?: CompanySettingsData;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    if (!["OWNER", "ADMIN"].includes(session.role)) {
      return { success: false, error: "Access Denied: Settings require OWNER or ADMIN role." };
    }

    const admin = createAdminClient();

    // 1. Fetch Company
    const { data: comp, error: cErr } = await admin
      .from("companies")
      .select("*")
      .eq("id", session.companyId)
      .single();

    if (cErr) return { success: false, error: cErr.message };

    // 2. Fetch Branches
    const { data: branches, error: bErr } = await admin
      .from("branches")
      .select("*")
      .eq("company_id", session.companyId)
      .order("created_at", { ascending: true });

    if (bErr) return { success: false, error: bErr.message };

    return {
      success: true,
      data: {
        company: {
          id: comp.id,
          legalName: comp.legal_name,
          tradeName: comp.trade_name || comp.legal_name,
          gstin: comp.gstin || "Not Registered",
          pan: comp.pan || "N/A",
          email: comp.email || "accounts@kanakkuflow.local",
          phone: comp.phone || "N/A",
          addressLine1: comp.address_line1 || "",
          city: comp.city || "Madurai",
          state: comp.state || "Tamil Nadu",
          postalCode: comp.postal_code || "",
          country: comp.country || "India",
        },
        branches: (branches || []).map((b) => ({
          id: b.id,
          code: b.code,
          name: b.name,
          branchType: b.branch_type || "PLANT",
          gstin: b.gstin,
          city: b.city || "",
          state: b.state || "Tamil Nadu",
          isActive: b.is_active,
        })),
        systemConfig: {
          baseCurrency: "INR (₹) Integer Paisa",
          stateCode: "33 (Tamil Nadu)",
          securityPolicy: "Strict Hierarchical RBAC + Row Level Security",
          inventoryMethod: "Physical FEFO + Perpetual Weighted Average Cost",
          gstFormat: "Indian CGST + SGST (Intra-state) / IGST (Inter-state)",
        },
      },
    };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to load settings." };
  }
}
