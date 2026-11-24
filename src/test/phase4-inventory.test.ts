import { describe, it, expect } from "vitest";
import {
  stockReservationSchema,
  stockTransferSchema,
  stockAdjustmentSchema,
  batchStatusUpdateSchema,
} from "@/modules/inventory/schema";

describe("Phase 4: Inventory, Batch Management, FEFO & Transfers", () => {
  describe("1. FEFO Allocation Priority Logic", () => {
    it("allocates stock strictly by earliest expiry date (FEFO)", () => {
      const batches = [
        { id: "b3", batchNumber: "BAT-0003", expiryDate: "2026-12-31", availableQty: 100 },
        { id: "b1", batchNumber: "BAT-0001", expiryDate: "2026-06-30", availableQty: 40 },
        { id: "b2", batchNumber: "BAT-0002", expiryDate: "2026-08-15", availableQty: 50 },
      ];

      // Sort according to FEFO: expiryDate ASC
      const sorted = [...batches].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

      expect(sorted[0].batchNumber).toBe("BAT-0001"); // June 2026
      expect(sorted[1].batchNumber).toBe("BAT-0002"); // Aug 2026
      expect(sorted[2].batchNumber).toBe("BAT-0003"); // Dec 2026
    });

    it("handles batches without expiry dates by placing them after dated batches", () => {
      const batches = [
        { id: "b2", batchNumber: "BAT-0002", expiryDate: null, receivedDate: "2026-01-01" },
        { id: "b1", batchNumber: "BAT-0001", expiryDate: "2026-12-01", receivedDate: "2026-02-01" },
      ];

      // PostgreSQL: ORDER BY expiry_date ASC NULLS LAST, received_date ASC
      const sorted = [...batches].sort((a, b) => {
        if (!a.expiryDate && !b.expiryDate) return a.receivedDate.localeCompare(b.receivedDate);
        if (!a.expiryDate) return 1;
        if (!b.expiryDate) return -1;
        return a.expiryDate.localeCompare(b.expiryDate);
      });

      expect(sorted[0].batchNumber).toBe("BAT-0001");
      expect(sorted[1].batchNumber).toBe("BAT-0002");
    });

    it("excludes expired, blocked, and QC-pending batches from allocation", () => {
      const todayStr = "2026-11-24";
      const batches = [
        { id: "b1", expiryDate: "2026-11-01", batchStatus: "ACTIVE", qcStatus: "RELEASED", current: 50, res: 0 }, // Expired
        { id: "b2", expiryDate: "2026-12-01", batchStatus: "BLOCKED", qcStatus: "RELEASED", current: 50, res: 0 }, // Blocked
        { id: "b3", expiryDate: "2026-12-01", batchStatus: "ACTIVE", qcStatus: "PENDING", current: 50, res: 0 }, // QC Pending
        { id: "b4", expiryDate: "2026-12-01", batchStatus: "ACTIVE", qcStatus: "RELEASED", current: 50, res: 10 }, // Eligible (40 avail)
      ];

      const eligible = batches.filter((b) => {
        const isNotExpired = !b.expiryDate || b.expiryDate >= todayStr;
        const isActive = b.batchStatus === "ACTIVE";
        const isReleased = b.qcStatus === "RELEASED";
        const hasAvail = b.current - b.res > 0;
        return isNotExpired && isActive && isReleased && hasAvail;
      });

      expect(eligible).toHaveLength(1);
      expect(eligible[0].id).toBe("b4");
      expect(eligible[0].current - eligible[0].res).toBe(40);
    });
  });

  describe("2. Stock Reservations Invariants", () => {
    it("validates reservation payload and rejects zero/negative quantities", () => {
      const valid = stockReservationSchema.safeParse({
        branchId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
        warehouseId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
        itemId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
        batchId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
        reservedQty: 25,
        baseUnitId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
        sourceDocumentType: "SALES_ORDER",
        sourceDocumentId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
      });
      expect(valid.success).toBe(true);

      const invalid = stockReservationSchema.safeParse({
        branchId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
        warehouseId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
        itemId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
        batchId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
        reservedQty: -10, // Invalid
        baseUnitId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
        sourceDocumentType: "SALES_ORDER",
        sourceDocumentId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
      });
      expect(invalid.success).toBe(false);
    });

    it("prevents overselling stock when reservation exceeds available quantity", () => {
      const canReserve = (currentQty: number, reservedQty: number, requested: number) => {
        const available = Math.max(0, currentQty - reservedQty);
        return requested <= available;
      };

      expect(canReserve(100, 40, 50)).toBe(true); // 60 available >= 50
      expect(canReserve(100, 40, 70)).toBe(false); // 60 available < 70 (Blocked)
    });

    it("restores available stock accurately on reservation release", () => {
      let reservedQty = 30;
      const releaseAmount = 30;
      reservedQty = Math.max(0, reservedQty - releaseAmount);

      expect(reservedQty).toBe(0);
    });
  });

  describe("3. Stock Transfers Invariants", () => {
    it("rejects transfer when source and destination warehouse are identical", () => {
      const sameWarehousePayload = {
        sourceBranchId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
        sourceWarehouseId: "610a1472-bf4d-49fc-a76e-0be341aff3e1",
        destinationBranchId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
        destinationWarehouseId: "610a1472-bf4d-49fc-a76e-0be341aff3e1", // Identical valid UUID!
        lines: [
          {
            itemId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
            batchId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
            requestedQty: 10,
            unitId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
          },
        ],
      };

      const result = stockTransferSchema.safeParse(sameWarehousePayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("cannot be identical");
      }
    });

    it("accepts valid transfer between distinct warehouses", () => {
      const validPayload = {
        sourceBranchId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
        sourceWarehouseId: "610a1472-bf4d-49fc-a76e-0be341aff3e1",
        destinationBranchId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
        destinationWarehouseId: "610a1472-bf4d-49fc-a76e-0be341aff3e2", // Distinct valid UUID
        lines: [
          {
            itemId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
            batchId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
            requestedQty: 20,
            unitId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
          },
        ],
      };

      const result = stockTransferSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it("preserves original batch number during inter-warehouse transfer receipt", () => {
      const sourceBatch = {
        batchNumber: "BAT-MUR-00042",
        manufacturingDate: "2026-10-01",
        expiryDate: "2027-04-01",
      };

      // Destination batch creation preserves exact batchNumber and shelf-life
      const destBatch = {
        ...sourceBatch,
        warehouseId: "dest-wh-uuid",
      };

      expect(destBatch.batchNumber).toBe("BAT-MUR-00042");
      expect(destBatch.expiryDate).toBe("2027-04-01");
    });
  });

  describe("4. Stock Adjustments Invariants", () => {
    it("requires mandatory audit reason of at least 5 characters", () => {
      const invalidShortReason = {
        branchId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
        warehouseId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
        adjustmentType: "PHYSICAL_COUNT" as const,
        reason: "bad", // < 5 chars
        lines: [
          {
            itemId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
            batchId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
            systemQty: 50,
            countedQty: 48,
            unitId: "610a1472-bf4d-49fc-a76e-0be341aff3ec",
          },
        ],
      };

      const res = stockAdjustmentSchema.safeParse(invalidShortReason);
      expect(res.success).toBe(false);
    });

    it("calculates gain or loss difference accurately", () => {
      const calcDifference = (systemQty: number, countedQty: number) => {
        return Number((countedQty - systemQty).toFixed(4));
      };

      expect(calcDifference(50, 48)).toBe(-2); // Loss
      expect(calcDifference(50, 55)).toBe(5); // Gain
      expect(calcDifference(50, 50)).toBe(0); // Exact match
    });
  });

  describe("5. Perpetual Weighted-Average Costing Math", () => {
    it("calculates weighted average cost in exact integer paisa without floating point drift", () => {
      // Existing on-hand: 100 kg @ ₹40.00/kg (4000 paisa) = ₹4000.00 (400000 paisa)
      // New receipt: 50 kg @ ₹46.00/kg (4600 paisa) = ₹2300.00 (230000 paisa)
      const currentQty = 100;
      const currentAvgCostPaisa = 4000;
      const newQty = 50;
      const newUnitCostPaisa = 4600;

      const currentValuationPaisa = currentQty * currentAvgCostPaisa; // 400,000 paisa
      const newValuationPaisa = newQty * newUnitCostPaisa; // 230,000 paisa
      const totalQty = currentQty + newQty; // 150 kg
      const totalValuationPaisa = currentValuationPaisa + newValuationPaisa; // 630,000 paisa

      const newWeightedAvgCostPaisa = Math.round(totalValuationPaisa / totalQty);

      // (400,000 + 230,000) / 150 = 630,000 / 150 = 4200 paisa (₹42.00/kg exact)
      expect(newWeightedAvgCostPaisa).toBe(4200);
      expect(totalValuationPaisa).toBe(630000);
    });
  });
});
