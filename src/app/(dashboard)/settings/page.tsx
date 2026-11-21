import React from "react";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export default function SettingsPage() {
  return (
    <ModulePlaceholder
      category="Administration"
      moduleName="Company & Plant Settings"
      description="Configure company legal entities, GSTIN, branch plants, sequence counters, and security rules."
      sampleMetrics={[
        { label: "Active Plants", value: "2 Branches" },
        { label: "State Code", value: "33 (Tamil Nadu)" },
        { label: "Security Policy", value: "Strict Hierarchical" },
      ]}
      features={[
        "Manage company profile (Legal name, Trade name, GSTIN, PAN, registered addresses)",
        "Configure branch plants and distribution warehouses with independent code sequences",
        "WhatsApp API integration settings and notification template parameters",
        "Restricted strictly to OWNER role via RLS policies and server-side checks",
      ]}
      actionLabel="Edit Company Profile"
    />
  );
}
