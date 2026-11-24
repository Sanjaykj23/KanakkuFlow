import { z } from "zod";

export const goodsReceiptLineSchema = z
  .object({
    poLineId: z.string().uuid("Please select a valid purchase order line"),
    itemId: z.string().uuid("Invalid item ID"),
    receivedQty: z.coerce.number().positive("Received quantity must be greater than zero"),
    acceptedQty: z.coerce.number().min(0, "Accepted quantity cannot be negative").default(0),
    rejectedQty: z.coerce.number().min(0, "Rejected quantity cannot be negative").default(0),
    damagedQty: z.coerce.number().min(0, "Damaged quantity cannot be negative").default(0),
    unitId: z.string().uuid("Invalid unit ID"),
    conversionRate: z.coerce.number().positive().default(1.0),
    supplierBatchNumber: z.string().max(100).optional().or(z.literal("")),
    manufacturingDate: z.string().optional().or(z.literal("")),
    expiryDate: z.string().optional().or(z.literal("")),
    qcStatus: z.enum(["PENDING", "RELEASED", "REJECTED", "QUARANTINED"]).default("PENDING"),
    rejectionReason: z.string().max(255).optional().or(z.literal("")),
  })
  .refine(
    (data) =>
      Math.abs(data.receivedQty - (data.acceptedQty + data.rejectedQty + data.damagedQty)) < 0.0001,
    {
      message: "Quantity Balance Violation: Received quantity must equal Accepted + Rejected + Damaged quantity.",
      path: ["receivedQty"],
    }
  );

export type GoodsReceiptLineInput = z.infer<typeof goodsReceiptLineSchema>;

export const goodsReceiptSchema = z.object({
  id: z.string().uuid().optional(),
  purchaseOrderId: z.string().uuid("Please select an approved purchase order"),
  supplierId: z.string().uuid("Invalid supplier ID"),
  branchId: z.string().uuid("Invalid branch ID"),
  warehouseId: z.string().uuid("Please select a receiving warehouse"),
  receiptDate: z.string().min(10, "Receipt date is required"),
  supplierDeliveryChallan: z.string().min(2, "Supplier Delivery Challan / DC Number is required"),
  notes: z.string().max(500).optional().or(z.literal("")),
  lines: z.array(goodsReceiptLineSchema).min(1, "At least one item receipt line is required"),
});

export type GoodsReceiptInput = z.infer<typeof goodsReceiptSchema>;
