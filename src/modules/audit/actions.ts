"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserSession } from "@/modules/auth/actions";

export interface AuditLogEntry {
  id: string;
  action: string;
  entityName: string;
  entityId: string;
  oldValues: any;
  newValues: any;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  userName: string;
  userEmail: string;
}

export async function getAuditLogsAction(filters?: {
  action?: string;
  entityName?: string;
  limit?: number;
}): Promise<{
  success: boolean;
  data?: AuditLogEntry[];
  error?: string;
}> {
  try {
    const session = await getCurrentUserSession();
    if (!session) return { success: false, error: "Unauthorized session." };

    if (session.role !== "OWNER") {
      return { success: false, error: "Access Denied: Audit trail is strictly restricted to OWNER role." };
    }

    const admin = createAdminClient();
    let query = admin
      .from("audit_logs")
      .select(`
        id, action, entity_name, entity_id, old_values, new_values, ip_address, user_agent, created_at,
        user:user_id(id, raw_user_meta_data, email)
      `)
      .eq("company_id", session.companyId)
      .order("created_at", { ascending: false })
      .limit(filters?.limit || 50);

    if (filters?.action && filters.action !== "ALL") {
      query = query.eq("action", filters.action);
    }
    if (filters?.entityName && filters.entityName !== "ALL") {
      query = query.eq("entity_name", filters.entityName);
    }

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };

    const logs: AuditLogEntry[] = (data || []).map((l: any) => ({
      id: l.id,
      action: l.action,
      entityName: l.entity_name,
      entityId: l.entity_id,
      oldValues: l.old_values,
      newValues: l.new_values,
      ipAddress: l.ip_address,
      userAgent: l.user_agent,
      createdAt: l.created_at,
      userName: l.user?.raw_user_meta_data?.full_name || l.user?.email || "System/Automated",
      userEmail: l.user?.email || "system@kanakkuflow.local",
    }));

    return { success: true, data: logs };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to fetch audit logs." };
  }
}
