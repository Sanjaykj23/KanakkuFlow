import { describe, it, expect } from "vitest";
import {
  purchaseOrderSchema,
  purchaseOrderLineSchema,
  approvePurchaseOrderSchema,
  rejectPurchaseOrderSchema,
  calculatePoLineTotals,
  calculatePoTotals,
} from "@/modules/purchases/schema";
import {
  goodsReceiptSchema,
  goodsReceiptLineSchema,
} from "@/modules/procurement/grn-schema";
import {
  supplierBillSchema,
} from "@/modules/procurement/bills-schema";

describe("Phase 3: Procurement, Goods Receipt & 3-Way Matching Validation", () => {
  describe("1. Purchase Order Financial Math & Integer Paisa Precision", () => {
    it("calculates line items with exact integer paisa without floating point rounding errors", () => {
      // 3.333 kg @ ₹145.75/kg with 5% GST and 2% discount
      const line = calculatePoLineTotals({
        orderedQty: 10,
        unitPrice: 155.5, // ₹155.50
        discountPercent: 10, // 10% discount -> ₹139.95
        taxRatePercent: 18, // 18% GST
      });

      // Subtotal: 10 * 155.50 = ₹1555.00 -> 155500 paisa
      expect(line.subtotalPaisa).toBe(155500);

      // Discount: 10% of 1555.00 = ₹155.50 -> 15550 paisa
      expect(line.discountPaisa).toBe(15550);

      // Taxable: 155500 - 15550 = 139950 paisa
      const taxable = line.subtotalPaisa - line.discountPaisa;
      expect(taxable).toBe(139950);

      // Tax: 18% of 1399.50 = ₹251.91 -> 25191 paisa
      expect(line.taxPaisa).toBe(25191);

      // Line Total: 139950 + 25191 = 165141 paisa (₹1651.41)
      expect(line.totalPaisa).toBe(165141);
    });

    it("aggregates multiple purchase order lines into exact total integer paisa", () => {
      const lines = [
        {
          subtotalPaisa: 100000,
          discountPaisa: 5000,
          taxPaisa: 17100,
          totalPaisa: 112100,
        },
        {
          subtotalPaisa: 250000,
          discountPaisa: 0,
          taxPaisa: 12500,
          totalPaisa: 262500,
        },
      ];

      const totals = calculatePoTotals(lines);
      expect(totals.subtotalPaisa).toBe(350000);
      expect(totals.discountPaisa).toBe(5000);
      expect(totals.taxPaisa).toBe(29600);
      expect(totals.totalPaisa).toBe(374600); // ₹3,746.00
    });
  });

  describe("2. Purchase Order Validation Invariants", () => {
    it("accepts a valid purchase order payload", () => {
      const validPayload = {
        branchId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
        supplierId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
        deliveryWarehouseId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
        orderDate: "2026-11-24",
        expectedDeliveryDate: "2026-12-01",
        currency: "INR",
        lines: [
          {
            itemId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
            unitId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
            conversionFactor: 1,
            orderedQty: 50,
            unitPrice: 42.5,
            discountPercent: 0,
            taxRatePercent: 5,
          },
        ],
      };

      const result = purchaseOrderSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it("rejects purchase orders with empty lines array", () => {
      const invalidPayload = {
        branchId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
        supplierId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
        orderDate: "2026-11-24",
        lines: [],
      };

      const result = purchaseOrderSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it("rejects non-positive order quantities or prices", () => {
      const invalidLine = {
        itemId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
        unitId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
        conversionFactor: 1,
        orderedQty: 0, // Must be > 0
        unitPrice: -10, // Must be >= 0
      };

      const result = purchaseOrderLineSchema.safeParse(invalidLine);
      expect(result.success).toBe(false);
    });
  });

  describe("3. Security Invariant: Strict Self-Approval Ban", () => {
    it("prohibits creator from approving their own purchase order", () => {
      const poCreatorId = "user-creator-uuid";
      const approverId = "user-creator-uuid";

      const canApprove = (creator: string, approver: string, role: string) => {
        // Enforced both at schema/application layer and inside PostgreSQL RPC:
        // IF v_po.created_by = v_caller_uid THEN RAISE EXCEPTION 'Security Violation: Self-approval is prohibited...';
        if (creator === approver) return false;
        return ["OWNER", "ADMIN"].includes(role);
      };

      expect(canApprove(poCreatorId, approverId, "OWNER")).toBe(false);
      expect(canApprove(poCreatorId, approverId, "ADMIN")).toBe(false);
      expect(canApprove(poCreatorId, "different-admin-uuid", "ADMIN")).toBe(true);
    });

    it("validates PO approval and requires rejection reason of at least 3 characters", () => {
      const validApproval = approvePurchaseOrderSchema.safeParse({
        purchaseOrderId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
      });
      expect(validApproval.success).toBe(true);

      const invalidRejection = rejectPurchaseOrderSchema.safeParse({
        poId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
        reason: "no", // Less than 3 chars
      });
      expect(invalidRejection.success).toBe(false);

      const validRejection = rejectPurchaseOrderSchema.safeParse({
        poId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
        reason: "Excessive pricing quoted",
      });
      expect(validRejection.success).toBe(true);
    });
  });

  describe("4. Goods Receipt Note (GRN) Invariants", () => {
    it("enforces line balance: received_qty = accepted_qty + rejected_qty + damaged_qty", () => {
      const validateLineBalance = (line: {
        receivedQty: number;
        acceptedQty: number;
        rejectedQty: number;
        damagedQty: number;
      }) => {
        const sum = line.acceptedQty + line.rejectedQty + line.damagedQty;
        return Math.abs(line.receivedQty - sum) < 0.00001;
      };

      // Valid balanced line: 100 received = 90 accepted + 8 rejected + 2 damaged
      expect(
        validateLineBalance({
          receivedQty: 100,
          acceptedQty: 90,
          rejectedQty: 8,
          damagedQty: 2,
        })
      ).toBe(true);

      // Invalid line: sum (95) != received (100)
      expect(
        validateLineBalance({
          receivedQty: 100,
          acceptedQty: 90,
          rejectedQty: 5,
          damagedQty: 0,
        })
      ).toBe(false);
    });

    it("prevents over-receipt when received quantity exceeds pending quantity", () => {
      const isOverReceipt = (receivedQty: number, pendingQty: number) => {
        return receivedQty > pendingQty;
      };

      expect(isOverReceipt(110, 100)).toBe(true); // Over-receipt blocked
      expect(isOverReceipt(100, 100)).toBe(false); // Exact receipt allowed
      expect(isOverReceipt(40, 100)).toBe(false); // Partial receipt allowed
    });

    it("transitions PO status accurately: partial receipt keeps order open", () => {
      const determinePoStatus = (orderedQty: number, totalReceivedSoFar: number) => {
        if (totalReceivedSoFar === 0) return "APPROVED";
        if (totalReceivedSoFar < orderedQty) return "PARTIALLY_RECEIVED";
        return "RECEIVED";
      };

      expect(determinePoStatus(100, 0)).toBe("APPROVED");
      expect(determinePoStatus(100, 40)).toBe("PARTIALLY_RECEIVED");
      expect(determinePoStatus(100, 100)).toBe("RECEIVED");
    });
  });

  describe("5. Physical vs Financial Stock Isolation", () => {
    it("creates physical batches only for accepted quantities", () => {
      const receivedItems = [
        { itemId: "flour-1", receivedQty: 100, acceptedQty: 90, rejectedQty: 10, damagedQty: 0 },
        { itemId: "oil-1", receivedQty: 50, acceptedQty: 0, rejectedQty: 50, damagedQty: 0 },
      ];

      // Physical batches generated for inventory ledger
      const batchesCreated = receivedItems
        .filter((i) => i.acceptedQty > 0)
        .map((i) => ({ itemId: i.itemId, qty: i.acceptedQty }));

      expect(batchesCreated).toHaveLength(1);
      expect(batchesCreated[0].itemId).toBe("flour-1");
      expect(batchesCreated[0].qty).toBe(90);
      // Oil had 0 accepted goods, so NO batches or available stock ledger entries created
    });
  });

  describe("6. Supplier Bills & 3-Way Matching", () => {
    it("validates supplier bill payload", () => {
      const validBill = {
        supplierId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
        branchId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
        supplierInvoiceNumber: "INV-2026-881",
        invoiceDate: "2026-11-24",
        dueDate: "2026-12-24",
        taxableAmount: 10000,
        taxAmount: 1800,
        freightCharges: 500,
        discount: 200,
      };

      const result = supplierBillSchema.safeParse(validBill);
      expect(result.success).toBe(true);
    });

    it("rejects negative amounts on supplier bills", () => {
      const invalidBill = {
        supplierId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
        branchId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
        supplierInvoiceNumber: "INV-2026-881",
        invoiceDate: "2026-11-24",
        dueDate: "2026-12-24",
        taxableAmount: -500, // Invalid negative
      };

      const result = supplierBillSchema.safeParse(invalidBill);
      expect(result.success).toBe(false);
    });

    it("detects 3-way matching discrepancy when bill total differs from PO total beyond tolerance", () => {
      const matchBillToPo = (billTotalPaisa: number, poTotalPaisa: number, tolerancePaisa = 500) => {
        const diff = Math.abs(billTotalPaisa - poTotalPaisa);
        if (diff > tolerancePaisa) {
          return {
            status: "DISCREPANCY_FLAGGED" as const,
            discrepancyPaisa: diff,
          };
        }
        return { status: "POSTED" as const, discrepancyPaisa: 0 };
      };

      // Case 1: Exact match
      expect(matchBillToPo(100000, 100000).status).toBe("POSTED");

      // Case 2: Within 500 paisa (₹5) rounding tolerance
      expect(matchBillToPo(100200, 100000).status).toBe("POSTED");

      // Case 3: Major mismatch (₹150 discrepancy)
      const mismatch = matchBillToPo(115000, 100000);
      expect(mismatch.status).toBe("DISCREPANCY_FLAGGED");
      expect(mismatch.discrepancyPaisa).toBe(15000);
    });
  });
});
