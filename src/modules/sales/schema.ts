import { z } from "zod";

// ============================================================================
// 1. PRICE LIST SCHEMAS
// ============================================================================

export const priceListItemSchema = z.object({
  itemId: z.string().uuid("Please select an item"),
  unitId: z.string().uuid("Please select a unit"),
  price: z.coerce.number().positive("Selling price must be greater than zero"),
  minSellingPrice: z.coerce.number().min(0, "Minimum price cannot be negative").default(0),
});

export type PriceListItemInput = z.infer<typeof priceListItemSchema>;

export const priceListSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().min(1, "Price list code is required").max(50),
  name: z.string().min(1, "Price list name is required").max(255),
  listType: z.enum(["STANDARD", "CUSTOMER_SPECIAL", "DISTRIBUTOR", "SEASONAL"]).default("STANDARD"),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  validFrom: z.string().min(10, "Valid from date is required"),
  validTo: z.string().min(10).optional().nullable().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
  items: z.array(priceListItemSchema).min(1, "At least one item must be added to the price list"),
});

export type PriceListInput = z.infer<typeof priceListSchema>;

export const customerPricingSchema = z.object({
  id: z.string().uuid().optional(),
  customerId: z.string().uuid("Please select a customer"),
  itemId: z.string().uuid("Please select an item"),
  unitId: z.string().uuid("Please select a unit"),
  specialPrice: z.coerce.number().positive("Special contract price must be greater than zero"),
  minSellingPrice: z.coerce.number().min(0).default(0),
  validFrom: z.string().min(10, "Valid from date is required"),
  validTo: z.string().min(10).optional().nullable().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export type CustomerPricingInput = z.infer<typeof customerPricingSchema>;

// ============================================================================
// 2. SALES ORDER LINE SCHEMA
// ============================================================================

export const salesOrderLineSchema = z.object({
  id: z.string().uuid().optional(),
  itemId: z.string().uuid("Please select a product"),
  sku: z.string().min(1, "SKU is required"),
  orderedQty: z.coerce.number().positive("Quantity must be greater than zero"),
  unitId: z.string().uuid("Please select a unit"),
  conversionRate: z.coerce.number().positive().default(1.0),
  unitPrice: z.coerce.number().positive("Unit price must be greater than zero"),
  discountPercent: z.coerce.number().min(0, "Discount cannot be negative").max(100, "Discount cannot exceed 100%").default(0),
  taxRateId: z.string().uuid().optional().nullable().or(z.literal("")),
  notes: z.string().max(255).optional().or(z.literal("")),
});

export type SalesOrderLineInput = z.infer<typeof salesOrderLineSchema>;

// ============================================================================
// 3. SALES ORDER SCHEMA
// ============================================================================

export const salesOrderSchema = z.object({
  id: z.string().uuid().optional(),
  branchId: z.string().uuid("Please select a branch"),
  customerId: z.string().uuid("Please select an active customer"),
  deliveryAddressId: z.string().uuid("Please select delivery address"),
  assignedSalesmanId: z.string().uuid().optional().nullable().or(z.literal("")),
  orderDate: z.string().min(10, "Order date is required"),
  requestedDeliveryDate: z.string().min(10, "Requested delivery date is required"),
  paymentTermsDays: z.coerce.number().min(0, "Payment terms cannot be negative").default(7),
  priceListId: z.string().uuid().optional().nullable().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
  submitForApproval: z.boolean().default(true),
  lines: z.array(salesOrderLineSchema).min(1, "A sales order must contain at least one line item"),
});

export type SalesOrderInput = z.infer<typeof salesOrderSchema>;

// ============================================================================
// 4. APPROVAL & ALLOCATION SCHEMAS
// ============================================================================

export const salesOrderApprovalSchema = z.object({
  orderId: z.string().uuid("Invalid sales order ID"),
  decision: z.enum(["APPROVED", "REJECTED"]),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export type SalesOrderApprovalInput = z.infer<typeof salesOrderApprovalSchema>;

export const salesOrderAllocationSchema = z.object({
  orderId: z.string().uuid("Invalid sales order ID"),
  warehouseId: z.string().uuid().optional().nullable().or(z.literal("")),
});

export type SalesOrderAllocationInput = z.infer<typeof salesOrderAllocationSchema>;

export const salesOrderCancellationSchema = z.object({
  orderId: z.string().uuid("Invalid sales order ID"),
  reason: z.string().min(3, "Please provide a valid cancellation reason").max(500),
});

export type SalesOrderCancellationInput = z.infer<typeof salesOrderCancellationSchema>;
