import React from "react";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export default function InvoicesPage() {
  return (
    <ModulePlaceholder
      category="Finance & Accounts"
      moduleName="GST Tax Invoices & Credit Notes"
      description="Immutable GST invoicing for B2B distributors and retail outlets with tax split calculation."
      sampleMetrics={[
        { label: "Billed This Month", value: "₹42,80,000" },
        { label: "CGST + SGST Split", value: "₹5,13,600" },
        { label: "Overdue Invoices", value: "5 Invoices" },
      ]}
      features={[
        "Automatic CGST / SGST split for intra-state (Tamil Nadu) vs IGST for inter-state supply",
        "HSN code tax rate snapshotting: historic invoices never alter if tax slabs change in future",
        "Credit note and debit note creation linked to original invoice lines",
        "Restricted modification: Invoices are immutable once posted; accessible by Owner & Accountant",
      ]}
      actionLabel="Generate GST Invoice"
    />
  );
}
