export type UserRole =
  | "OWNER"
  | "ADMIN"
  | "SUPERVISOR"
  | "SALESMAN"
  | "ACCOUNTANT"
  | "PRODUCTION"
  | "WAREHOUSE";

export type MembershipStatus = "ACTIVE" | "SUSPENDED" | "DEACTIVATED";

export type InvitationStatus = "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";

export interface Company {
  id: string;
  legal_name: string;
  trade_name: string;
  gstin?: string | null;
  pan?: string | null;
  state_code: string;
  email: string;
  phone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Branch {
  id: string;
  company_id: string;
  code: string;
  name: string;
  address_line1: string;
  city: string;
  state_code: string;
  pincode: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string; // references auth.users.id
  email: string;
  full_name: string;
  mobile_number?: string | null;
  avatar_url?: string | null;
  requires_password_change: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompanyMembership {
  id: string;
  company_id: string;
  user_id: string;
  role: UserRole;
  employee_code: string;
  status: MembershipStatus;
  territory_notes?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  user_profile?: UserProfile;
  company?: Company;
  branches?: Branch[];
}

export interface MembershipBranch {
  id: string;
  membership_id: string;
  branch_id: string;
  is_default: boolean;
  created_at: string;
}

export interface RolePermission {
  role: UserRole;
  permission_key: string;
  module: string;
  description?: string | null;
  created_at: string;
}

export interface UserInvitation {
  id: string;
  company_id: string;
  email: string;
  full_name: string;
  mobile_number?: string | null;
  role: UserRole;
  employee_code: string;
  token_hash: string;
  status: InvitationStatus;
  territory_notes?: string | null;
  invited_by: string;
  expires_at: string;
  accepted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  company_id: string;
  user_id?: string | null;
  action: string;
  entity_name: string;
  entity_id: string;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}
