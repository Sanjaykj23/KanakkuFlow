import { z } from "zod";

export const purchaseOrderLineSchema = z.object({
  id: z.string().uuid().optional(),
  itemId: z.string().uuid("Please select an item"),
  orderedQty: z.coerce.number().positive("Quantity must be greater than zero"),
  unitId: z.string().uuid("Please select a unit of measure"),
  conversionRate: z.coerce.number().positive().default(1.0),
  unitPrice: z.coerce.number().min(0, "Unit price cannot be negative"),
  discount: z.coerce.number().min(0, "Discount cannot be negative").default(0),
  taxRateId: z.string().uuid().optional().nullable().or(z.literal("")),
  taxRateSnapshot: z.coerce.number().min(0).default(0),
  notes: z.string().max(255).optional().or(z.literal("")),
});

export type PurchaseOrderLineInput = z.infer<typeof purchaseOrderLineSchema>;

export const purchaseOrderSchema = z.object({
  id: z.string().uuid().optional(),
  branchId: z.string().uuid("Please select an operating branch"),
  supplierId: z.string().uuid("Please select a supplier"),
  deliveryWarehouseId: z.string().uuid("Please select a delivery warehouse"),
  orderDate: z.string().min(10, "Order date is required"),
  expectedDeliveryDate: z.string().min(10, "Expected delivery date is required"),
  notes: z.string().max(500).optional().or(z.literal("")),
  lines: z
    .array(purchaseOrderLineSchema)
    .min(1, "At least one purchase order line item is required"),
});

export type PurchaseOrderInput = z.infer<typeof purchaseOrderSchema>;

export const approvePurchaseOrderSchema = z.object({
  purchaseOrderId: z.string().uuid("Invalid Purchase Order ID"),
});

export type ApprovePurchaseOrderInput = z.infer<typeof approvePurchaseOrderSchema>;

export const rejectPurchaseOrderSchema = z.object({
  poId: z.string().uuid("Invalid Purchase Order ID"),
  reason: z.string().min(3, "Rejection reason must be at least 3 characters"),
});

export type RejectPurchaseOrderInput = z.infer<typeof rejectPurchaseOrderSchema>;

export const cancelPurchaseOrderSchema = z.object({
  poId: z.string().uuid("Invalid Purchase Order ID"),
  reason: z.string().min(3, "Cancellation reason must be at least 3 characters"),
});

export type CancelPurchaseOrderInput = z.infer<typeof cancelPurchaseOrderSchema>;

export function calculatePoLineTotals(line: {
  orderedQty: number;
  unitPrice: number;
  discount?: number;
  discountPercent?: number;
  taxRatePercent?: number;
}) {
  const unitPricePaisa = Math.round(line.unitPrice * 100);
  const subtotalPaisa = Math.round(line.orderedQty * unitPricePaisa);
  let discountPaisa = 0;
  if (line.discountPercent !== undefined && line.discountPercent > 0) {
    discountPaisa = Math.round(subtotalPaisa * (line.discountPercent / 100));
  } else if (line.discount !== undefined && line.discount > 0) {
    discountPaisa = Math.round(line.discount * 100);
  }
  const taxablePaisa = Math.max(0, subtotalPaisa - discountPaisa);
  const taxPaisa = Math.round(taxablePaisa * ((line.taxRatePercent || 0) / 100));
  const totalPaisa = taxablePaisa + taxPaisa;

  return {
    unitPricePaisa,
    subtotalPaisa,
    discountPaisa,
    taxablePaisa,
    taxPaisa,
    totalPaisa,
  };
}

export function calculatePoTotals(lines: {
  subtotalPaisa: number;
  discountPaisa: number;
  taxPaisa: number;
  totalPaisa: number;
}[]) {
  const subtotalPaisa = lines.reduce((acc, l) => acc + l.subtotalPaisa, 0);
  const discountPaisa = lines.reduce((acc, l) => acc + l.discountPaisa, 0);
  const taxPaisa = lines.reduce((acc, l) => acc + l.taxPaisa, 0);
  const totalPaisa = lines.reduce((acc, l) => acc + l.totalPaisa, 0);

  return {
    subtotalPaisa,
    discountPaisa,
    taxPaisa,
    totalPaisa,
  };
}
