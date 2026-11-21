import React from "react";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export default function PricingPage() {
  return (
    <ModulePlaceholder
      category="Field Sales & CRM"
      moduleName="Price Lists & Tiered Discounts"
      description="Effective-dated pricing rules for wholesalers, supermarkets, and direct retail shops."
      sampleMetrics={[
        { label: "Active Price Lists", value: "3 Tiers" },
        { label: "Covered SKUs", value: "42 Products" },
        { label: "Effective Policy", value: "Strict Immutability" },
      ]}
      features={[
        "Customer-specific and tier-based price lists (Distributor, Retail, Institutional)",
        "Effective-date windows (promotions, seasonal price adjustments)",
        "Strict rule: historical invoices never rewrite backwards when price lists change",
        "Owner/Admin approval required before new pricing policies take effect",
      ]}
      actionLabel="Create Price List"
    />
  );
}
