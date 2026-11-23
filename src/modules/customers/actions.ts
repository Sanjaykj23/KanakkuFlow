"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserSession } from "@/modules/auth/actions";
import {
  customerRegistrationSchema,
  approveRegistrationSchema,
  rejectRegistrationSchema,
  resubmitRegistrationSchema,
  CustomerRegistrationInput,
  ApproveRegistrationInput,
  RejectRegistrationInput,
  ResubmitRegistrationInput,
} from "./schema";
import {
  CustomerRegistrationRequest,
  Customer,
  RegistrationStatus,
} from "@/types/database";
import { revalidatePath } from "next/cache";

export interface DuplicateCheckResult {
  has_duplicate: boolean;
  existing_customers: Array<{
    type: string;
    id: string;
    code: string;
    name: string;
    mobile: string;
    gstin?: string | null;
  }>;
  pending_requests: Array<{
    type: string;
    id: string;
    request_number: string;
    name: string;
    mobile: string;
    gstin?: string | null;
    submitted_by: string;
  }>;
}

export async function checkCustomerDuplicates(
  mobileNumber: string,
  gstin?: string,
  excludeRequestId?: string
): Promise<{ success: boolean; data?: DuplicateCheckResult; error?: string }> {
  try {
    const session = await getCurrentUserSession();
    if (!session) {
      return { success: false, error: "Unauthorized session." };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("check_customer_duplicates", {
      p_company_id: session.companyId,
      p_mobile_number: mobileNumber,
      p_gstin: gstin || null,
      p_exclude_request_id: excludeRequestId || null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to check duplicates" };
  }
}

export async function submitCustomerRegistration(
  rawInput: CustomerRegistrationInput
): Promise<{
  success: boolean;
  requestNumber?: string;
  requestId?: string;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) {
      return { success: false, error: "Unauthorized: Please log in." };
    }

    const validated = customerRegistrationSchema.safeParse(rawInput);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.issues.map((i) => i.message).join(", "),
      };
    }

    const input = validated.data;
    const adminClient = createAdminClient();

    // 1. Concurrency-safe code generation for registration number
    const { data: reqCode, error: codeErr } = await adminClient.rpc(
      "get_next_company_code",
      {
        p_company_id: session.companyId,
        p_counter_type: "CUSTOMER_REG",
        p_prefix: "REQ",
        p_pad_length: 5,
      }
    );

    let requestNumber = reqCode;
    if (codeErr || !requestNumber) {
      const { count } = await adminClient
        .from("customer_registration_requests")
        .select("id", { count: "exact", head: true })
        .eq("company_id", session.companyId);
      requestNumber = `REQ-${String((count || 0) + 1).padStart(5, "0")}`;
    }

    const normalizedMobile = input.mobileNumber.replace(/\D/g, "").slice(-10);

    const supabase = await createClient();
    const { data: newRecord, error: insertError } = await supabase
      .from("customer_registration_requests")
      .insert({
        company_id: session.companyId,
        branch_id: input.branchId,
        request_number: requestNumber,
        shop_name: input.shopName.trim(),
        owner_name: input.ownerName.trim(),
        mobile_number: input.mobileNumber.trim(),
        normalized_mobile: normalizedMobile,
        alternate_number: input.alternateNumber ? input.alternateNumber.trim() : null,
        email: input.email ? input.email.trim().toLowerCase() : null,
        gstin: input.gstin ? input.gstin.trim().toUpperCase() : null,
        pan: input.pan ? input.pan.trim().toUpperCase() : null,
        fssai_number: input.fssaiNumber ? input.fssaiNumber.trim() : null,
        address_line1: input.addressLine1.trim(),
        address_line2: input.addressLine2 ? input.addressLine2.trim() : null,
        city: input.city.trim(),
        state: input.state.trim(),
        pincode: input.pincode.trim(),
        latitude: input.latitude || null,
        longitude: input.longitude || null,
        shop_photo_url: input.shopPhotoUrl || null,
        status: "PENDING",
        submitted_by: session.userId,
      })
      .select("id")
      .single();

    if (insertError) {
      return { success: false, error: insertError.message };
    }

    // Audit log
    await adminClient.from("audit_logs").insert({
      company_id: session.companyId,
      user_id: session.userId,
      action: "SUBMIT_CUSTOMER_REGISTRATION",
      entity_name: "customer_registration_requests",
      entity_id: newRecord.id,
      new_values: {
        request_number: requestNumber,
        shop_name: input.shopName,
        mobile: input.mobileNumber,
      },
    });

    revalidatePath("/customers/registrations");
    revalidatePath("/customers/register");

    return {
      success: true,
      requestNumber,
      requestId: newRecord.id,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to submit registration" };
  }
}

export async function approveRegistration(
  rawInput: ApproveRegistrationInput
): Promise<{ success: boolean; customerCode?: string; error?: string }> {
  try {
    const session = await getCurrentUserSession();
    if (!session) {
      return { success: false, error: "Unauthorized: Please log in." };
    }

    if (!["OWNER", "ADMIN"].includes(session.role)) {
      return {
        success: false,
        error: "Access Denied: Only Owner or Admin can approve customer registrations.",
      };
    }

    const validated = approveRegistrationSchema.safeParse(rawInput);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.issues.map((i) => i.message).join(", "),
      };
    }

    const { requestId, creditLimit, paymentTermsDays, duplicateOverrideReason } = validated.data;
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("approve_customer_registration", {
      p_request_id: requestId,
      p_credit_limit: creditLimit,
      p_payment_terms_days: paymentTermsDays,
      p_duplicate_override_reason: duplicateOverrideReason || null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/customers");
    revalidatePath("/customers/registrations");
    revalidatePath(`/customers/registrations/${requestId}`);

    return {
      success: true,
      customerCode: data?.customer_code,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to approve registration" };
  }
}

export async function rejectRegistration(
  rawInput: RejectRegistrationInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getCurrentUserSession();
    if (!session) {
      return { success: false, error: "Unauthorized: Please log in." };
    }

    if (!["OWNER", "ADMIN"].includes(session.role)) {
      return {
        success: false,
        error: "Access Denied: Only Owner or Admin can reject customer registrations.",
      };
    }

    const validated = rejectRegistrationSchema.safeParse(rawInput);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.issues.map((i) => i.message).join(", "),
      };
    }

    const { requestId, rejectionReason } = validated.data;
    const supabase = await createClient();

    const { error } = await supabase.rpc("reject_customer_registration", {
      p_request_id: requestId,
      p_rejection_reason: rejectionReason,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/customers/registrations");
    revalidatePath(`/customers/registrations/${requestId}`);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to reject registration" };
  }
}

export async function resubmitRegistration(
  rawInput: ResubmitRegistrationInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getCurrentUserSession();
    if (!session) {
      return { success: false, error: "Unauthorized: Please log in." };
    }

    const validated = resubmitRegistrationSchema.safeParse(rawInput);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.issues.map((i) => i.message).join(", "),
      };
    }

    const input = validated.data;
    const supabase = await createClient();

    const { error } = await supabase.rpc("resubmit_customer_registration", {
      p_request_id: input.requestId,
      p_shop_name: input.shopName,
      p_owner_name: input.ownerName,
      p_mobile_number: input.mobileNumber,
      p_alternate_number: input.alternateNumber || null,
      p_email: input.email || null,
      p_gstin: input.gstin || null,
      p_pan: input.pan || null,
      p_fssai_number: input.fssaiNumber || null,
      p_address_line1: input.addressLine1,
      p_address_line2: input.addressLine2 || null,
      p_city: input.city,
      p_state: input.state,
      p_pincode: input.pincode,
      p_latitude: input.latitude || null,
      p_longitude: input.longitude || null,
      p_shop_photo_url: input.shopPhotoUrl || null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/customers/registrations");
    revalidatePath(`/customers/registrations/${input.requestId}`);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to resubmit registration" };
  }
}

export async function cancelRegistration(
  requestId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getCurrentUserSession();
    if (!session) {
      return { success: false, error: "Unauthorized: Please log in." };
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("cancel_customer_registration", {
      p_request_id: requestId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/customers/registrations");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to cancel registration" };
  }
}

export async function getCustomerRegistrations(statusFilter?: RegistrationStatus): Promise<{
  success: boolean;
  registrations?: CustomerRegistrationRequest[];
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) {
      return { success: false, error: "Unauthorized session." };
    }

    const adminClient = createAdminClient();
    let query = adminClient
      .from("customer_registration_requests")
      .select(`
        *,
        branch:branch_id (
          id,
          code,
          name
        ),
        submitted_by_profile:submitted_by (
          id,
          full_name,
          email,
          mobile_number
        ),
        reviewed_by_profile:reviewed_by (
          id,
          full_name,
          email
        )
      `)
      .eq("company_id", session.companyId)
      .order("created_at", { ascending: false });

    // Role-based scoping: Salesmen see their own submissions
    if (session.role === "SALESMAN") {
      query = query.eq("submitted_by", session.userId);
    } else if (session.role === "SUPERVISOR" && session.accessibleBranches?.length > 0) {
      query = query.in("branch_id", session.accessibleBranches.map((b) => b.id));
    }

    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;
    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, registrations: (data as any) || [] };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load registrations" };
  }
}

export async function getCustomerRegistrationById(id: string): Promise<{
  success: boolean;
  registration?: CustomerRegistrationRequest;
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) {
      return { success: false, error: "Unauthorized session." };
    }

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from("customer_registration_requests")
      .select(`
        *,
        branch:branch_id (
          id,
          code,
          name
        ),
        submitted_by_profile:submitted_by (
          id,
          full_name,
          email,
          mobile_number
        ),
        reviewed_by_profile:reviewed_by (
          id,
          full_name,
          email
        )
      `)
      .eq("company_id", session.companyId)
      .eq("id", id)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, registration: data as any };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to get registration" };
  }
}

export async function getCustomers(search?: string, branchId?: string): Promise<{
  success: boolean;
  customers?: Customer[];
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) {
      return { success: false, error: "Unauthorized session." };
    }

    const adminClient = createAdminClient();
    let query = adminClient
      .from("customers")
      .select(`
        *,
        branch:branch_id (
          id,
          code,
          name
        ),
        assigned_salesman_profile:assigned_salesman_id (
          id,
          full_name,
          email,
          mobile_number
        ),
        addresses:customer_addresses (
          id,
          address_type,
          address_line1,
          address_line2,
          city,
          state,
          pincode,
          is_primary
        )
      `)
      .eq("company_id", session.companyId)
      .order("created_at", { ascending: false });

    if (session.role === "SALESMAN") {
      query = query.eq("assigned_salesman_id", session.userId);
    } else if (session.role === "SUPERVISOR" && session.accessibleBranches?.length > 0) {
      query = query.in("branch_id", session.accessibleBranches.map((b) => b.id));
    }

    if (branchId) {
      query = query.eq("branch_id", branchId);
    }

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      query = query.or(`shop_name.ilike.${q},customer_code.ilike.${q},mobile_number.ilike.${q}`);
    }

    const { data, error } = await query;
    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, customers: (data as any) || [] };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to get customers" };
  }
}
