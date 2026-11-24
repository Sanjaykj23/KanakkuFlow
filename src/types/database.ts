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

// ============================================================================
// PHASE 3: PROCUREMENT & GOODS RECEIPT TYPES
// ============================================================================

export type PurchaseOrderStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "REJECTED"
  | "CANCELLED";

export type GrnStatus = "DRAFT" | "POSTED" | "CANCELLED";

export type QcStatus = "PENDING" | "RELEASED" | "REJECTED" | "QUARANTINED";

export type BatchType =
  | "RAW_MATERIAL"
  | "PACKAGING"
  | "BULK_WIP"
  | "FINISHED_GOODS";

export type BatchStatus =
  | "ACTIVE"
  | "QC_PENDING"
  | "QUARANTINED"
  | "BLOCKED"
  | "EXPIRED"
  | "DEPLETED";

export type ReservationStatus =
  | "ACTIVE"
  | "RELEASED"
  | "CONSUMED"
  | "EXPIRED"
  | "CANCELLED";

export type StockTransferStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "IN_TRANSIT"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "REJECTED"
  | "CANCELLED";

export type StockAdjustmentStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export type StockAdjustmentType =
  | "PHYSICAL_COUNT"
  | "DAMAGE"
  | "EXPIRY"
  | "FOUND"
  | "RECONCILIATION";

export type StockMovementType =
  | "GRN_RECEIPT"
  | "GRN_REVERSAL"
  | "STOCK_TRANSFER_OUT"
  | "STOCK_TRANSFER_IN"
  | "STOCK_ADJUSTMENT_IN"
  | "STOCK_ADJUSTMENT_OUT"
  | "OPENING_STOCK"
  | "PRODUCTION_CONSUMPTION"
  | "PRODUCTION_OUTPUT"
  | "SALES_DISPATCH"
  | "SALES_RETURN"
  | "PURCHASE_RETURN"
  | "PRODUCTION_ISSUE"
  | "PRODUCTION_RECEIPT"
  | "STOCK_ADJUSTMENT";

export type SupplierBillStatus =
  | "DRAFT"
  | "POSTED"
  | "DISCREPANCY_FLAGGED"
  | "PAID"
  | "CANCELLED";

export type BomType = "BULK_WIP" | "PACKAGING" | "FINISHED_GOODS";
export type BomStatus = "DRAFT" | "ACTIVE" | "INACTIVE" | "OBSOLETE";
export type BomComponentType = "RAW_MATERIAL" | "PACKAGING" | "BULK_WIP";
export type ProductionStage = "BULK_PRODUCTION" | "PACKAGING_PRODUCTION";
export type ProductionOrderStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "MATERIAL_RESERVED"
  | "IN_PROGRESS"
  | "PARTIALLY_COMPLETED"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED";

export interface PurchaseOrder {
  id: string;
  company_id: string;
  branch_id: string;
  po_number: string;
  supplier_id: string;
  delivery_warehouse_id: string;
  order_date: string;
  expected_delivery_date: string;
  status: PurchaseOrderStatus;
  created_by: string;
  approved_by?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  cancellation_reason?: string | null;
  currency: string;
  subtotal_paisa: number;
  tax_paisa: number;
  discount_paisa: number;
  total_paisa: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  branch?: Branch;
  supplier?: Supplier;
  delivery_warehouse?: Warehouse;
  created_by_profile?: UserProfile;
  approved_by_profile?: UserProfile;
  lines?: PurchaseOrderLine[];
}

export interface PurchaseOrderLine {
  id: string;
  company_id: string;
  purchase_order_id: string;
  line_number: number;
  item_id: string;
  ordered_qty: number;
  unit_id: string;
  conversion_rate: number;
  base_unit_qty: number;
  unit_price_paisa: number;
  discount_paisa: number;
  tax_rate_id?: string | null;
  tax_rate_snapshot: number;
  tax_paisa: number;
  total_paisa: number;
  received_qty: number;
  pending_qty: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  item?: Item;
  unit?: Unit;
  tax_rate?: TaxRate;
}

export interface GoodsReceiptNote {
  id: string;
  company_id: string;
  branch_id: string;
  warehouse_id: string;
  grn_number: string;
  purchase_order_id: string;
  supplier_id: string;
  receiving_employee_id: string;
  receipt_date: string;
  supplier_delivery_challan: string;
  status: GrnStatus;
  posted_at?: string | null;
  posted_by?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  branch?: Branch;
  warehouse?: Warehouse;
  purchase_order?: PurchaseOrder;
  supplier?: Supplier;
  receiving_employee?: UserProfile;
  posted_by_profile?: UserProfile;
  lines?: GoodsReceiptNoteLine[];
}

export interface GoodsReceiptNoteLine {
  id: string;
  company_id: string;
  grn_id: string;
  po_line_id: string;
  item_id: string;
  received_qty: number;
  accepted_qty: number;
  rejected_qty: number;
  damaged_qty: number;
  unit_id: string;
  conversion_rate: number;
  base_accepted_qty: number;
  supplier_batch_number?: string | null;
  manufacturing_date?: string | null;
  expiry_date?: string | null;
  qc_status: QcStatus;
  rejection_reason?: string | null;
  created_at: string;
  item?: Item;
  unit?: Unit;
  po_line?: PurchaseOrderLine;
}

export interface InventoryBatch {
  id: string;
  company_id: string;
  branch_id: string;
  warehouse_id: string;
  item_id: string;
  batch_number: string;
  batch_type: BatchType;
  batch_status: BatchStatus;
  supplier_id?: string | null;
  supplier_batch_number?: string | null;
  grn_id?: string | null;
  grn_line_id?: string | null;
  received_date: string;
  manufacturing_date?: string | null;
  expiry_date?: string | null;
  initial_qty: number;
  current_qty: number;
  reserved_qty: number;
  base_unit_id: string;
  unit_cost_paisa: number;
  qc_status: QcStatus;
  blocked_reason?: string | null;
  blocked_by?: string | null;
  blocked_at?: string | null;
  qc_released_by?: string | null;
  qc_released_at?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  warehouse?: Warehouse;
  item?: Item;
  supplier?: Supplier;
  base_unit?: Unit;
  grn?: GoodsReceiptNote;
}

export interface StockMovement {
  id: string;
  company_id: string;
  branch_id: string;
  warehouse_id: string;
  item_id: string;
  batch_id?: string | null;
  movement_type: StockMovementType;
  quantity: number;
  base_unit_id: string;
  unit_cost_paisa: number;
  reference_type: string;
  reference_id: string;
  reason?: string | null;
  created_by: string;
  created_at: string;
  warehouse?: Warehouse;
  item?: Item;
  batch?: InventoryBatch;
  base_unit?: Unit;
  creator?: UserProfile;
}

export interface StockReservation {
  id: string;
  company_id: string;
  branch_id: string;
  warehouse_id: string;
  item_id: string;
  batch_id: string;
  reserved_qty: number;
  base_unit_id: string;
  source_document_type: string;
  source_document_id: string;
  status: ReservationStatus;
  expiry_timestamp?: string | null;
  notes?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  warehouse?: Warehouse;
  item?: Item;
  batch?: InventoryBatch;
  base_unit?: Unit;
  creator?: UserProfile;
}

export interface StockTransfer {
  id: string;
  company_id: string;
  transfer_number: string;
  source_branch_id: string;
  source_warehouse_id: string;
  destination_branch_id: string;
  destination_warehouse_id: string;
  status: StockTransferStatus;
  notes?: string | null;
  created_by: string;
  approved_by?: string | null;
  approved_at?: string | null;
  dispatched_by?: string | null;
  dispatched_at?: string | null;
  received_by?: string | null;
  received_at?: string | null;
  created_at: string;
  updated_at: string;
  source_branch?: Branch;
  source_warehouse?: Warehouse;
  destination_branch?: Branch;
  destination_warehouse?: Warehouse;
  creator?: UserProfile;
  lines?: StockTransferLine[];
}

export interface StockTransferLine {
  id: string;
  company_id: string;
  transfer_id: string;
  line_number: number;
  item_id: string;
  batch_id: string;
  requested_qty: number;
  dispatched_qty: number;
  received_qty: number;
  unit_id: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  item?: Item;
  batch?: InventoryBatch;
  unit?: Unit;
}

export interface StockAdjustment {
  id: string;
  company_id: string;
  branch_id: string;
  warehouse_id: string;
  adjustment_number: string;
  adjustment_type: StockAdjustmentType;
  status: StockAdjustmentStatus;
  reason: string;
  created_by: string;
  approved_by?: string | null;
  approved_at?: string | null;
  created_at: string;
  updated_at: string;
  branch?: Branch;
  warehouse?: Warehouse;
  creator?: UserProfile;
  lines?: StockAdjustmentLine[];
}

export interface StockAdjustmentLine {
  id: string;
  company_id: string;
  adjustment_id: string;
  line_number: number;
  item_id: string;
  batch_id: string;
  system_qty: number;
  counted_qty: number;
  difference_qty: number;
  unit_id: string;
  reason?: string | null;
  created_at: string;
  updated_at: string;
  item?: Item;
  batch?: InventoryBatch;
  unit?: Unit;
}

export interface ItemValuationLedger {
  id: string;
  company_id: string;
  item_id: string;
  total_on_hand_qty: number;
  weighted_avg_cost_paisa: number;
  total_valuation_paisa: number;
  last_movement_id?: string | null;
  updated_at: string;
  item?: Item;
}

export interface SupplierBill {
  id: string;
  company_id: string;
  branch_id: string;
  bill_number: string;
  supplier_id: string;
  supplier_invoice_number: string;
  invoice_date: string;
  due_date: string;
  purchase_order_id?: string | null;
  grn_id?: string | null;
  taxable_amount_paisa: number;
  tax_amount_paisa: number;
  freight_charges_paisa: number;
  discount_paisa: number;
  total_amount_paisa: number;
  status: SupplierBillStatus;
  discrepancy_notes?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  supplier?: Supplier;
  branch?: Branch;
  purchase_order?: PurchaseOrder;
  grn?: GoodsReceiptNote;
  creator?: UserProfile;
}

export interface BillOfMaterials {
  id: string;
  company_id: string;
  bom_number: string;
  product_id: string;
  bom_type: BomType;
  version: string;
  effective_date: string;
  status: BomStatus;
  expected_output_qty: number;
  output_unit_id: string;
  expected_yield_percent: number;
  expected_wastage_percent: number;
  labor_overhead_cost_paisa: number;
  notes?: string | null;
  created_by: string;
  approved_by?: string | null;
  created_at: string;
  updated_at: string;
  product?: Item;
  output_unit?: Unit;
  creator?: UserProfile;
  lines?: BomLine[];
}

export interface BomLine {
  id: string;
  company_id: string;
  bom_id: string;
  line_number: number;
  component_item_id: string;
  component_type: BomComponentType;
  quantity: number;
  unit_id: string;
  conversion_rate: number;
  base_unit_qty: number;
  expected_wastage_percent: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  component_item?: Item;
  unit?: Unit;
}

export interface ProductionOrder {
  id: string;
  company_id: string;
  branch_id: string;
  order_number: string;
  bom_id: string;
  product_id: string;
  order_type: ProductionStage;
  planned_qty: number;
  produced_qty: number;
  unit_id: string;
  production_warehouse_id: string;
  finished_warehouse_id: string;
  planned_start_date: string;
  planned_completion_date: string;
  actual_start_date?: string | null;
  actual_completion_date?: string | null;
  status: ProductionOrderStatus;
  source_bulk_batch_id?: string | null;
  total_material_cost_paisa: number;
  additional_costs_paisa: number;
  total_production_cost_paisa: number;
  unit_cost_paisa: number;
  rejection_reason?: string | null;
  cancellation_reason?: string | null;
  notes?: string | null;
  created_by: string;
  approved_by?: string | null;
  approved_at?: string | null;
  created_at: string;
  updated_at: string;
  branch?: Branch;
  bom?: BillOfMaterials;
  product?: Item;
  unit?: Unit;
  production_warehouse?: Warehouse;
  finished_warehouse?: Warehouse;
  source_bulk_batch?: InventoryBatch;
  creator?: UserProfile;
  consumptions?: ProductionConsumption[];
  outputs?: ProductionOutput[];
}

export interface ProductionConsumption {
  id: string;
  company_id: string;
  production_order_id: string;
  item_id: string;
  batch_id: string;
  warehouse_id: string;
  consumed_qty: number;
  wastage_qty: number;
  unit_id: string;
  unit_cost_paisa: number;
  total_cost_paisa: number;
  reason?: string | null;
  recorded_by: string;
  created_at: string;
  item?: Item;
  batch?: InventoryBatch;
  warehouse?: Warehouse;
  unit?: Unit;
}

export interface ProductionOutput {
  id: string;
  company_id: string;
  production_order_id: string;
  item_id: string;
  output_batch_id: string;
  warehouse_id: string;
  produced_qty: number;
  rejected_qty: number;
  unit_id: string;
  unit_cost_paisa: number;
  total_cost_paisa: number;
  qc_status: QcStatus;
  qc_notes?: string | null;
  qc_inspected_by?: string | null;
  qc_inspected_at?: string | null;
  produced_by: string;
  created_at: string;
  item?: Item;
  output_batch?: InventoryBatch;
  warehouse?: Warehouse;
  unit?: Unit;
}

// ============================================================================
// PHASE 6: SALES & ORDER MANAGEMENT
// ============================================================================

export type SalesOrderStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "PARTIALLY_ALLOCATED"
  | "ALLOCATED"
  | "READY_FOR_DISPATCH"
  | "PARTIALLY_DISPATCHED"
  | "DISPATCHED"
  | "REJECTED"
  | "CANCELLED";

export type SalesOrderApprovalStatus =
  | "NOT_REQUIRED"
  | "PENDING"
  | "APPROVED"
  | "REJECTED";

export type PriceListType =
  | "STANDARD"
  | "CUSTOMER_SPECIAL"
  | "DISTRIBUTOR"
  | "SEASONAL";

export interface PriceList {
  id: string;
  company_id: string;
  code: string;
  name: string;
  list_type: PriceListType;
  is_default: boolean;
  is_active: boolean;
  valid_from: string;
  valid_to?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  items?: PriceListItem[];
}

export interface PriceListItem {
  id: string;
  company_id: string;
  price_list_id: string;
  item_id: string;
  unit_id: string;
  price_paisa: number;
  min_selling_price_paisa: number;
  created_at: string;
  updated_at: string;
  item?: Item;
  unit?: Unit;
}

export interface CustomerPricing {
  id: string;
  company_id: string;
  customer_id: string;
  item_id: string;
  unit_id: string;
  special_price_paisa: number;
  min_selling_price_paisa: number;
  valid_from: string;
  valid_to?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  item?: Item;
  unit?: Unit;
}

export interface SalesOrder {
  id: string;
  company_id: string;
  branch_id: string;
  order_number: string;
  customer_id: string;
  delivery_address_id: string;
  assigned_salesman_id?: string | null;
  order_date: string;
  requested_delivery_date: string;
  payment_terms_days: number;
  price_list_id?: string | null;
  status: SalesOrderStatus;
  approval_status: SalesOrderApprovalStatus;
  approval_required_reason?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  approval_notes?: string | null;
  subtotal_paisa: number;
  discount_paisa: number;
  tax_paisa: number;
  total_amount_paisa: number;
  notes?: string | null;
  cancellation_reason?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  branch?: Branch;
  delivery_address?: CustomerAddress;
  salesman?: UserProfile;
  price_list?: PriceList;
  approver?: UserProfile;
  creator?: UserProfile;
  lines?: SalesOrderLine[];
  allocations?: SalesOrderAllocation[];
}

export interface SalesOrderLine {
  id: string;
  company_id: string;
  sales_order_id: string;
  item_id: string;
  sku: string;
  ordered_qty: number;
  allocated_qty: number;
  dispatched_qty: number;
  unit_id: string;
  conversion_rate: number;
  base_ordered_qty: number;
  base_allocated_qty: number;
  unit_price_paisa: number;
  discount_percent: number;
  discount_amount_paisa: number;
  tax_rate_id?: string | null;
  tax_rate_percent: number;
  taxable_amount_paisa: number;
  cgst_paisa: number;
  sgst_paisa: number;
  igst_paisa: number;
  line_total_paisa: number;
  created_at: string;
  updated_at: string;
  item?: Item;
  unit?: Unit;
  tax_rate?: TaxRate;
}

export interface SalesOrderAllocation {
  id: string;
  company_id: string;
  sales_order_id: string;
  sales_order_line_id: string;
  reservation_id: string;
  batch_id: string;
  warehouse_id: string;
  allocated_qty: number;
  status: string;
  created_at: string;
  batch?: InventoryBatch;
  warehouse?: Warehouse;
}

