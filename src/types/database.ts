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

// ============================================================================
// PHASE 2: MASTER DATA & FIELD SALES REGISTRATION TYPES
// ============================================================================

export type RegistrationStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export type CustomerType =
  | "RETAILER"
  | "WHOLESALER"
  | "DISTRIBUTOR"
  | "SUPERMARKET"
  | "DIRECT_CONSUMER";

export type ItemType =
  | "RAW_MATERIAL"
  | "PACKAGING"
  | "SEMI_FINISHED"
  | "FINISHED_GOOD"
  | "TRADED_GOOD"
  | "CONSUMABLE";

export interface Unit {
  id: string;
  company_id: string;
  code: string;
  name: string;
  symbol: string;
  is_base_unit: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UnitConversion {
  id: string;
  company_id: string;
  from_unit_id: string;
  to_unit_id: string;
  conversion_rate: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  from_unit?: Unit;
  to_unit?: Unit;
}

export interface HsnCode {
  id: string;
  company_id: string;
  code: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaxRate {
  id: string;
  company_id: string;
  name: string;
  igst_rate: number;
  cgst_rate: number;
  sgst_rate: number;
  cess_rate: number;
  effective_from: string;
  effective_to?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Item {
  id: string;
  company_id: string;
  code: string;
  name: string;
  item_type: ItemType;
  category: string;
  primary_unit_id: string;
  hsn_code_id?: string | null;
  default_tax_rate_id?: string | null;
  mrp: number;
  base_price: number;
  reorder_level: number;
  shelf_life_days?: number | null;
  is_fefo_tracked: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  primary_unit?: Unit;
  hsn_code?: HsnCode;
  tax_rate?: TaxRate;
}

export interface Supplier {
  id: string;
  company_id: string;
  code: string;
  name: string;
  trade_name?: string | null;
  gstin?: string | null;
  pan?: string | null;
  contact_person?: string | null;
  email?: string | null;
  mobile: string;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state: string;
  pincode: string;
  payment_terms_days: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Warehouse {
  id: string;
  company_id: string;
  branch_id: string;
  code: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  branch?: Branch;
}

export interface CustomerRegistrationRequest {
  id: string;
  company_id: string;
  branch_id: string;
  request_number: string;
  shop_name: string;
  owner_name: string;
  mobile_number: string;
  normalized_mobile: string;
  alternate_number?: string | null;
  email?: string | null;
  gstin?: string | null;
  pan?: string | null;
  fssai_number?: string | null;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state: string;
  pincode: string;
  latitude?: number | null;
  longitude?: number | null;
  shop_photo_url?: string | null;
  status: RegistrationStatus;
  submitted_by: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  duplicate_override_reason?: string | null;
  created_customer_id?: string | null;
  created_at: string;
  updated_at: string;
  branch?: Branch;
  submitted_by_profile?: UserProfile;
  reviewed_by_profile?: UserProfile;
}

export interface Customer {
  id: string;
  company_id: string;
  branch_id: string;
  customer_code: string;
  shop_name: string;
  owner_name: string;
  mobile_number: string;
  normalized_mobile: string;
  alternate_number?: string | null;
  email?: string | null;
  gstin?: string | null;
  pan?: string | null;
  fssai_number?: string | null;
  customer_type: CustomerType;
  credit_limit: number;
  payment_terms_days: number;
  assigned_salesman_id?: string | null;
  registration_request_id?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  branch?: Branch;
  assigned_salesman_profile?: UserProfile;
  primary_address?: CustomerAddress;
  addresses?: CustomerAddress[];
}

export interface CustomerAddress {
  id: string;
  company_id: string;
  customer_id: string;
  address_type: string;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state: string;
  pincode: string;
  latitude?: number | null;
  longitude?: number | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}
