import { z } from "zod";

// Units
export const unitSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().min(1, "Code is required").max(20).toUpperCase(),
  name: z.string().min(1, "Name is required").max(100),
  symbol: z.string().min(1, "Symbol is required").max(10),
  isBaseUnit: z.boolean().default(false),
});

export type UnitInput = z.infer<typeof unitSchema>;

// Unit Conversions
export const unitConversionSchema = z.object({
  id: z.string().uuid().optional(),
  fromUnitId: z.string().uuid("Please select source unit"),
  toUnitId: z.string().uuid("Please select target unit"),
  conversionRate: z.coerce.number().positive("Conversion rate must be greater than zero"),
});

export type UnitConversionInput = z.infer<typeof unitConversionSchema>;

// HSN Codes
export const hsnCodeSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().min(2, "HSN code is required").max(10),
  description: z.string().min(2, "Description is required"),
});

export type HsnCodeInput = z.infer<typeof hsnCodeSchema>;

// Tax Rates
export const taxRateSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Tax rate name is required").max(50),
  igstRate: z.coerce.number().min(0, "IGST rate must be 0 or greater"),
  cgstRate: z.coerce.number().min(0, "CGST rate must be 0 or greater"),
  sgstRate: z.coerce.number().min(0, "SGST rate must be 0 or greater"),
  cessRate: z.coerce.number().min(0, "CESS rate must be 0 or greater").default(0),
  effectiveFrom: z.string().min(10, "Effective from date is required"),
  effectiveTo: z.string().optional().nullable().or(z.literal("")),
});

export type TaxRateInput = z.infer<typeof taxRateSchema>;

// Items
export const itemSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().min(1, "Item code is required").max(50).toUpperCase(),
  name: z.string().min(2, "Item name is required").max(255),
  itemType: z.enum([
    "RAW_MATERIAL",
    "PACKAGING",
    "SEMI_FINISHED",
    "FINISHED_GOOD",
    "TRADED_GOOD",
    "CONSUMABLE",
  ]),
  category: z.string().min(1, "Category is required").max(100).default("GENERAL"),
  primaryUnitId: z.string().uuid("Please select a primary unit of measure"),
  hsnCodeId: z.string().uuid("Please select an HSN code").optional().nullable().or(z.literal("")),
  defaultTaxRateId: z.string().uuid("Please select a tax rate").optional().nullable().or(z.literal("")),
  mrp: z.coerce.number().min(0, "MRP must be 0 or greater").default(0),
  basePrice: z.coerce.number().min(0, "Base price must be 0 or greater").default(0),
  reorderLevel: z.coerce.number().min(0, "Reorder level must be 0 or greater").default(0),
  shelfLifeDays: z.coerce.number().int().positive("Shelf life must be positive").optional().nullable(),
  isFefoTracked: z.boolean().default(true),
});

export type ItemInput = z.infer<typeof itemSchema>;

// Suppliers
export const supplierSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().min(1, "Supplier code is required").max(50).toUpperCase(),
  name: z.string().min(2, "Supplier name is required").max(255),
  tradeName: z.string().max(255).optional().or(z.literal("")),
  gstin: z
    .string()
    .regex(
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
      "Invalid GSTIN format (e.g., 33AAAAA0000A1Z5)"
    )
    .optional()
    .or(z.literal("")),
  pan: z
    .string()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format")
    .optional()
    .or(z.literal("")),
  contactPerson: z.string().max(150).optional().or(z.literal("")),
  email: z.string().email("Invalid email format").optional().or(z.literal("")),
  mobile: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit Indian mobile number"),
  addressLine1: z.string().min(3, "Address line 1 is required"),
  addressLine2: z.string().optional().or(z.literal("")),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  pincode: z.string().regex(/^\d{6}$/, "Pincode must be 6 digits"),
  paymentTermsDays: z.coerce.number().int().min(0, "Payment terms must be 0 or greater").default(30),
});

export type SupplierInput = z.infer<typeof supplierSchema>;

// Warehouses
export const warehouseSchema = z.object({
  id: z.string().uuid().optional(),
  branchId: z.string().uuid("Please select a branch"),
  code: z.string().min(1, "Warehouse code is required").max(50).toUpperCase(),
  name: z.string().min(2, "Warehouse name is required").max(150),
});

export type WarehouseInput = z.infer<typeof warehouseSchema>;
