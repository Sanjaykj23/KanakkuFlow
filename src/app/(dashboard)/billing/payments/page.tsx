import React from "react";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export default function PaymentsPage() {
  return (
    <ModulePlaceholder
      category="Finance & Accounts"
      moduleName="Payments & Customer Collections"
      description="Record bank transfers (NEFT/RTGS), UPI payments, cheques, and cash collections against invoices."
      sampleMetrics={[
        { label: "Collected Today", value: "₹1,85,000" },
        { label: "Pending Cheques", value: "3 Instruments" },
        { label: "Reconciliation", value: "Idempotent" },
      ]}
      features={[
        "Partial payment allocation: apply single lump-sum payment across multiple oldest invoices",
        "Bank reference number tracking and cheque realization workflow",
        "Instant deduction from customer outstanding balance and credit limit restoration",
        "WhatsApp payment receipt notification to shop owner upon verified settlement",
      ]}
      actionLabel="Record Collection"
    />
  );
}
