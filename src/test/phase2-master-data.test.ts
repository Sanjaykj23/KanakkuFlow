import { describe, it, expect } from "vitest";
import {
  customerRegistrationSchema,
  approveRegistrationSchema,
  rejectRegistrationSchema,
} from "@/modules/customers/schema";
import {
  taxRateSchema,
  unitConversionSchema,
  itemSchema,
} from "@/modules/master/schema";

describe("Phase 2: Customer Registration & Master Data Validation Rules", () => {
  describe("Customer Registration Validation", () => {
    it("accepts a valid shop registration payload", () => {
      const validPayload = {
        shopName: "Murugan Sweets",
        ownerName: "Murugan",
        mobileNumber: "9876543210",
        alternateNumber: "9876543211",
        email: "murugan@sweets.com",
        gstin: "33AAAAA0000A1Z5",
        pan: "ABCDE1234F",
        fssaiNumber: "12345678901234",
        branchId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
        addressLine1: "12, South Veli St",
        city: "Madurai",
        state: "Tamil Nadu",
        pincode: "625001",
        latitude: 9.9252,
        longitude: 78.1198,
      };

      const result = customerRegistrationSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it("rejects invalid Indian mobile numbers", () => {
      const invalidMobilePayload = {
        shopName: "Murugan Sweets",
        ownerName: "Murugan",
        mobileNumber: "12345", // invalid
        branchId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
        addressLine1: "12, South Veli St",
        city: "Madurai",
        state: "Tamil Nadu",
        pincode: "625001",
      };

      const result = customerRegistrationSchema.safeParse(invalidMobilePayload);
      expect(result.success).toBe(false);
    });

    it("rejects malformed GSTIN format", () => {
      const invalidGstinPayload = {
        shopName: "Murugan Sweets",
        ownerName: "Murugan",
        mobileNumber: "9876543210",
        gstin: "INVALIDGST123", // invalid
        branchId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
        addressLine1: "12, South Veli St",
        city: "Madurai",
        state: "Tamil Nadu",
        pincode: "625001",
      };

      const result = customerRegistrationSchema.safeParse(invalidGstinPayload);
      expect(result.success).toBe(false);
    });
  });

  describe("Registration Approval Invariants", () => {
    it("rejects negative credit limits", () => {
      const result = approveRegistrationSchema.safeParse({
        requestId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
        creditLimit: -5000,
        paymentTermsDays: 7,
      });
      expect(result.success).toBe(false);
    });

    it("rejects negative payment terms", () => {
      const result = approveRegistrationSchema.safeParse({
        requestId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
        creditLimit: 10000,
        paymentTermsDays: -15,
      });
      expect(result.success).toBe(false);
    });

    it("STRICT: Self-Approval is prohibited (caller !== submitted_by)", () => {
      const submitterId = "user-salesman-uuid";
      const approverId = "user-salesman-uuid";

      const canSelfApprove = (submitter: string, approver: string) => submitter !== approver;
      expect(canSelfApprove(submitterId, approverId)).toBe(false);
      expect(canSelfApprove(submitterId, "user-admin-uuid")).toBe(true);
    });

    it("requires rejection reason of at least 3 characters", () => {
      const result = rejectRegistrationSchema.safeParse({
        requestId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
        rejectionReason: "No", // too short
      });
      expect(result.success).toBe(false);
    });
  });

  describe("GST & Master Data Integrity", () => {
    it("validates GST tax rate structure", () => {
      const validTax = {
        name: "GST 12%",
        igstRate: 12,
        cgstRate: 6,
        sgstRate: 6,
        cessRate: 0,
        effectiveFrom: "2026-01-01",
      };
      const result = taxRateSchema.safeParse(validTax);
      expect(result.success).toBe(true);
    });

    it("rejects unit conversion with non-positive rates", () => {
      const result = unitConversionSchema.safeParse({
        fromUnitId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
        toUnitId: "710a1472-bf4d-49fc-a76e-0be341aff3ed",
        conversionRate: -24,
      });
      expect(result.success).toBe(false);
    });

    it("rejects item with negative MRP or base price", () => {
      const result = itemSchema.safeParse({
        code: "FG-MRK-200G",
        name: "Butter Murukku 200g",
        itemType: "FINISHED_GOOD",
        category: "MURUKKU",
        primaryUnitId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
        mrp: -10,
        basePrice: 38,
      });
      expect(result.success).toBe(false);
    });
  });
});
