import { z } from "zod";

// ============================================================================
// 1. SALES INVOICE SCHEMAS
// ============================================================================

export const createInvoiceFromOrderSchema = z.object({
  orderId: z.string().uuid("Please select a valid sales order"),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export type CreateInvoiceFromOrderInput = z.infer<typeof createInvoiceFromOrderSchema>;

// ============================================================================
// 2. CUSTOMER PAYMENT & ALLOCATION SCHEMAS
// ============================================================================

export const paymentAllocationItemSchema = z.object({
  invoiceId: z.string().uuid("Invalid invoice ID"),
  amount: z.coerce.number().positive("Allocated amount must be greater than zero"),
});

export type PaymentAllocationItemInput = z.infer<typeof paymentAllocationItemSchema>;

export const customerPaymentSchema = z.object({
  customerId: z.string().uuid("Please select a customer"),
  branchId: z.string().uuid("Please select a branch"),
  paymentMethod: z.enum([
    "CASH",
    "BANK_TRANSFER",
    "UPI",
    "CHEQUE",
    "DEMAND_DRAFT",
    "OTHER",
  ]),
  amount: z.coerce.number().positive("Payment amount must be greater than zero"),
  referenceNumber: z.string().max(100).optional().or(z.literal("")),
  paymentDate: z.string().min(10, "Payment date is required"),
  notes: z.string().max(500).optional().or(z.literal("")),
  allocations: z.array(paymentAllocationItemSchema).default([]),
});

export type CustomerPaymentInput = z.infer<typeof customerPaymentSchema>;

// ============================================================================
// 3. CREDIT NOTE SCHEMAS
// ============================================================================

export const creditNoteLineSchema = z.object({
  itemId: z.string().uuid().optional().nullable().or(z.literal("")),
  itemName: z.string().min(1, "Item name is required"),
  quantity: z.coerce.number().min(0).default(0),
  unitId: z.string().uuid().optional().nullable().or(z.literal("")),
  taxableAmount: z.coerce.number().positive("Taxable amount must be greater than zero"),
  gstRate: z.coerce.number().min(0).default(5.0),
});

export type CreditNoteLineInput = z.infer<typeof creditNoteLineSchema>;

export const creditNoteSchema = z.object({
  invoiceId: z.string().uuid("Please select an original invoice"),
  reason: z.string().min(3, "Please provide a valid reason for the credit note").max(500),
  lines: z.array(creditNoteLineSchema).min(1, "Credit note must include at least one adjustment line"),
});

export type CreditNoteInput = z.infer<typeof creditNoteSchema>;

// ============================================================================
// 4. CUSTOMER CREDIT MANAGEMENT SCHEMA
// ============================================================================

export const customerCreditLimitUpdateSchema = z.object({
  customerId: z.string().uuid("Invalid customer ID"),
  newCreditLimit: z.coerce.number().min(0, "Credit limit cannot be negative"),
  paymentTermsDays: z.coerce.number().int().min(0, "Payment terms cannot be negative"),
  reason: z.string().min(5, "Please provide a reason for the credit limit alteration").max(500),
});

export type CustomerCreditLimitUpdateInput = z.infer<typeof customerCreditLimitUpdateSchema>;
