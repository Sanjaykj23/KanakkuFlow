import { z } from "zod";

export const stockReservationSchema = z.object({
  branchId: z.string().uuid("Invalid branch"),
  warehouseId: z.string().uuid("Please select a warehouse"),
  itemId: z.string().uuid("Please select an item"),
  batchId: z.string().uuid("Please select a batch"),
  reservedQty: z.coerce.number().positive("Reserved quantity must be greater than zero"),
  baseUnitId: z.string().uuid("Invalid unit"),
  sourceDocumentType: z.string().min(2, "Source document type required"),
  sourceDocumentId: z.string().uuid("Source document ID required"),
  expiryTimestamp: z.string().optional().nullable().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export type StockReservationInput = z.infer<typeof stockReservationSchema>;

export const stockTransferLineSchema = z.object({
  itemId: z.string().uuid("Please select an item"),
  batchId: z.string().uuid("Please select an eligible batch"),
  requestedQty: z.coerce.number().positive("Transfer quantity must be greater than zero"),
  unitId: z.string().uuid("Please select a unit"),
  notes: z.string().max(255).optional().or(z.literal("")),
});

export type StockTransferLineInput = z.infer<typeof stockTransferLineSchema>;

export const stockTransferSchema = z
  .object({
    id: z.string().uuid().optional(),
    sourceBranchId: z.string().uuid("Please select source branch"),
    sourceWarehouseId: z.string().uuid("Please select source warehouse"),
    destinationBranchId: z.string().uuid("Please select destination branch"),
    destinationWarehouseId: z.string().uuid("Please select destination warehouse"),
    notes: z.string().max(500).optional().or(z.literal("")),
    lines: z.array(stockTransferLineSchema).min(1, "At least one item line must be transferred"),
  })
  .refine((data) => data.sourceWarehouseId !== data.destinationWarehouseId, {
    message: "Source warehouse and destination warehouse cannot be identical.",
    path: ["destinationWarehouseId"],
  });

export type StockTransferInput = z.infer<typeof stockTransferSchema>;

export const stockAdjustmentLineSchema = z.object({
  itemId: z.string().uuid("Invalid item"),
  batchId: z.string().uuid("Please select a batch"),
  systemQty: z.coerce.number().min(0, "System quantity cannot be negative"),
  countedQty: z.coerce.number().min(0, "Counted quantity cannot be negative"),
  unitId: z.string().uuid("Invalid unit"),
  reason: z.string().max(255).optional().or(z.literal("")),
});

export type StockAdjustmentLineInput = z.infer<typeof stockAdjustmentLineSchema>;

export const stockAdjustmentSchema = z.object({
  id: z.string().uuid().optional(),
  branchId: z.string().uuid("Please select a branch"),
  warehouseId: z.string().uuid("Please select a warehouse"),
  adjustmentType: z.enum(["PHYSICAL_COUNT", "DAMAGE", "EXPIRY", "FOUND", "RECONCILIATION"]),
  reason: z.string().min(5, "Adjustment reason must be at least 5 characters"),
  lines: z.array(stockAdjustmentLineSchema).min(1, "At least one adjustment line is required"),
});

export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;

export const batchStatusUpdateSchema = z.object({
  batchId: z.string().uuid("Invalid batch ID"),
  batchStatus: z.enum(["ACTIVE", "QC_PENDING", "QUARANTINED", "BLOCKED", "EXPIRED", "DEPLETED"]),
  qcStatus: z.enum(["PENDING", "RELEASED", "REJECTED", "QUARANTINED"]),
  reason: z.string().max(500).optional().or(z.literal("")),
});

export type BatchStatusUpdateInput = z.infer<typeof batchStatusUpdateSchema>;
