import { z } from "zod";

export const bomLineSchema = z.object({
  componentItemId: z.string().uuid("Please select a component item"),
  componentType: z.enum(["RAW_MATERIAL", "PACKAGING", "BULK_WIP"]),
  quantity: z.coerce.number().positive("Quantity must be greater than zero"),
  unitId: z.string().uuid("Please select a unit"),
  conversionRate: z.coerce.number().positive().default(1.0),
  expectedWastagePercent: z.coerce.number().min(0, "Wastage percent cannot be negative").default(0),
  notes: z.string().max(255).optional().or(z.literal("")),
});

export type BomLineInput = z.infer<typeof bomLineSchema>;

export const bomSchema = z
  .object({
    id: z.string().uuid().optional(),
    productId: z.string().uuid("Please select the output product"),
    bomType: z.enum(["BULK_WIP", "PACKAGING", "FINISHED_GOODS"]),
    version: z.string().min(1, "Version is required").default("v1.0"),
    effectiveDate: z.string().min(10, "Effective date is required"),
    status: z.enum(["DRAFT", "ACTIVE", "INACTIVE", "OBSOLETE"]).default("ACTIVE"),
    expectedOutputQty: z.coerce.number().positive("Expected output quantity must be greater than zero"),
    outputUnitId: z.string().uuid("Please select the output unit"),
    expectedYieldPercent: z.coerce.number().positive().default(100.0),
    expectedWastagePercent: z.coerce.number().min(0).default(0.0),
    laborOverheadCostPaisa: z.coerce.number().min(0).default(0),
    notes: z.string().max(500).optional().or(z.literal("")),
    lines: z.array(bomLineSchema).min(1, "A Bill of Materials must contain at least one recipe component"),
  })
  .refine(
    (data) => {
      // Anti-circular dependency check: component item cannot be the produced output product
      return !data.lines.some((line) => line.componentItemId === data.productId);
    },
    {
      message: "Circular Dependency Violation: The output product cannot be listed as its own recipe component.",
      path: ["lines"],
    }
  );

export type BomInput = z.infer<typeof bomSchema>;

export const productionOrderSchema = z.object({
  id: z.string().uuid().optional(),
  branchId: z.string().uuid("Please select a manufacturing branch"),
  productId: z.string().uuid("Please select a product"),
  bomId: z.string().uuid("Please select an approved BOM version"),
  orderType: z.enum(["BULK_PRODUCTION", "PACKAGING_PRODUCTION"]),
  plannedQty: z.coerce.number().positive("Planned production quantity must be greater than zero"),
  unitId: z.string().uuid("Please select a unit"),
  productionWarehouseId: z.string().uuid("Please select ingredient storage warehouse"),
  finishedWarehouseId: z.string().uuid("Please select output warehouse"),
  plannedStartDate: z.string().min(10, "Planned start date is required"),
  plannedCompletionDate: z.string().min(10, "Planned completion date is required"),
  sourceBulkBatchId: z.string().uuid().optional().nullable().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export type ProductionOrderInput = z.infer<typeof productionOrderSchema>;

export const productionConsumptionSchema = z.object({
  orderId: z.string().uuid("Invalid production order"),
  itemId: z.string().uuid("Invalid item"),
  batchId: z.string().uuid("Please select a batch"),
  warehouseId: z.string().uuid("Invalid warehouse"),
  consumedQty: z.coerce.number().positive("Consumed quantity must be greater than zero"),
  wastageQty: z.coerce.number().min(0, "Wastage quantity cannot be negative").default(0),
  unitId: z.string().uuid("Invalid unit"),
  reason: z.string().max(255).optional().or(z.literal("")),
});

export type ProductionConsumptionInput = z.infer<typeof productionConsumptionSchema>;

export const productionOutputSchema = z.object({
  orderId: z.string().uuid("Invalid production order"),
  producedQty: z.coerce.number().positive("Produced quantity must be greater than zero"),
  rejectedQty: z.coerce.number().min(0).default(0),
  manufacturingDate: z.string().min(10, "Manufacturing date required"),
  expiryDate: z.string().min(10, "Expiry date required"),
  additionalCostsPaisa: z.coerce.number().min(0).default(0),
});

export type ProductionOutputInput = z.infer<typeof productionOutputSchema>;

export const productionQcReleaseSchema = z.object({
  outputId: z.string().uuid("Invalid output ID"),
  qcStatus: z.enum(["RELEASED", "REJECTED", "QUARANTINED"]),
  qcNotes: z.string().max(500).optional().or(z.literal("")),
});

export type ProductionQcReleaseInput = z.infer<typeof productionQcReleaseSchema>;
