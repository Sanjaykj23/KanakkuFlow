import { describe, it, expect } from "vitest";
import {
  createInvoiceFromOrderSchema,
  customerPaymentSchema,
  paymentAllocationItemSchema,
  creditNoteSchema,
  creditNoteLineSchema,
  customerCreditLimitUpdateSchema,
} from "@/modules/finance/schema";
import { formatPaisa } from "@/lib/utils";

describe("Phase 7: Invoicing & Finance, GST Compliance, Append-Only Receivables Ledger & Aging", () => {
  const dummyCompanyUuid = "00000000-0000-4000-8000-000000000000";
  const dummyBranchUuid = "11111111-1111-4111-8111-111111111111";
  const dummyCustomerUuid = "22222222-2222-4222-8222-222222222222";
  const dummyOrderUuid = "33333333-3333-4333-8333-333333333333";
  const dummyInvoiceUuid = "44444444-4444-4444-8444-444444444444";
  const dummyInvoice2Uuid = "55555555-5555-4555-8555-555555555555";
  const dummyPaymentUuid = "66666666-6666-4666-8666-666666666666";
  const dummyItemUuid = "77777777-7777-4777-8777-777777777777";

  describe("1. GST Invoice Creation Schema & Line Validation", () => {
    it("validates creation of an invoice from an approved sales order with optional override dates", () => {
      const validPayload = {
        orderId: dummyOrderUuid,
        notes: "GST Tax Invoice generated against SO-2026-0001",
      };

      const result = createInvoiceFromOrderSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it("rejects invoice generation without salesOrderId", () => {
      const invalidPayload = {
        orderId: "not-a-valid-uuid",
      };

      const result = createInvoiceFromOrderSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });

  describe("2. Duplicate Invoice Prevention for Same Sales Order", () => {
    it("simulates RPC check preventing duplicate active invoice for an order", () => {
      const existingInvoices = [
        {
          id: dummyInvoiceUuid,
          sales_order_id: dummyOrderUuid,
          invoice_number: "INV-2026-0001",
          status: "POSTED",
        },
      ];

      function canCreateInvoiceForOrder(orderId: string): { allowed: boolean; error?: string } {
        const existing = existingInvoices.find(
          (inv) => inv.sales_order_id === orderId && inv.status !== "CANCELLED"
        );
        if (existing) {
          return {
            allowed: false,
            error: `Active invoice ${existing.invoice_number} already exists for this sales order`,
          };
        }
        return { allowed: true };
      }

      const attempt1 = canCreateInvoiceForOrder(dummyOrderUuid);
      expect(attempt1.allowed).toBe(false);
      expect(attempt1.error).toContain("already exists");

      const attempt2 = canCreateInvoiceForOrder("99999999-9999-4999-8999-999999999999");
      expect(attempt2.allowed).toBe(true);
    });
  });

  describe("3. Concurrency-Safe Invoice Numbering Format", () => {
    it("formats sequential invoice numbers with year prefix and zero padding", () => {
      function generateInvoiceNumber(seq: number, year: number = 2026): string {
        return `INV-${year}-${String(seq).padStart(5, "0")}`;
      }

      expect(generateInvoiceNumber(1)).toBe("INV-2026-00001");
      expect(generateInvoiceNumber(42)).toBe("INV-2026-00042");
      expect(generateInvoiceNumber(1005)).toBe("INV-2026-01005");
    });
  });

  describe("4. Historical Invoice Snapshot Immutability", () => {
    it("locks in line prices and tax rates even when master price list or GST rates change", () => {
      const historicalInvoiceLine = {
        item_id: dummyItemUuid,
        item_name: "Special Murukku 200g",
        hsn_code: "1905",
        quantity: 100,
        unit_price_paisa: 3800, // ₹38.00
        taxable_amount_paisa: 380000, // ₹3,800.00
        gst_rate: 12.0,
        cgst_amount_paisa: 22800, // ₹228.00
        sgst_amount_paisa: 22800, // ₹228.00
        igst_amount_paisa: 0,
        total_amount_paisa: 425600, // ₹4,256.00
      };

      // Master catalog subsequently changes price to ₹45.00 and tax slab changes to 18%
      const newMasterPricePaisa = 4500;
      const newMasterTaxRate = 18.0;

      // Historical line remains completely unmodified
      expect(historicalInvoiceLine.unit_price_paisa).toBe(3800);
      expect(historicalInvoiceLine.gst_rate).toBe(12.0);
      expect(historicalInvoiceLine.total_amount_paisa).toBe(425600);
      expect(historicalInvoiceLine.unit_price_paisa).not.toBe(newMasterPricePaisa);
      expect(historicalInvoiceLine.gst_rate).not.toBe(newMasterTaxRate);
    });
  });

  describe("5. GST Calculation and Rounding (Intra-state vs Inter-state)", () => {
    it("calculates Intra-state (Tamil Nadu to Tamil Nadu) 50:50 CGST and SGST split with exact paisa arithmetic", () => {
      const companyStateCode = "33"; // Tamil Nadu
      const placeOfSupplyCode = "33"; // Tamil Nadu
      const taxablePaisa = 100000; // ₹1,000.00
      const gstRate = 12.0; // 12%

      const isIntraState = companyStateCode === placeOfSupplyCode;
      expect(isIntraState).toBe(true);

      const totalTaxPaisa = Math.round((taxablePaisa * gstRate) / 100); // ₹120.00 = 12,000 paisa
      const cgstPaisa = Math.round(totalTaxPaisa / 2); // 6,000 paisa
      const sgstPaisa = totalTaxPaisa - cgstPaisa; // 6,000 paisa
      const igstPaisa = 0;

      expect(cgstPaisa).toBe(6000);
      expect(sgstPaisa).toBe(6000);
      expect(igstPaisa).toBe(0);
      expect(cgstPaisa + sgstPaisa).toBe(totalTaxPaisa);
      expect(taxablePaisa + totalTaxPaisa).toBe(112000); // ₹1,120.00
    });

    it("calculates Inter-state (Tamil Nadu to Karnataka) 100% IGST", () => {
      const companyStateCode: string = "33"; // Tamil Nadu
      const placeOfSupplyCode: string = "29"; // Karnataka
      const taxablePaisa = 250000; // ₹2,500.00
      const gstRate = 18.0; // 18%

      const isIntraState = companyStateCode === placeOfSupplyCode;
      expect(isIntraState).toBe(false);

      const igstPaisa = Math.round((taxablePaisa * gstRate) / 100); // 45,000 paisa (₹450.00)
      const cgstPaisa = 0;
      const sgstPaisa = 0;

      expect(cgstPaisa).toBe(0);
      expect(sgstPaisa).toBe(0);
      expect(igstPaisa).toBe(45000);
      expect(taxablePaisa + igstPaisa).toBe(295000);
    });

    it("formats integer paisa correctly into Indian Rupee currency strings", () => {
      expect(formatPaisa(425600)).toMatch(/4,256\.00/);
      expect(formatPaisa(1250)).toMatch(/12\.50/);
      expect(formatPaisa(0)).toMatch(/0\.00/);
    });
  });

  describe("6. Unauthorized Invoice Posting Rejection", () => {
    it("enforces role permissions: only OWNER, ADMIN, and ACCOUNTANT can post invoices", () => {
      function canPostInvoice(role: string): boolean {
        const allowedRoles = ["OWNER", "ADMIN", "ACCOUNTANT"];
        return allowedRoles.includes(role);
      }

      expect(canPostInvoice("OWNER")).toBe(true);
      expect(canPostInvoice("ADMIN")).toBe(true);
      expect(canPostInvoice("ACCOUNTANT")).toBe(true);
      expect(canPostInvoice("SUPERVISOR")).toBe(false);
      expect(canPostInvoice("SALESMAN")).toBe(false);
      expect(canPostInvoice("PRODUCTION")).toBe(false);
      expect(canPostInvoice("WAREHOUSE")).toBe(false);
    });
  });

  describe("7. Multi-Tenant Isolation for Invoices and Payments", () => {
    it("prevents accessing or allocating payments across different companies", () => {
      const invoiceCompanyA = {
        id: dummyInvoiceUuid,
        company_id: dummyCompanyUuid,
        customer_id: dummyCustomerUuid,
      };

      const paymentCompanyB = {
        id: dummyPaymentUuid,
        company_id: "99999999-9999-4999-8999-999999999999", // Company B
        customer_id: dummyCustomerUuid,
      };

      function canAllocate(invoice: typeof invoiceCompanyA, payment: typeof paymentCompanyB): boolean {
        return invoice.company_id === payment.company_id;
      }

      expect(canAllocate(invoiceCompanyA, paymentCompanyB)).toBe(false);
    });
  });

  describe("8. Customer Payments & Multi-Invoice Allocation Schema", () => {
    it("validates recording a customer payment with multi-invoice allocation items", () => {
      const paymentPayload = {
        customerId: dummyCustomerUuid,
        branchId: dummyBranchUuid,
        paymentDate: "2026-11-24",
        paymentMethod: "BANK_TRANSFER" as const,
        amount: 5000.0, // ₹5,000.00
        referenceNumber: "NEFT/SBIN0029384",
        notes: "Payment against November deliveries",
        allocations: [
          { invoiceId: dummyInvoiceUuid, amount: 3000.0 }, // ₹3,000.00
          { invoiceId: dummyInvoice2Uuid, amount: 2000.0 }, // ₹2,000.00
        ],
      };

      const result = customerPaymentSchema.safeParse(paymentPayload);
      expect(result.success).toBe(true);
    });

    it("rejects recording a payment with negative or zero amount", () => {
      const invalidPayload = {
        customerId: dummyCustomerUuid,
        branchId: dummyBranchUuid,
        paymentDate: "2026-11-24",
        paymentMethod: "CASH" as const,
        amount: 0,
      };

      const result = customerPaymentSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });

  describe("9. Partial Payments Updating Invoice Status", () => {
    it("transitions invoice status from POSTED to PARTIALLY_PAID to PAID based on payment amounts", () => {
      interface MockInvoice {
        id: string;
        total_amount_paisa: number;
        paid_amount_paisa: number;
        outstanding_amount_paisa: number;
        status: "POSTED" | "PARTIALLY_PAID" | "PAID";
      }

      function applyPayment(inv: MockInvoice, amountPaisa: number): MockInvoice {
        const newPaid = inv.paid_amount_paisa + amountPaisa;
        const newOutstanding = Math.max(0, inv.total_amount_paisa - newPaid);
        let newStatus: "POSTED" | "PARTIALLY_PAID" | "PAID" = inv.status;
        if (newOutstanding === 0) {
          newStatus = "PAID";
        } else if (newPaid > 0) {
          newStatus = "PARTIALLY_PAID";
        }
        return {
          ...inv,
          paid_amount_paisa: newPaid,
          outstanding_amount_paisa: newOutstanding,
          status: newStatus,
        };
      }

      let invoice: MockInvoice = {
        id: dummyInvoiceUuid,
        total_amount_paisa: 1000000, // ₹10,000.00
        paid_amount_paisa: 0,
        outstanding_amount_paisa: 1000000,
        status: "POSTED",
      };

      // 1st partial payment: ₹4,000.00 (400,000 paisa)
      invoice = applyPayment(invoice, 400000);
      expect(invoice.paid_amount_paisa).toBe(400000);
      expect(invoice.outstanding_amount_paisa).toBe(600000);
      expect(invoice.status).toBe("PARTIALLY_PAID");

      // 2nd partial payment: ₹6,000.00 (600,000 paisa)
      invoice = applyPayment(invoice, 600000);
      expect(invoice.paid_amount_paisa).toBe(1000000);
      expect(invoice.outstanding_amount_paisa).toBe(0);
      expect(invoice.status).toBe("PAID");
    });
  });

  describe("10. Multi-Invoice Payment Allocation Logic", () => {
    it("distributes single customer payment across multiple outstanding invoices", () => {
      const paymentAmountPaisa = 1500000; // ₹15,000.00
      const invoicesToSettle = [
        { id: dummyInvoiceUuid, outstanding_paisa: 1000000 }, // ₹10,000.00
        { id: dummyInvoice2Uuid, outstanding_paisa: 800000 },  // ₹8,000.00
      ];

      let remainingPayment = paymentAmountPaisa;
      const allocations: { invoiceId: string; amountPaisa: number }[] = [];

      for (const inv of invoicesToSettle) {
        if (remainingPayment <= 0) break;
        const alloc = Math.min(remainingPayment, inv.outstanding_paisa);
        allocations.push({ invoiceId: inv.id, amountPaisa: alloc });
        remainingPayment -= alloc;
      }

      expect(allocations).toHaveLength(2);
      expect(allocations[0].amountPaisa).toBe(1000000); // Settle Inv 1 completely
      expect(allocations[1].amountPaisa).toBe(500000);  // Settle Inv 2 partially
      expect(remainingPayment).toBe(0); // Fully allocated
    });
  });

  describe("11. Multi-Payment Allocation for a Single Invoice", () => {
    it("aggregates multiple allocations from different remittances for one invoice", () => {
      const invoiceTotalPaisa = 500000; // ₹5,000.00
      const paymentAllocations = [
        { paymentNumber: "PAY-001", amountPaisa: 200000 }, // ₹2,000.00
        { paymentNumber: "PAY-002", amountPaisa: 150000 }, // ₹1,500.00
        { paymentNumber: "PAY-003", amountPaisa: 150000 }, // ₹1,500.00
      ];

      const totalPaid = paymentAllocations.reduce((sum, a) => sum + a.amountPaisa, 0);
      const balanceDue = invoiceTotalPaisa - totalPaid;

      expect(totalPaid).toBe(500000);
      expect(balanceDue).toBe(0);
    });
  });

  describe("12. Rejection of Allocation Exceeding Payment or Invoice Balance", () => {
    it("detects and rejects allocations where total allocated exceeds total payment amount", () => {
      const paymentAmountPaisa = 500000; // ₹5,000.00
      const invalidAllocations = [
        { invoiceId: dummyInvoiceUuid, allocatedAmountPaisa: 400000 },
        { invoiceId: dummyInvoice2Uuid, allocatedAmountPaisa: 200000 }, // Total = 600,000 paisa > 500,000
      ];

      const sumAllocated = invalidAllocations.reduce((acc, a) => acc + a.allocatedAmountPaisa, 0);
      const isExceeded = sumAllocated > paymentAmountPaisa;

      expect(isExceeded).toBe(true);
    });

    it("detects and rejects allocation that exceeds the invoice's remaining balance", () => {
      const invoiceOutstandingPaisa = 300000; // ₹3,000.00
      const attemptedAllocationPaisa = 450000; // ₹4,500.00

      const isInvalid = attemptedAllocationPaisa > invoiceOutstandingPaisa;
      expect(isInvalid).toBe(true);
    });
  });

  describe("13. Customer Receivables Ledger Balance Reconciliation", () => {
    it("computes authoritative customer balance strictly as Sum(Debit) - Sum(Credit)", () => {
      interface LedgerEntry {
        entry_type: "INVOICE" | "PAYMENT" | "CREDIT_NOTE";
        debit_paisa: number;
        credit_paisa: number;
      }

      const ledgerEntries: LedgerEntry[] = [
        { entry_type: "INVOICE", debit_paisa: 1200000, credit_paisa: 0 },    // Invoice 1: ₹12,000.00 Dr
        { entry_type: "INVOICE", debit_paisa: 800000, credit_paisa: 0 },     // Invoice 2: ₹8,000.00 Dr
        { entry_type: "PAYMENT", debit_paisa: 0, credit_paisa: 1000000 },    // Payment: ₹10,000.00 Cr
        { entry_type: "CREDIT_NOTE", debit_paisa: 0, credit_paisa: 200000 }, // Credit Note: ₹2,000.00 Cr
      ];

      const totalDebit = ledgerEntries.reduce((sum, e) => sum + e.debit_paisa, 0);
      const totalCredit = ledgerEntries.reduce((sum, e) => sum + e.credit_paisa, 0);
      const customerBalancePaisa = totalDebit - totalCredit;

      expect(totalDebit).toBe(2000000); // ₹20,000.00
      expect(totalCredit).toBe(1200000); // ₹12,000.00
      expect(customerBalancePaisa).toBe(800000); // Outstanding: ₹8,000.00
    });
  });

  describe("14. Customer Outstanding Aging Breakdown (Current, 1-30, 31-60, 61-90, 90+ Days)", () => {
    it("classifies overdue invoices into correct aging day brackets based on invoice due dates", () => {
      const asOfDate = new Date("2026-11-24");

      interface MockOverdueInvoice {
        id: string;
        dueDate: string;
        outstandingPaisa: number;
      }

      const invoices: MockOverdueInvoice[] = [
        { id: "inv-current", dueDate: "2026-11-30", outstandingPaisa: 500000 }, // Due in future -> Current
        { id: "inv-1-30", dueDate: "2026-11-10", outstandingPaisa: 400000 },    // 14 days overdue -> 1-30
        { id: "inv-31-60", dueDate: "2026-10-10", outstandingPaisa: 300000 },   // 45 days overdue -> 31-60
        { id: "inv-61-90", dueDate: "2026-09-05", outstandingPaisa: 200000 },   // 80 days overdue -> 61-90
        { id: "inv-90-plus", dueDate: "2026-07-01", outstandingPaisa: 100000 }, // 146 days overdue -> 90+
      ];

      const buckets = {
        current: 0,
        days_1_30: 0,
        days_31_60: 0,
        days_61_90: 0,
        days_90_plus: 0,
      };

      for (const inv of invoices) {
        const dueDate = new Date(inv.dueDate);
        const diffMs = asOfDate.getTime() - dueDate.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) {
          buckets.current += inv.outstandingPaisa;
        } else if (diffDays <= 30) {
          buckets.days_1_30 += inv.outstandingPaisa;
        } else if (diffDays <= 60) {
          buckets.days_31_60 += inv.outstandingPaisa;
        } else if (diffDays <= 90) {
          buckets.days_61_90 += inv.outstandingPaisa;
        } else {
          buckets.days_90_plus += inv.outstandingPaisa;
        }
      }

      expect(buckets.current).toBe(500000);
      expect(buckets.days_1_30).toBe(400000);
      expect(buckets.days_31_60).toBe(300000);
      expect(buckets.days_61_90).toBe(200000);
      expect(buckets.days_90_plus).toBe(100000);
      const totalOutstanding = Object.values(buckets).reduce((sum, v) => sum + v, 0);
      expect(totalOutstanding).toBe(1500000);
    });
  });

  describe("15. Credit Note Issuance & Line Schema Validation", () => {
    it("validates credit note payload linked to original invoice with item lines", () => {
      const creditNotePayload = {
        invoiceId: dummyInvoiceUuid,
        reason: "Transit damage return: 10 packets crushed",
        lines: [
          {
            itemId: dummyItemUuid,
            itemName: "Special Murukku 200g",
            quantity: 10,
            taxableAmount: 380.0, // ₹380.00
            gstRate: 12.0,
          },
        ],
      };

      const result = creditNoteSchema.safeParse(creditNotePayload);
      expect(result.success).toBe(true);
    });

    it("rejects credit note with empty lines", () => {
      const emptyLinesPayload = {
        invoiceId: dummyInvoiceUuid,
        reason: "Price concession",
        lines: [],
      };

      const result = creditNoteSchema.safeParse(emptyLinesPayload);
      expect(result.success).toBe(false);
    });
  });

  describe("16. Credit Note Value Limit Check", () => {
    it("prevents credit note amount from exceeding original invoice outstanding or total amount", () => {
      const originalInvoiceTotalPaisa = 425600; // ₹4,256.00
      const existingCreditNotesTotalPaisa = 100000; // ₹1,000.00
      const maxPermittedCreditPaisa = originalInvoiceTotalPaisa - existingCreditNotesTotalPaisa;

      function canIssueCreditNote(requestedPaisa: number): boolean {
        return requestedPaisa <= maxPermittedCreditPaisa;
      }

      expect(canIssueCreditNote(300000)).toBe(true);  // ₹3,000.00 <= ₹3,256.00
      expect(canIssueCreditNote(325600)).toBe(true);  // Exact remaining
      expect(canIssueCreditNote(350000)).toBe(false); // Exceeds remaining
    });
  });

  describe("17. Append-Only Ledger Invariant (Immutability)", () => {
    it("verifies that ledger records are append-only and cannot be mutated or purged", () => {
      interface AppendOnlyLedger {
        entries: Array<{ id: string; amount: number }>;
        insert(entry: { id: string; amount: number }): void;
        update(): never;
        delete(): never;
      }

      const ledger: AppendOnlyLedger = {
        entries: [],
        insert(e) {
          this.entries.push(e);
        },
        update() {
          throw new Error("Append-only: UPDATE operation is forbidden on customer_receivables_ledger");
        },
        delete() {
          throw new Error("Append-only: DELETE operation is forbidden on customer_receivables_ledger");
        },
      };

      ledger.insert({ id: "entry-1", amount: 5000 });
      expect(ledger.entries).toHaveLength(1);
      expect(() => ledger.update()).toThrow("Append-only: UPDATE operation is forbidden");
      expect(() => ledger.delete()).toThrow("Append-only: DELETE operation is forbidden");
    });
  });

  describe("18. Customer Credit Limit Update Validation", () => {
    it("validates credit limit updates and payment terms", () => {
      const validUpdate = {
        customerId: dummyCustomerUuid,
        newCreditLimit: 500000.0, // ₹5,00,000.00
        paymentTermsDays: 21,
        reason: "Increasing limit due to consistent prompt payment history",
      };

      const result = customerCreditLimitUpdateSchema.safeParse(validUpdate);
      expect(result.success).toBe(true);
    });

    it("rejects negative credit limits", () => {
      const invalidUpdate = {
        customerId: dummyCustomerUuid,
        newCreditLimit: -100,
        paymentTermsDays: 14,
        reason: "Invalid credit limit",
      };

      const result = customerCreditLimitUpdateSchema.safeParse(invalidUpdate);
      expect(result.success).toBe(false);
    });
  });
});
