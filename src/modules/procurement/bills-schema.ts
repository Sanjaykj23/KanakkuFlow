import { z } from "zod";

export const supplierBillSchema = z.object({
  id: z.string().uuid().optional(),
  supplierId: z.string().uuid("Please select a supplier"),
  branchId: z.string().uuid("Please select a branch"),
  supplierInvoiceNumber: z.string().min(2, "Supplier invoice number is required").max(100),
  invoiceDate: z.string().min(10, "Invoice date is required"),
  dueDate: z.string().min(10, "Due date is required"),
  purchaseOrderId: z.string().uuid().optional().nullable().or(z.literal("")),
  grnId: z.string().uuid().optional().nullable().or(z.literal("")),
  taxableAmount: z.coerce.number().min(0, "Taxable amount cannot be negative"),
  taxAmount: z.coerce.number().min(0, "Tax amount cannot be negative").default(0),
  freightCharges: z.coerce.number().min(0, "Freight charges cannot be negative").default(0),
  discount: z.coerce.number().min(0, "Discount cannot be negative").default(0),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export type SupplierBillInput = z.infer<typeof supplierBillSchema>;
