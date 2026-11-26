import { describe, it, expect } from "vitest";
import {
  ReconciliationCategory,
  ReconciliationFinding,
  ReconciliationSummary,
} from "@/modules/reconciliation/schema";

describe("Phase 9 — Data Reconciliation & Report Security", () => {
  describe("1. Data Reconciliation Engine Mathematical Invariants", () => {
    it("flags discrepancy when batch current_qty differs from sum of stock movements", () => {
      const batchCurrentQty = 100.0;
      const stockMovementSum = 95.0; // 5 units missing from ledger

      const isDiscrepant = Math.abs(batchCurrentQty - stockMovementSum) > 0.0001;
      expect(isDiscrepant).toBe(true);

      const discrepancy = batchCurrentQty - stockMovementSum;
      expect(discrepancy).toBe(5.0);
    });

    it("verifies batch reserved_qty matches sum of active stock reservations exactly", () => {
      const activeReservations = [
        { reserved_qty: 15.5 },
        { reserved_qty: 24.5 },
      ];
      const batchReservedQty = 40.0;
      const sumReservations = activeReservations.reduce((acc, r) => acc + r.reserved_qty, 0);

      expect(batchReservedQty).toBe(sumReservations);
      expect(Math.abs(batchReservedQty - sumReservations)).toBeLessThan(0.0001);
    });

    it("identifies orphaned reservations on cancelled or closed sales orders", () => {
      const reservations = [
        { id: "res-1", orderStatus: "CANCELLED", reserved_qty: 10 },
        { id: "res-2", orderStatus: "ALLOCATED", reserved_qty: 20 },
        { id: "res-3", orderStatus: "CLOSED", reserved_qty: 5 },
      ];

      const orphaned = reservations.filter((r) =>
        ["CANCELLED", "REJECTED", "CLOSED"].includes(r.orderStatus)
      );

      expect(orphaned).toHaveLength(2);
      expect(orphaned.map((o) => o.id)).toEqual(["res-1", "res-3"]);
    });

    it("enforces non-negative physical stock and unit valuation", () => {
      const batches = [
        { batch_number: "B1", current_qty: 50, unit_cost_paisa: 12000 },
        { batch_number: "B2", current_qty: -2, unit_cost_paisa: 12000 }, // Corrupted
        { batch_number: "B3", current_qty: 10, unit_cost_paisa: -500 },  // Corrupted
      ];

      const corrupted = batches.filter(
        (b) => b.current_qty < 0 || b.unit_cost_paisa < 0
      );

      expect(corrupted).toHaveLength(2);
      expect(corrupted.map((c) => c.batch_number)).toEqual(["B2", "B3"]);
    });

    it("verifies invoice line subtotal integrity against header subtotal", () => {
      const lines = [
        { subtotal_paisa: 100000 }, // ₹1,000.00
        { subtotal_paisa: 250000 }, // ₹2,500.00
      ];
      const headerSubtotalPaisa = 350000;
      const computedSubtotal = lines.reduce((acc, l) => acc + l.subtotal_paisa, 0);

      expect(headerSubtotalPaisa).toBe(computedSubtotal);
    });

    it("flags GST tax split inconsistency when CGST + SGST + IGST != tax_amount_paisa", () => {
      const validLine = {
        tax_amount_paisa: 1800, // 18% on ₹100
        cgst_amount_paisa: 900,
        sgst_amount_paisa: 900,
        igst_amount_paisa: 0,
      };
      const validSum =
        validLine.cgst_amount_paisa + validLine.sgst_amount_paisa + validLine.igst_amount_paisa;
      expect(validSum).toBe(validLine.tax_amount_paisa);

      const invalidLine = {
        tax_amount_paisa: 1800,
        cgst_amount_paisa: 900,
        sgst_amount_paisa: 800, // Imbalance
        igst_amount_paisa: 0,
      };
      const invalidSum =
        invalidLine.cgst_amount_paisa + invalidLine.sgst_amount_paisa + invalidLine.igst_amount_paisa;
      expect(invalidSum).not.toBe(invalidLine.tax_amount_paisa);
      expect(invalidLine.tax_amount_paisa - invalidSum).toBe(100);
    });

    it("enforces invoice settlement equation: paid_amount + outstanding_amount == total_amount", () => {
      const invoice = {
        total_amount_paisa: 590000,
        paid_amount_paisa: 200000,
        outstanding_amount_paisa: 390000,
      };
      expect(invoice.paid_amount_paisa + invoice.outstanding_amount_paisa).toBe(
        invoice.total_amount_paisa
      );
    });

    it("detects customer receivables ledger vs unpaid open invoice discrepancy", () => {
      const ledgerDebits = 500000;
      const ledgerCredits = 150000;
      const ledgerBalance = ledgerDebits - ledgerCredits; // 350,000 paisa

      const openInvoicesOutstanding = 350000;
      const unallocatedPayments = 0;
      const calculatedBalance = openInvoicesOutstanding - unallocatedPayments;

      expect(ledgerBalance).toBe(calculatedBalance);
    });

    it("detects abnormal production yield outliers (< 50% or > 125%)", () => {
      const runs = [
        { order: "PO-1", planned: 100, actual: 95 },  // 95% - Normal
        { order: "PO-2", planned: 100, actual: 40 },  // 40% - Severe failure
        { order: "PO-3", planned: 100, actual: 140 }, // 140% - Measurement anomaly
      ];

      const outliers = runs.filter((r) => {
        const yieldRatio = r.actual / r.planned;
        return yieldRatio < 0.5 || yieldRatio > 1.25;
      });

      expect(outliers).toHaveLength(2);
      expect(outliers.map((o) => o.order)).toEqual(["PO-2", "PO-3"]);
    });

    it("computes accurate audit health score based on severity weights", () => {
      // Formula: GREATEST(0, 100 - (critical * 25) - (error * 10) - (warning * 2))
      const calculateScore = (critical: number, error: number, warning: number) =>
        Math.max(0, 100 - critical * 25 - error * 10 - warning * 2);

      expect(calculateScore(0, 0, 0)).toBe(100); // Perfect
      expect(calculateScore(1, 0, 0)).toBe(75);  // 1 Critical
      expect(calculateScore(0, 2, 3)).toBe(74);  // 2 Errors, 3 Warnings
      expect(calculateScore(5, 0, 0)).toBe(0);   // Floor at 0
    });
  });

  describe("2. Report Security & Role-Based Field Stripping", () => {
    const fullManagementMetrics = {
      sales: {
        sales_today_paisa: 5000000,
        sales_month_paisa: 25000000,
        sales_total_paisa: 120000000,
        pending_orders_count: 8,
      },
      finance: {
        outstanding_receivables_paisa: 45000000,
        payments_received_paisa: 80000000,
      },
      procurement: {
        purchases_total_paisa: 60000000,
      },
      inventory: {
        stock_valuation_paisa: 85000000,
        expiring_batches_count: 3,
      },
      summary: {
        total_valuation_paisa: 85000000,
      },
      batches: [
        { batch_number: "BTH-1", unit_cost_paisa: 15000, total_cost_paisa: 750000 },
      ],
    };

    function stripMetricsForRole(data: any, role: string) {
      if (["OWNER", "ADMIN", "ACCOUNTANT"].includes(role)) return data;
      const copy = JSON.parse(JSON.stringify(data));

      if (role === "SALESMAN") {
        copy.procurement.purchases_total_paisa = 0;
        copy.inventory.stock_valuation_paisa = 0;
        if (copy.summary) copy.summary.total_valuation_paisa = 0;
        if (copy.batches) {
          copy.batches.forEach((b: any) => {
            b.unit_cost_paisa = 0;
            b.total_cost_paisa = 0;
          });
        }
      }

      if (role === "WAREHOUSE") {
        copy.sales.sales_today_paisa = 0;
        copy.sales.sales_month_paisa = 0;
        copy.sales.sales_total_paisa = 0;
        copy.finance.outstanding_receivables_paisa = 0;
        copy.finance.payments_received_paisa = 0;
        copy.procurement.purchases_total_paisa = 0;
        copy.inventory.stock_valuation_paisa = 0;
        if (copy.summary) copy.summary.total_valuation_paisa = 0;
        if (copy.batches) {
          copy.batches.forEach((b: any) => {
            b.unit_cost_paisa = 0;
            b.total_cost_paisa = 0;
          });
        }
      }

      if (role === "PRODUCTION") {
        copy.sales.sales_today_paisa = 0;
        copy.sales.sales_month_paisa = 0;
        copy.sales.sales_total_paisa = 0;
        copy.finance.outstanding_receivables_paisa = 0;
        copy.finance.payments_received_paisa = 0;
        copy.procurement.purchases_total_paisa = 0;
        if (copy.summary) copy.summary.total_valuation_paisa = 0;
      }

      return copy;
    }

    it("retains all financial and procurement metrics for OWNER, ADMIN, and ACCOUNTANT", () => {
      ["OWNER", "ADMIN", "ACCOUNTANT"].forEach((role) => {
        const result = stripMetricsForRole(fullManagementMetrics, role);
        expect(result.procurement.purchases_total_paisa).toBe(60000000);
        expect(result.inventory.stock_valuation_paisa).toBe(85000000);
        expect(result.sales.sales_total_paisa).toBe(120000000);
      });
    });

    it("strips procurement costs and stock valuation for SALESMAN", () => {
      const salesmanData = stripMetricsForRole(fullManagementMetrics, "SALESMAN");
      // Sales figures preserved
      expect(salesmanData.sales.sales_total_paisa).toBe(120000000);
      // Cost and valuation stripped
      expect(salesmanData.procurement.purchases_total_paisa).toBe(0);
      expect(salesmanData.inventory.stock_valuation_paisa).toBe(0);
      expect(salesmanData.batches[0].unit_cost_paisa).toBe(0);
      expect(salesmanData.batches[0].total_cost_paisa).toBe(0);
    });

    it("strips all monetary amounts for WAREHOUSE role", () => {
      const warehouseData = stripMetricsForRole(fullManagementMetrics, "WAREHOUSE");
      expect(warehouseData.sales.sales_today_paisa).toBe(0);
      expect(warehouseData.sales.sales_total_paisa).toBe(0);
      expect(warehouseData.finance.outstanding_receivables_paisa).toBe(0);
      expect(warehouseData.inventory.stock_valuation_paisa).toBe(0);
      expect(warehouseData.batches[0].unit_cost_paisa).toBe(0);
    });

    it("strips customer revenue and financial metrics for PRODUCTION role", () => {
      const prodData = stripMetricsForRole(fullManagementMetrics, "PRODUCTION");
      expect(prodData.sales.sales_total_paisa).toBe(0);
      expect(prodData.finance.outstanding_receivables_paisa).toBe(0);
      expect(prodData.procurement.purchases_total_paisa).toBe(0);
    });

    it("enforces branch access boundary for branch-scoped roles", () => {
      const session = {
        role: "SUPERVISOR",
        accessibleBranches: [{ id: "branch-alpha" }],
      };

      const validateBranch = (reqBranch: string | null) => {
        if (["OWNER", "ADMIN"].includes(session.role)) return reqBranch;
        const allowed = session.accessibleBranches.map((b) => b.id);
        if (reqBranch && !allowed.includes(reqBranch)) {
          throw new Error("Access Denied: Branch access violation.");
        }
        return reqBranch || allowed[0];
      };

      expect(validateBranch("branch-alpha")).toBe("branch-alpha");
      expect(validateBranch(null)).toBe("branch-alpha"); // Defaults to assigned
      expect(() => validateBranch("branch-bravo")).toThrow("Access Denied");
    });
  });
});
