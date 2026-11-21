"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CurrentUserSession } from "@/types/auth";
import { UserRole } from "@/types/database";

export async function loginUser(formData: {
  email: string;
  password: string;
}): Promise<{
  success: boolean;
  error?: string;
  role?: UserRole;
  requiresPasswordChange?: boolean;
}> {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

    if (authError || !authData.user) {
      return {
        success: false,
        error: authError?.message || "Invalid credentials. Please verify your email and password.",
      };
    }

    const userId = authData.user.id;

    // Fetch user profile and company membership
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("full_name, requires_password_change")
      .eq("id", userId)
      .maybeSingle();

    const { data: membership } = await supabase
      .from("company_memberships")
      .select("role, status, company_id")
      .eq("user_id", userId)
      .eq("status", "ACTIVE")
      .maybeSingle();

    if (!membership) {
      // Deactivated or no active company membership
      await supabase.auth.signOut();
      return {
        success: false,
        error: "Your account is deactivated or has no active company membership. Contact your Administrator.",
      };
    }

    revalidatePath("/", "layout");

    return {
      success: true,
      role: membership.role as UserRole,
      requiresPasswordChange: profile?.requires_password_change ?? false,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "An unexpected error occurred during login.",
    };
  }
}

export async function logoutUser() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function updateUserPassword(newPassword: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data: sessionData } = await supabase.auth.getUser();

    if (!sessionData.user) {
      return { success: false, error: "Not authenticated" };
    }

    const { error: updateAuthErr } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateAuthErr) {
      return { success: false, error: updateAuthErr.message };
    }

    // Clear requires_password_change flag
    await supabase
      .from("user_profiles")
      .update({ requires_password_change: false, updated_at: new Date().toISOString() })
      .eq("id", sessionData.user.id);

    // Audit log
    const { data: mem } = await supabase
      .from("company_memberships")
      .select("company_id")
      .eq("user_id", sessionData.user.id)
      .maybeSingle();

    if (mem?.company_id) {
      await supabase.from("audit_logs").insert({
        company_id: mem.company_id,
        user_id: sessionData.user.id,
        action: "PASSWORD_ROTATED",
        entity_name: "user_profiles",
        entity_id: sessionData.user.id,
        new_values: { requires_password_change: false },
      });
    }

    revalidatePath("/", "layout");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getCurrentUserSession(): Promise<CurrentUserSession | null> {
  try {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();

    if (!authData.user) {
      return null;
    }

    const userId = authData.user.id;

    // Get user profile
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    // Get active company membership
    const { data: membership } = await supabase
      .from("company_memberships")
      .select(`
        id,
        role,
        status,
        company_id,
        companies:company_id (
          id,
          legal_name,
          trade_name
        )
      `)
      .eq("user_id", userId)
      .eq("status", "ACTIVE")
      .maybeSingle();

    if (!membership) {
      return null;
    }

    // Get accessible branches
    const { data: branchMappings } = await supabase
      .from("membership_branches")
      .select(`
        is_default,
        branch:branch_id (
          id,
          code,
          name
        )
      `)
      .eq("membership_id", membership.id);

    const branches = (branchMappings || []).map((bm: any) => ({
      id: bm.branch?.id || "",
      code: bm.branch?.code || "",
      name: bm.branch?.name || "",
      isDefault: bm.is_default,
    }));

    const companyInfo = membership.companies as any;

    return {
      userId,
      email: authData.user.email || profile?.email || "",
      fullName: profile?.full_name || authData.user.email || "Staff Member",
      role: membership.role as UserRole,
      companyId: membership.company_id,
      companyName: companyInfo?.trade_name || companyInfo?.legal_name || "KanakkuFlow Foods",
      accessibleBranches: branches,
      requiresPasswordChange: profile?.requires_password_change ?? false,
      permissions: [],
    };
  } catch {
    return null;
  }
}
