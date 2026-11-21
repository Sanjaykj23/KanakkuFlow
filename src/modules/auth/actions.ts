"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
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

    // 1. Authenticate with Supabase Auth
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

    // 2. Fetch membership using adminClient first
    const adminClient = createAdminClient();

    const { data: profile, error: profErr } = await adminClient
      .from("user_profiles")
      .select("full_name, requires_password_change")
      .eq("id", userId)
      .maybeSingle();

    let { data: membership, error: memErr } = await adminClient
      .from("company_memberships")
      .select("role, status, company_id")
      .eq("user_id", userId)
      .maybeSingle();

    // If adminClient had an error (e.g., service role key issue), attempt with authed user client
    if (memErr || !membership) {
      console.warn("[AUTH] adminClient membership query issue:", memErr?.message || "No row found");

      const { data: userMem, error: userMemErr } = await supabase
        .from("company_memberships")
        .select("role, status, company_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (userMem) {
        membership = userMem;
      } else if (memErr) {
        return {
          success: false,
          error: `Database connection error: ${memErr.message}. Ensure SUPABASE_SERVICE_ROLE_KEY is set in .env.local and restart the server.`,
        };
      }
    }

    if (!membership) {
      // User exists in auth.users, but has no record in company_memberships
      return {
        success: false,
        error: `No company membership found for user (${formData.email}). Please ensure the database seed script has run or contact the Owner.`,
      };
    }

    if (membership.status !== "ACTIVE") {
      await supabase.auth.signOut();
      return {
        success: false,
        error: `Your account status is ${membership.status}. Please contact your Administrator.`,
      };
    }

    // 3. Store active company ID in cookie so middleware attaches x-company-id for RLS
    const cookieStore = await cookies();
    cookieStore.set("kanakku_company_id", membership.company_id, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

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
  const cookieStore = await cookies();
  cookieStore.delete("kanakku_company_id");
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

    const adminClient = createAdminClient();

    // Clear requires_password_change flag
    await adminClient
      .from("user_profiles")
      .update({ requires_password_change: false, updated_at: new Date().toISOString() })
      .eq("id", sessionData.user.id);

    // Audit log
    const { data: mem } = await adminClient
      .from("company_memberships")
      .select("company_id")
      .eq("user_id", sessionData.user.id)
      .maybeSingle();

    if (mem?.company_id) {
      await adminClient.from("audit_logs").insert({
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
    const adminClient = createAdminClient();

    // Get user profile
    const { data: profile } = await adminClient
      .from("user_profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    // Get active company membership
    const { data: membership } = await adminClient
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
    const { data: branchMappings } = await adminClient
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
      companyName: companyInfo?.trade_name || companyInfo?.legal_name || "Sri Murugan Food Industries",
      accessibleBranches: branches,
      requiresPasswordChange: profile?.requires_password_change ?? false,
      permissions: [],
    };
  } catch {
    return null;
  }
}
