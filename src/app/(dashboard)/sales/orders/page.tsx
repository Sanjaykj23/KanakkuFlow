import React from "react";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export default function SalesOrdersPage() {
  return (
    <ModulePlaceholder
      category="Field Sales & CRM"
      moduleName="Sales Orders & Demand Management"
      description="Create, book, and track distributor and retail sales orders with live inventory availability checks."
      sampleMetrics={[
        { label: "Today's Orders", value: "28 Bookings" },
        { label: "Booked Value", value: "₹3,42,800" },
        { label: "Awaiting Dispatch", value: "9 Orders" },
      ]}
      features={[
        "Multi-line order booking with automatic HSN and GST calculation snapshots",
        "Assigned customer territory lock for Salesmen",
        "Instant credit limit and overdue invoice check at order creation time",
        "Provisional stock reservation against available FEFO finished goods batches",
      ]}
      actionLabel="Create Sales Order"
    />
  );
}
