import { z } from "zod";

export const customerRegistrationSchema = z.object({
  shopName: z.string().min(2, "Shop/Firm name must be at least 2 characters").max(255),
  ownerName: z.string().min(2, "Owner name must be at least 2 characters").max(150),
  mobileNumber: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit Indian mobile number"),
  alternateNumber: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Alternate number must be a 10-digit mobile number")
    .optional()
    .or(z.literal("")),
  email: z.string().email("Invalid email format").optional().or(z.literal("")),
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
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format (e.g., ABCDE1234F)")
    .optional()
    .or(z.literal("")),
  fssaiNumber: z
    .string()
    .regex(/^\d{14}$/, "FSSAI registration number must be 14 digits")
    .optional()
    .or(z.literal("")),
  branchId: z.string().uuid("Please select a valid branch"),
  addressLine1: z.string().min(3, "Address line 1 is required"),
  addressLine2: z.string().optional().or(z.literal("")),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  pincode: z.string().regex(/^\d{6}$/, "Pincode must be 6 digits"),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  shopPhotoUrl: z.string().url().optional().or(z.literal("")),
});

export type CustomerRegistrationInput = z.infer<typeof customerRegistrationSchema>;

export const approveRegistrationSchema = z.object({
  requestId: z.string().uuid("Invalid request ID"),
  creditLimit: z.coerce.number().min(0, "Credit limit must be 0 or greater"),
  paymentTermsDays: z.coerce.number().int().min(0, "Payment terms must be 0 or greater"),
  duplicateOverrideReason: z.string().optional().nullable(),
});

export type ApproveRegistrationInput = z.infer<typeof approveRegistrationSchema>;

export const rejectRegistrationSchema = z.object({
  requestId: z.string().uuid("Invalid request ID"),
  rejectionReason: z.string().min(3, "Rejection reason must be at least 3 characters"),
});

export type RejectRegistrationInput = z.infer<typeof rejectRegistrationSchema>;

export const resubmitRegistrationSchema = customerRegistrationSchema.extend({
  requestId: z.string().uuid("Invalid request ID"),
});

export type ResubmitRegistrationInput = z.infer<typeof resubmitRegistrationSchema>;
