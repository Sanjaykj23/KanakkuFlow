"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserSession } from "@/modules/auth/actions";
import { UserRole, MembershipStatus } from "@/types/database";
import { revalidatePath } from "next/cache";

export interface EmployeeListItem {
  id: string;
  userId: string;
  employeeCode: string;
  fullName: string;
  email: string;
  mobile: string;
  role: UserRole;
  branches: string;
  status: MembershipStatus;
  createdAt: string;
}

export async function getEmployees(): Promise<{
  success: boolean;
  employees?: EmployeeListItem[];
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) {
      return { success: false, error: "Unauthorized session" };
    }

    const adminClient = createAdminClient();

    const { data: memberships, error } = await adminClient
      .from("company_memberships")
      .select(`
        id,
        user_id,
        role,
        employee_code,
        status,
        created_at,
        user_profiles:user_id (
          id,
          full_name,
          email,
          mobile_number
        ),
        membership_branches (
          is_default,
          branches:branch_id (
            id,
            code,
            name
          )
        )
      `)
      .eq("company_id", session.companyId)
      .order("created_at", { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    const formatted: EmployeeListItem[] = (memberships || []).map((m: any) => {
      const branchesStr = (m.membership_branches || [])
        .map((mb: any) => mb.branches?.name || mb.branches?.code)
        .filter(Boolean)
        .join(", ");

      return {
        id: m.id,
        userId: m.user_id,
        employeeCode: m.employee_code,
        fullName: m.user_profiles?.full_name || "Unknown",
        email: m.user_profiles?.email || "No email",
        mobile: m.user_profiles?.mobile_number || "—",
        role: m.role as UserRole,
        branches: branchesStr || "All Branches",
        status: m.status as MembershipStatus,
        createdAt: m.created_at,
      };
    });

    return { success: true, employees: formatted };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getCompanyBranches(): Promise<{
  id: string;
  code: string;
  name: string;
}[]> {
  const session = await getCurrentUserSession();
  if (!session) return [];

  const adminClient = createAdminClient();
  const { data: branches } = await adminClient
    .from("branches")
    .select("id, code, name")
    .eq("company_id", session.companyId)
    .eq("is_active", true);

  return (branches || []).map((b) => ({
    id: b.id,
    code: b.code,
    name: b.name,
  }));
}

export async function createEmployee(data: {
  fullName: string;
  email: string;
  mobile: string;
  role: UserRole;
  branchIds: string[];
  initialPassword?: string;
}): Promise<{
  success: boolean;
  error?: string;
  employeeCode?: string;
  tempPassword?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) {
      return { success: false, error: "Unauthorized session." };
    }

    // Role Hierarchy Invariant Enforcement
    if (!["OWNER", "ADMIN"].includes(session.role)) {
      return {
        success: false,
        error: "Access Denied: Only Owner or Admin can manage employee accounts.",
      };
    }

    if (session.role === "ADMIN") {
      if (data.role === "OWNER" || data.role === "ADMIN") {
        return {
          success: false,
          error: "Security Violation: Admins cannot create or promote to Owner or Admin accounts.",
        };
      }
    }

    const adminClient = createAdminClient();

    // 1. Generate concurrency-safe sequential employee code
    const { data: codeData, error: codeErr } = await adminClient.rpc(
      "get_next_company_code",
      {
        p_company_id: session.companyId,
        p_counter_type: "EMPLOYEE",
        p_prefix: "EMP",
        p_pad_length: 5,
      }
    );

    let employeeCode = codeData;
    if (codeErr || !employeeCode) {
      const { count } = await adminClient
        .from("company_memberships")
        .select("id", { count: "exact", head: true })
        .eq("company_id", session.companyId);
      employeeCode = `EMP-${String((count || 0) + 1).padStart(5, "0")}`;
    }

    // 2. Generate temporary password
    const tempPassword =
      data.initialPassword ||
      `Kanakku@${Math.random().toString(36).slice(-8)}!`;

    // 3. Create user in auth.users
    const { data: authUser, error: authError } =
      await adminClient.auth.admin.createUser({
        email: data.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: data.fullName },
      });

    if (authError || !authUser.user) {
      return {
        success: false,
        error: authError?.message || "Failed to create authentication credentials.",
      };
    }

    const newUserId = authUser.user.id;

    // 4. Insert user profile (with requires_password_change = true)
    const { error: profileErr } = await adminClient
      .from("user_profiles")
      .upsert({
        id: newUserId,
        email: data.email,
        full_name: data.fullName,
        mobile_number: data.mobile,
        requires_password_change: true,
      });

    if (profileErr) {
      return { success: false, error: profileErr.message };
    }

    // 5. Insert company membership
    const { data: newMem, error: memErr } = await adminClient
      .from("company_memberships")
      .insert({
        company_id: session.companyId,
        user_id: newUserId,
        role: data.role,
        employee_code: employeeCode,
        status: "ACTIVE",
        created_by: session.userId,
      })
      .select("id")
      .single();

    if (memErr) {
      return { success: false, error: memErr.message };
    }

    // 6. Assign branches
    if (data.branchIds && data.branchIds.length > 0) {
      const branchRows = data.branchIds.map((bid, idx) => ({
        membership_id: newMem.id,
        branch_id: bid,
        is_default: idx === 0,
      }));
      await adminClient.from("membership_branches").insert(branchRows);
    }

    // 7. Append-only Audit Log (No secrets logged!)
    await adminClient.from("audit_logs").insert({
      company_id: session.companyId,
      user_id: session.userId,
      action: "USER_CREATED",
      entity_name: "company_memberships",
      entity_id: newMem.id,
      new_values: {
        role: data.role,
        employee_code: employeeCode,
        full_name: data.fullName,
        email: data.email,
      },
    });

    revalidatePath("/users");
    return {
      success: true,
      employeeCode,
      tempPassword,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function toggleUserStatus(
  membershipId: string,
  newStatus: MembershipStatus
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session" };

    const adminClient = createAdminClient();

    // Check target user's role to enforce hierarchy
    const { data: targetMem, error: fetchErr } = await adminClient
      .from("company_memberships")
      .select("role, user_id, company_id")
      .eq("id", membershipId)
      .single();

    if (fetchErr || !targetMem) {
      return { success: false, error: "Target membership not found" };
    }

    if (session.role === "ADMIN") {
      if (targetMem.role === "OWNER" || targetMem.role === "ADMIN") {
        return {
          success: false,
          error: "Security Violation: Admins cannot deactivate or modify Owner or Admin accounts.",
        };
      }
    }

    // Update status
    const { error: updateErr } = await adminClient
      .from("company_memberships")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", membershipId);

    if (updateErr) return { success: false, error: updateErr.message };

    // Record in immutable audit log
    await adminClient.from("audit_logs").insert({
      company_id: session.companyId,
      user_id: session.userId,
      action: `USER_STATUS_${newStatus}`,
      entity_name: "company_memberships",
      entity_id: membershipId,
      new_values: { status: newStatus },
    });

    revalidatePath("/users");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
