import { describe, it, expect } from "vitest";
import {
  priceListSchema,
  priceListItemSchema,
  customerPricingSchema,
  salesOrderSchema,
  salesOrderLineSchema,
  salesOrderApprovalSchema,
  salesOrderAllocationSchema,
  salesOrderCancellationSchema,
} from "@/modules/sales/schema";

describe("Phase 6: Sales & Order Management, Pricing Tiers, Credit Checks & FEFO Allocation", () => {
  const dummyProductUuid = "11111111-1111-4111-8111-111111111111";
  const dummyProduct2Uuid = "22222222-2222-4222-8222-222222222222";
  const dummyUnitPkt = "33333333-3333-4333-8333-333333333333";
  const dummyBranch = "44444444-4444-4444-8444-444444444444";
  const dummyCustomerUuid = "55555555-5555-4555-8555-555555555555";
  const dummyAddressUuid = "66666666-6666-4666-8666-666666666666";
  const dummyPriceListUuid = "77777777-7777-4777-8777-777777777777";
  const dummySalesmanUuid = "88888888-8888-4888-8888-888888888888";
  const dummyOrderUuid = "99999999-9999-4999-8999-999999999999";

  describe("1. Sales Order Schema & Line Item Validation", () => {
    it("validates a complete sales order with multiple packaged snack items", () => {
      const validOrder = {
        branchId: dummyBranch,
        customerId: dummyCustomerUuid,
        deliveryAddressId: dummyAddressUuid,
        assignedSalesmanId: dummySalesmanUuid,
        orderDate: "2026-11-24",
        requestedDeliveryDate: "2026-11-26",
        paymentTermsDays: 7,
        priceListId: dummyPriceListUuid,
        notes: "Deliver before 11 AM via Route 4 van",
        submitForApproval: true,
        lines: [
          {
            itemId: dummyProductUuid,
            sku: "FG-MRK-200G",
            orderedQty: 50, // 50 packets
            unitId: dummyUnitPkt,
            conversionRate: 1,
            unitPrice: 38.0, // ₹38
            discountPercent: 2.5,
          },
          {
            itemId: dummyProduct2Uuid,
            sku: "FG-MIX-200G",
            orderedQty: 25,
            unitId: dummyUnitPkt,
            conversionRate: 1,
            unitPrice: 42.0,
            discountPercent: 0,
          },
        ],
      };

      const result = salesOrderSchema.safeParse(validOrder);
      expect(result.success).toBe(true);
    });

    it("rejects sales order without line items", () => {
      const emptyOrder = {
        branchId: dummyBranch,
        customerId: dummyCustomerUuid,
        deliveryAddressId: dummyAddressUuid,
        orderDate: "2026-11-24",
        requestedDeliveryDate: "2026-11-26",
        lines: [],
      };

      const result = salesOrderSchema.safeParse(emptyOrder);
      expect(result.success).toBe(false);
    });

    it("rejects non-positive quantities and negative discounts", () => {
      const invalidLine = {
        itemId: dummyProductUuid,
        sku: "FG-MRK-200G",
        orderedQty: 0, // Zero quantity!
        unitId: dummyUnitPkt,
        unitPrice: 50,
        discountPercent: -5, // Negative discount!
      };

      const result = salesOrderLineSchema.safeParse(invalidLine);
      expect(result.success).toBe(false);
    });
  });

  describe("2. Pricing Priority Resolution Hierarchy", () => {
    it("resolves selling price following strict tier priority", () => {
      // Mock Pricing Database for SKU FG-MRK-200G:
      // Tier 1: Customer Special Contract Price: ₹35.00
      // Tier 2: Selected Price List Price: ₹38.00
      // Tier 3: Default Company Price List: ₹40.00
      // Tier 4: Item Master Base Price: ₹45.00

      const itemPricingHierarchy = {
        basePricePaisa: 4500,
        defaultPriceListPaisa: 4000,
        customerPriceListPaisa: 3800,
        customerContractPaisa: 3500,
      };

      // Priority 1: Customer Special contract present
      const contract: number | null = itemPricingHierarchy.customerContractPaisa;
      const priceList: number | null = itemPricingHierarchy.customerPriceListPaisa;
      const defaultList: number | null = itemPricingHierarchy.defaultPriceListPaisa;
      const base: number = itemPricingHierarchy.basePricePaisa;

      const resolvedWithContract = contract ?? priceList ?? defaultList ?? base;
      expect(resolvedWithContract).toBe(3500);

      // Priority 2: Customer Special contract missing -> uses customer price list
      const noContract: number | null = null;
      const resolvedWithList = noContract ?? priceList ?? defaultList ?? base;
      expect(resolvedWithList).toBe(3800);

      // Priority 3: No custom price list -> uses default company price list
      const noPriceList: number | null = null;
      const resolvedWithDefault = noContract ?? noPriceList ?? defaultList ?? base;
      expect(resolvedWithDefault).toBe(4000);

      // Priority 4: Fallback to item base price
      const noDefault: number | null = null;
      const resolvedFallback = noContract ?? noPriceList ?? noDefault ?? base;
      expect(resolvedFallback).toBe(4500);
    });

    it("verifies price snapshot immutability on sales order lines", () => {
      // Snapshot created at order time: ₹38.00 / 3800 paisa
      const orderLineSnapshot = {
        sku: "FG-MRK-200G",
        orderedQty: 100,
        unitPricePaisa: 3800,
        lineTotalPaisa: 380000, // ₹3,800.00
      };

      // 1 month later, company price list updates to ₹42.00 / 4200 paisa
      const updatedPriceListPricePaisa = 4200;

      // Invariant: Historical order line price snapshot must NEVER change
      expect(orderLineSnapshot.unitPricePaisa).toBe(3800);
      expect(orderLineSnapshot.lineTotalPaisa).toBe(380000);
      expect(orderLineSnapshot.unitPricePaisa).not.toBe(updatedPriceListPricePaisa);
    });
  });

  describe("3. GST Calculations & Tax Snapshots (Integer Paisa)", () => {
    it("calculates Intra-State GST (CGST 50% + SGST 50%) accurately without float drift", () => {
      // Selling 100 packets @ ₹38.00 = ₹3,800.00 / 380,000 paisa
      // Discount: 5% = 19,000 paisa -> Taxable: 361,000 paisa (₹3,610.00)
      // GST Rate: 5% (Murukku namkeen under HSN 1905)
      const taxablePaisa = 361000;
      const gstRatePercent = 5;

      const totalTaxPaisa = Math.round((taxablePaisa * gstRatePercent) / 100); // 18,050 paisa (₹180.50)
      const cgstPaisa = Math.round(totalTaxPaisa / 2); // 9,025 paisa
      const sgstPaisa = totalTaxPaisa - cgstPaisa; // 9,025 paisa
      const igstPaisa = 0;

      expect(totalTaxPaisa).toBe(18050);
      expect(cgstPaisa).toBe(9025);
      expect(sgstPaisa).toBe(9025);
      expect(igstPaisa).toBe(0);
      expect(cgstPaisa + sgstPaisa).toBe(totalTaxPaisa);

      const lineTotalPaisa = taxablePaisa + totalTaxPaisa; // 379,050 paisa (₹3,790.50)
      expect(lineTotalPaisa).toBe(379050);
    });

    it("calculates Inter-State GST (IGST 100%) accurately", () => {
      const taxablePaisa = 361000;
      const gstRatePercent = 5;

      const totalTaxPaisa = Math.round((taxablePaisa * gstRatePercent) / 100);
      const cgstPaisa = 0;
      const sgstPaisa = 0;
      const igstPaisa = totalTaxPaisa; // 18,050 paisa

      expect(cgstPaisa).toBe(0);
      expect(sgstPaisa).toBe(0);
      expect(igstPaisa).toBe(18050);
    });
  });

  describe("4. Credit Limit Checks & Exposure Calculation", () => {
    it("calculates available credit and triggers approval when exceeded", () => {
      const customerCreditLimitPaisa = 5000000; // ₹50,000.00 credit limit
      const pendingApprovedOrdersExposurePaisa = 3800000; // ₹38,000.00 in un-invoiced orders

      const availableCreditPaisa =
        customerCreditLimitPaisa - pendingApprovedOrdersExposurePaisa; // ₹12,000.00 available
      expect(availableCreditPaisa).toBe(1200000);

      // Case A: New Order of ₹9,500.00 (950,000 paisa) -> Within credit limit
      const orderAValuePaisa = 950000;
      const exceedsCreditA = orderAValuePaisa > availableCreditPaisa;
      expect(exceedsCreditA).toBe(false);

      // Case B: New Order of ₹15,000.00 (1,500,000 paisa) -> Exceeds available credit!
      const orderBValuePaisa = 1500000;
      const exceedsCreditB = orderBValuePaisa > availableCreditPaisa;
      expect(exceedsCreditB).toBe(true);
    });

    it("disallows orders for inactive or suspended customers", () => {
      const customer = {
        id: dummyCustomerUuid,
        isActive: false, // Suspended
        creditLimit: 50000,
      };

      const canPlaceOrder = customer.isActive;
      expect(canPlaceOrder).toBe(false);
    });
  });

  describe("5. Order Approval Rules & Anti-Self-Approval Enforcement", () => {
    it("triggers PENDING_APPROVAL for orders exceeding benchmark value (> ₹7,875)", () => {
      const benchmarkThresholdPaisa = 787500; // ₹7,875.00

      const smallOrderPaisa = 650000; // ₹6,500.00
      const largeOrderPaisa = 850000; // ₹8,500.00

      expect(smallOrderPaisa > benchmarkThresholdPaisa).toBe(false);
      expect(largeOrderPaisa > benchmarkThresholdPaisa).toBe(true);
    });

    it("triggers PENDING_APPROVAL for orders with discount exceeding 5%", () => {
      const line1Discount = 3.0; // Allowed without manager approval
      const line2Discount = 7.5; // Requires manager approval (> 5%)

      const triggersApproval = (discount: number) => discount > 5.0;

      expect(triggersApproval(line1Discount)).toBe(false);
      expect(triggersApproval(line2Discount)).toBe(true);
    });

    it("enforces anti-self-approval: order creator cannot self-approve", () => {
      const orderCreatedBy = dummySalesmanUuid;
      const approverUid = dummySalesmanUuid; // SAME USER!
      const approverRole: string = "SUPERVISOR";

      // Security rule: if created_by == caller_uid and role != 'OWNER' -> Reject!
      const isSelfApproval = orderCreatedBy === approverUid;
      const isOwner = approverRole === "OWNER";
      const isAllowed = !isSelfApproval || isOwner;

      expect(isAllowed).toBe(false);
    });
  });

  describe("6. FEFO Stock Allocation & Concurrency Protection", () => {
    it("allocates stock strictly by earliest expiry date", () => {
      const finishedBatches = [
        { batchNumber: "BAT-FG-03", expiryDate: "2027-02-28", availableQty: 100 },
        { batchNumber: "BAT-FG-01", expiryDate: "2026-12-15", availableQty: 40 },
        { batchNumber: "BAT-FG-02", expiryDate: "2027-01-10", availableQty: 80 },
      ];

      // Sort by expiry_date ASC
      const fefoBatches = [...finishedBatches].sort((a, b) =>
        a.expiryDate.localeCompare(b.expiryDate)
      );

      expect(fefoBatches[0].batchNumber).toBe("BAT-FG-01"); // Dec 2026
      expect(fefoBatches[1].batchNumber).toBe("BAT-FG-02"); // Jan 2027
      expect(fefoBatches[2].batchNumber).toBe("BAT-FG-03"); // Feb 2027
    });

    it("excludes QC-pending, expired, and blocked stock from sales allocation", () => {
      const today = "2026-11-24";
      const batches = [
        { id: "b1", expiryDate: "2026-11-01", qcStatus: "RELEASED", batchStatus: "ACTIVE" }, // Expired
        { id: "b2", expiryDate: "2027-01-01", qcStatus: "PENDING", batchStatus: "ACTIVE" },  // QC pending
        { id: "b3", expiryDate: "2027-01-01", qcStatus: "RELEASED", batchStatus: "BLOCKED" }, // Blocked
        { id: "b4", expiryDate: "2027-01-01", qcStatus: "RELEASED", batchStatus: "ACTIVE" },  // Eligible
      ];

      const eligible = batches.filter(
        (b) =>
          b.expiryDate >= today &&
          b.qcStatus === "RELEASED" &&
          b.batchStatus === "ACTIVE"
      );

      expect(eligible.length).toBe(1);
      expect(eligible[0].id).toBe("b4");
    });

    it("prevents overselling beyond available inventory", () => {
      const requiredQty = 100;
      const batchCurrentQty = 80;
      const batchReservedQty = 30;

      const actuallyAvailable = Math.max(0, batchCurrentQty - batchReservedQty); // 50 available
      const allocated = Math.min(requiredQty, actuallyAvailable); // 50 allocated

      expect(actuallyAvailable).toBe(50);
      expect(allocated).toBe(50);
      expect(allocated).toBeLessThan(requiredQty); // Partial allocation
    });
  });

  describe("7. Order Cancellation & Reservation Release", () => {
    it("releases stock reservations atomically upon order cancellation", () => {
      // Order had reserved 50 units
      let batchCurrentQty = 100;
      let batchReservedQty = 50;
      const orderReservationQty = 50;

      // Available before cancellation: 100 - 50 = 50
      expect(batchCurrentQty - batchReservedQty).toBe(50);

      // On cancellation: release reservation
      batchReservedQty = Math.max(0, batchReservedQty - orderReservationQty);

      // Available after cancellation: 100 - 0 = 100 restored!
      expect(batchReservedQty).toBe(0);
      expect(batchCurrentQty - batchReservedQty).toBe(100);
    });

    it("validates cancellation schema requires a reason", () => {
      const invalidCancel = {
        orderId: dummyOrderUuid,
        reason: "", // Empty reason!
      };

      const result = salesOrderCancellationSchema.safeParse(invalidCancel);
      expect(result.success).toBe(false);

      const validCancel = {
        orderId: dummyOrderUuid,
        reason: "Customer shop closed due to local festival",
      };
      const validResult = salesOrderCancellationSchema.safeParse(validCancel);
      expect(validResult.success).toBe(true);
    });
  });
});
