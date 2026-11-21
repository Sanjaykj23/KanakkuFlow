import React from "react";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export default function QCPage() {
  return (
    <ModulePlaceholder
      category="Production & Quality"
      moduleName="Quality Control (QC) & Lab Inspections"
      description="Mandatory food safety inspections (moisture %, free fatty acids, seal integrity, organoleptic tests)."
      sampleMetrics={[
        { label: "Inspected Today", value: "8 Batches" },
        { label: "Pass Rate", value: "98.5%" },
        { label: "Quarantine", value: "1 Batch" },
      ]}
      features={[
        "Mandatory QC sign-off before any newly produced batch is unlocked for sale or dispatch",
        "Configurable parameter thresholds (Moisture < 2.5%, FFA < 0.5%, Crispness pass)",
        "Quarantine workflow: Failed or uninspected batches cannot be physically allocated to orders",
        "Digital signature capture of QC inspector with timestamp",
      ]}
      actionLabel="Log Inspection Results"
    />
  );
}
