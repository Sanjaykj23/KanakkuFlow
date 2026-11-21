import React from "react";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export default function ProductionRunsPage() {
  return (
    <ModulePlaceholder
      category="Production & Quality"
      moduleName="Production Runs & Batch Execution"
      description="Factory plant floor work orders, raw material batch consumption, and output logging."
      sampleMetrics={[
        { label: "Active Runs Today", value: "6 Runs" },
        { label: "Bulk Output", value: "1,450 kg" },
        { label: "Packaging Output", value: "4,200 Packets" },
      ]}
      features={[
        "Step 1: Bulk frying execution with raw flour & oil batch deductions (FEFO)",
        "Step 2: Nitrogen packaging execution into finished 200g, 500g, and 1kg packets",
        "Variance logging comparing actual consumption against theoretical BOM standard",
        "Auto-generation of unique physical batch codes (e.g. BAT-2026-0104) upon completion",
      ]}
      actionLabel="Start Production Run"
    />
  );
}
