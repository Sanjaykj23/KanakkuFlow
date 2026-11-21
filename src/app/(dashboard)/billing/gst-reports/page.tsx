import React from "react";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export default function GSTReportsPage() {
  return (
    <ModulePlaceholder
      category="Finance & Accounts"
      moduleName="GST Returns & Statutory Reports"
      description="Ready-to-file GSTR-1, GSTR-3B summaries, HSN summaries, and tax liability ledgers."
      sampleMetrics={[
        { label: "B2B Sales (4A)", value: "₹38,20,000" },
        { label: "B2C Sales (7)", value: "₹4,60,000" },
        { label: "Total Tax Liability", value: "₹5,13,600" },
      ]}
      features={[
        "Table 4A: B2B taxable supply with recipient GSTIN, invoice date, and reverse charge flags",
        "Table 12: HSN-wise summary of outward supplies (quantities, UQC, total value, tax rates)",
        "One-click CSV/JSON export ready for the official GST Portal offline utility",
        "Role-locked exclusively to OWNER and ACCOUNTANT roles",
      ]}
      actionLabel="Export GSTR-1 CSV"
    />
  );
}
