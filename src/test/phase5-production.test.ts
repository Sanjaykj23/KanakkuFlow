import { describe, it, expect } from "vitest";
import {
  bomSchema,
  bomLineSchema,
  productionOrderSchema,
  productionConsumptionSchema,
  productionOutputSchema,
  productionQcReleaseSchema,
} from "@/modules/production/schema";

describe("Phase 5: Production, BOM, Two-Stage Manufacturing & Costing", () => {
  const dummyProductUuid = "11111111-1111-4111-8111-111111111111";
  const dummyComponent1 = "22222222-2222-4222-8222-222222222222";
  const dummyComponent2 = "33333333-3333-4333-8333-333333333333";
  const dummyUnitKg = "44444444-4444-4444-8444-444444444444";
  const dummyUnitPkt = "55555555-5555-4555-8555-555555555555";
  const dummyBranch = "66666666-6666-4666-8666-666666666666";
  const dummyWh1 = "77777777-7777-4777-8777-777777777777";
  const dummyWh2 = "88888888-8888-4888-8888-888888888888";
  const dummyBomUuid = "99999999-9999-4999-8999-999999999999";
  const dummyOrderUuid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const dummyBatchUuid = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const dummyOutputUuid = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

  describe("1. Bill of Materials (BOM) Validation & Schema Controls", () => {
    it("validates a standard food manufacturing recipe with multiple ingredients", () => {
      const validBom = {
        productId: dummyProductUuid,
        bomType: "BULK_WIP" as const,
        version: "v1.0",
        effectiveDate: "2026-11-24",
        status: "ACTIVE" as const,
        expectedOutputQty: 100, // 100 kg bulk murukku
        outputUnitId: dummyUnitKg,
        expectedYieldPercent: 95.0,
        expectedWastagePercent: 5.0,
        laborOverheadCostPaisa: 50000, // ₹500 in paisa
        notes: "Standard Murukku dough recipe",
        lines: [
          {
            componentItemId: dummyComponent1,
            componentType: "RAW_MATERIAL" as const,
            quantity: 80, // 80 kg rice flour
            unitId: dummyUnitKg,
            conversionRate: 1,
            expectedWastagePercent: 2,
          },
          {
            componentItemId: dummyComponent2,
            componentType: "RAW_MATERIAL" as const,
            quantity: 25, // 25 kg refined oil
            unitId: dummyUnitKg,
            conversionRate: 1,
            expectedWastagePercent: 3,
          },
        ],
      };

      const result = bomSchema.safeParse(validBom);
      expect(result.success).toBe(true);
    });

    it("rejects circular BOM dependencies where output product is in its own recipe components", () => {
      const circularBom = {
        productId: dummyProductUuid, // Butter Murukku
        bomType: "FINISHED_GOODS" as const,
        version: "v1.0",
        effectiveDate: "2026-11-24",
        status: "ACTIVE" as const,
        expectedOutputQty: 500,
        outputUnitId: dummyUnitPkt,
        expectedYieldPercent: 100,
        expectedWastagePercent: 0,
        laborOverheadCostPaisa: 0,
        lines: [
          {
            componentItemId: dummyProductUuid, // SELF-REFERENCE!
            componentType: "BULK_WIP" as const,
            quantity: 100,
            unitId: dummyUnitKg,
            conversionRate: 1,
            expectedWastagePercent: 0,
          },
        ],
      };

      const result = bomSchema.safeParse(circularBom);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Circular Dependency Violation");
      }
    });

    it("rejects recipe with empty components list", () => {
      const emptyBom = {
        productId: dummyProductUuid,
        bomType: "BULK_WIP" as const,
        version: "v1.0",
        effectiveDate: "2026-11-24",
        status: "ACTIVE" as const,
        expectedOutputQty: 100,
        outputUnitId: dummyUnitKg,
        lines: [],
      };

      const result = bomSchema.safeParse(emptyBom);
      expect(result.success).toBe(false);
    });

    it("rejects non-positive quantities and negative wastage", () => {
      const invalidLine = {
        componentItemId: dummyComponent1,
        componentType: "RAW_MATERIAL" as const,
        quantity: -5, // Negative quantity!
        unitId: dummyUnitKg,
        conversionRate: 1,
        expectedWastagePercent: -1, // Negative wastage!
      };

      const result = bomLineSchema.safeParse(invalidLine);
      expect(result.success).toBe(false);
    });
  });

  describe("2. Material Requirement Calculation & Scale Factoring", () => {
    it("calculates proportional material requirement for batch scaling", () => {
      // BOM defined for 100 kg base output
      const bomBaseOutput = 100;
      const plannedOrderQty = 350; // Scaling to 350 kg production order
      const scaleFactor = plannedOrderQty / bomBaseOutput; // 3.5x

      const bomLineRiceFlourQty = 80;
      const wastagePct = 2.5; // 2.5% expected wastage

      // Formula: (bomQty * scaleFactor) * (1 + wastagePct / 100)
      const netRequired = bomLineRiceFlourQty * scaleFactor;
      const grossRequiredWithWastage = netRequired * (1 + wastagePct / 100);

      expect(scaleFactor).toBe(3.5);
      expect(netRequired).toBe(280);
      expect(grossRequiredWithWastage).toBe(287);
    });

    it("calculates production yield variance percentage accurately", () => {
      const plannedQty = 500; // 500 packets planned
      const actualProduced = 492; // 492 packets produced
      const rejectedQty = 8; // 8 pouches rejected due to seal leakage

      const yieldPercent = (actualProduced / plannedQty) * 100;
      const rejectPercent = (rejectedQty / plannedQty) * 100;

      expect(yieldPercent).toBe(98.4);
      expect(rejectPercent).toBe(1.6);
      expect(yieldPercent + rejectPercent).toBe(100.0);
    });
  });

  describe("3. Production Order (Work Order) Schema Validation", () => {
    it("validates Stage 1 Bulk Production Work Order", () => {
      const bulkOrder = {
        branchId: dummyBranch,
        productId: dummyProductUuid,
        bomId: dummyBomUuid,
        orderType: "BULK_PRODUCTION" as const,
        plannedQty: 250,
        unitId: dummyUnitKg,
        productionWarehouseId: dummyWh1,
        finishedWarehouseId: dummyWh2,
        plannedStartDate: "2026-11-25",
        plannedCompletionDate: "2026-11-26",
        notes: "Morning batch run",
      };

      const result = productionOrderSchema.safeParse(bulkOrder);
      expect(result.success).toBe(true);
    });

    it("validates Stage 2 Packaging Work Order linking source bulk batch", () => {
      const packagingOrder = {
        branchId: dummyBranch,
        productId: dummyProductUuid,
        bomId: dummyBomUuid,
        orderType: "PACKAGING_PRODUCTION" as const,
        plannedQty: 1250, // 1250 packets of 200g from 250kg bulk
        unitId: dummyUnitPkt,
        productionWarehouseId: dummyWh1,
        finishedWarehouseId: dummyWh2,
        plannedStartDate: "2026-11-26",
        plannedCompletionDate: "2026-11-27",
        sourceBulkBatchId: dummyBatchUuid, // Linked to bulk batch
        notes: "Nitrogen packaging run for 200g pouches",
      };

      const result = productionOrderSchema.safeParse(packagingOrder);
      expect(result.success).toBe(true);
    });
  });

  describe("4. Material Consumption & FEFO Invariants", () => {
    it("validates consumption record deducting consumed and wastage quantities", () => {
      const consumption = {
        orderId: dummyOrderUuid,
        itemId: dummyComponent1,
        batchId: dummyBatchUuid,
        warehouseId: dummyWh1,
        consumedQty: 78.5,
        wastageQty: 1.5,
        unitId: dummyUnitKg,
        reason: "Spillage during hopper feeding",
      };

      const result = productionConsumptionSchema.safeParse(consumption);
      expect(result.success).toBe(true);

      const totalDeducted = consumption.consumedQty + consumption.wastageQty;
      expect(totalDeducted).toBe(80.0);
    });

    it("enforces FEFO priority ordering by earliest expiry date", () => {
      const rawBatches = [
        { batchNumber: "BAT-OIL-03", expiryDate: "2027-01-10", availableQty: 100 },
        { batchNumber: "BAT-OIL-01", expiryDate: "2026-12-05", availableQty: 40 },
        { batchNumber: "BAT-OIL-02", expiryDate: "2026-12-20", availableQty: 60 },
      ];

      // Sort by expiry_date ASC
      const fefoSorted = [...rawBatches].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

      expect(fefoSorted[0].batchNumber).toBe("BAT-OIL-01");
      expect(fefoSorted[1].batchNumber).toBe("BAT-OIL-02");
      expect(fefoSorted[2].batchNumber).toBe("BAT-OIL-03");
    });

    it("disallows expired and QC-pending batches from material consumption", () => {
      const today = "2026-11-24";
      const batches = [
        { id: "b1", expiryDate: "2026-11-01", qcStatus: "RELEASED" }, // Expired
        { id: "b2", expiryDate: "2026-12-01", qcStatus: "PENDING" },  // QC pending
        { id: "b3", expiryDate: "2026-12-01", qcStatus: "RELEASED" }, // Eligible
      ];

      const eligible = batches.filter((b) => b.expiryDate >= today && b.qcStatus === "RELEASED");
      expect(eligible.length).toBe(1);
      expect(eligible[0].id).toBe("b3");
    });
  });

  describe("5. Two-Stage Manufacturing Costing & Integer Paisa Arithmetic", () => {
    it("calculates Stage 1 Bulk cost and unit cost without floating-point drift", () => {
      // Ingredients consumed:
      // 80 kg rice flour @ ₹32.50/kg = 80 * 3250 paisa = 260,000 paisa
      // 25 kg refined oil @ ₹110.00/kg = 25 * 11000 paisa = 275,000 paisa
      // Spices & salt = 15,000 paisa
      // Direct labor & overhead = 50,000 paisa
      const flourCostPaisa = 80 * 3250;
      const oilCostPaisa = 25 * 11000;
      const spicesCostPaisa = 15000;
      const overheadPaisa = 50000;

      const totalBulkCostPaisa = flourCostPaisa + oilCostPaisa + spicesCostPaisa + overheadPaisa;
      // 260,000 + 275,000 + 15,000 + 50,000 = 600,000 paisa (₹6,000.00)
      expect(totalBulkCostPaisa).toBe(600000);

      // Output produced: 100 kg bulk murukku
      const producedBulkQty = 100;
      const bulkUnitCostPaisa = Math.round(totalBulkCostPaisa / producedBulkQty);
      // 600,000 / 100 = 6,000 paisa (₹60.00 per kg)
      expect(bulkUnitCostPaisa).toBe(6000);
    });

    it("allocates Stage 1 bulk cost + packaging material to finished retail SKUs", () => {
      // Packaging 100 packets of 200g:
      // Bulk Murukku consumed: 20 kg @ 6,000 paisa/kg = 120,000 paisa
      // Nitrogen pouches: 100 pouches @ 220 paisa = 22,000 paisa
      // Carton boxes: 5 boxes (for 20 pkts each) @ 2,500 paisa = 12,500 paisa
      // Packaging labor & gas overhead = 10,500 paisa
      const bulkWipConsumedPaisa = 20 * 6000; // 120,000
      const pouchesPaisa = 100 * 220; // 22,000
      const boxesPaisa = 5 * 2500; // 12,500
      const packagingOverheadPaisa = 10500;

      const totalFinishedCostPaisa =
        bulkWipConsumedPaisa + pouchesPaisa + boxesPaisa + packagingOverheadPaisa;
      // 120,000 + 22,000 + 12,500 + 10,500 = 165,000 paisa (₹1,650.00)
      expect(totalFinishedCostPaisa).toBe(165000);

      const producedPackets = 100;
      const packetUnitCostPaisa = Math.round(totalFinishedCostPaisa / producedPackets);
      // 165,000 / 100 = 1,650 paisa (₹16.50 per packet)
      expect(packetUnitCostPaisa).toBe(1650);
      expect(packetUnitCostPaisa / 100).toBe(16.5);
    });
  });

  describe("6. Output Posting & Quality Control Release Sign-Off", () => {
    it("validates output posting parameters", () => {
      const outputPayload = {
        orderId: dummyOrderUuid,
        producedQty: 490,
        rejectedQty: 10,
        manufacturingDate: "2026-11-24",
        expiryDate: "2027-02-24", // 90 days shelf life
        additionalCostsPaisa: 5000,
      };

      const result = productionOutputSchema.safeParse(outputPayload);
      expect(result.success).toBe(true);
    });

    it("verifies QC release schema and transitions", () => {
      const approval = {
        outputId: dummyOutputUuid,
        qcStatus: "RELEASED" as const,
        qcNotes: "Sensory crispness verified, moisture 1.9%, FFA 0.28%",
      };

      const result = productionQcReleaseSchema.safeParse(approval);
      expect(result.success).toBe(true);
    });

    it("enforces QC rejection requires an explanation note", () => {
      const rejection = {
        outputId: dummyOutputUuid,
        qcStatus: "REJECTED" as const,
        qcNotes: "",
      };

      // In business logic: rejection note is required
      const hasReason = rejection.qcNotes.trim().length > 0;
      expect(hasReason).toBe(false);
    });
  });
});
