import React from "react";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export default function ShopRegistrationsPage() {
  return (
    <ModulePlaceholder
      category="Field Sales & CRM"
      moduleName="Shop Visits & Retail Customer Registration"
      description="Field Salesman mobile onboarding workflow with duplicate detection and Admin approval queue."
      sampleMetrics={[
        { label: "Pending Approvals", value: "3 Retailers" },
        { label: "Approved This Month", value: "48 Shops" },
        { label: "Duplicate Checks", value: "100% Verified" },
      ]}
      features={[
        "Mobile-first submission by Salesmen with GPS coordinates and trade details",
        "Automated duplicate prevention on normalized 10-digit mobile number and GSTIN",
        "Fuzzy name matching against existing registered stores within the same postal pincode",
        "Atomic Admin approval transaction generating sequential customer codes (e.g. CST-00042)",
      ]}
      actionLabel="Submit New Shop Visit"
    />
  );
}
