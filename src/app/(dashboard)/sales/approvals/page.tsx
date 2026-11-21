import React from "react";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export default function OrderApprovalsPage() {
  return (
    <ModulePlaceholder
      category="Field Sales & CRM"
      moduleName="Order Risk & Approval Queue"
      description="Supervisor and Admin review for high-risk orders, customer credit limit breaches, or special pricing discounts."
      sampleMetrics={[
        { label: "Orders in Review", value: "4 Orders" },
        { label: "Credit Exceptions", value: "2 Breaches" },
        { label: "Avg Approval Time", value: "18 mins" },
      ]}
      features={[
        "Automated risk scoring based on customer outstanding vs credit limit",
        "Multi-tier approval workflow (Supervisor for standard exceptions, Admin for major limit overrides)",
        "Audit trail capture of who approved the exception and why",
        "Blocks warehouse picking until high-risk orders receive digital sign-off",
      ]}
      actionLabel="Process Approvals"
    />
  );
}
