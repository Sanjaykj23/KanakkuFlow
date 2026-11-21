import React from "react";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export default function DispatchPage() {
  return (
    <ModulePlaceholder
      category="Inventory & Batches"
      moduleName="Goods Receipt, Picking & Dispatch"
      description="Warehouse fulfillment operations: PO receiving, FEFO picking slips, packing, and carrier hand-off."
      sampleMetrics={[
        { label: "Pending Shipments", value: "8 Dispatches" },
        { label: "Picked Today", value: "620 Cartons" },
        { label: "Carrier Gateways", value: "Direct Logistics" },
      ]}
      features={[
        "Goods Receipt Note (GRN) workflow with supplier lot recording and initial QC intake",
        "Digital pick lists grouping items by physical warehouse bin and batch expiry date",
        "Packing validation and carton label generation with QR batch codes",
        "Generates Delivery Challans and triggers GST E-way Bill readiness",
      ]}
      actionLabel="Create Dispatch Challan"
    />
  );
}
