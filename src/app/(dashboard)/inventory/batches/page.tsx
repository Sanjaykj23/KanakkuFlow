import React from "react";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export default function BatchesPage() {
  return (
    <ModulePlaceholder
      category="Inventory & Batches"
      moduleName="Batch Traceability (FEFO Picking Engine)"
      description="Physical batch lifecycle from manufacturing date and QC release to dispatch and customer delivery."
      sampleMetrics={[
        { label: "Active Physical Batches", value: "32 Batches" },
        { label: "Near-Expiry Alert (<30d)", value: "2 Batches" },
        { label: "FEFO Compliance", value: "100% Enforced" },
      ]}
      features={[
        "First-Expired, First-Out (FEFO) automated picking algorithm for sales order dispatch",
        "Full backward and forward recall traceability: from raw material lot to customer invoice",
        "Physical lot segregation between bulk intermediary and retail packaging packets",
        "Automated prevention: expired or quarantined lots are physically barred from dispatch",
      ]}
      actionLabel="Inspect Batch Genealogy"
    />
  );
}
