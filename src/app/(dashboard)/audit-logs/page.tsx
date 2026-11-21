import React from "react";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export default function AuditLogsPage() {
  return (
    <ModulePlaceholder
      category="Governance & Security"
      moduleName="Immutable Audit Trail & Security Logs"
      description="Cryptographically tracked history of all user creations, role alterations, order approvals, and pricing overrides."
      sampleMetrics={[
        { label: "Total Log Entries", value: "1,429 Events" },
        { label: "Admin Changes Today", value: "6 Events" },
        { label: "Tamper Protection", value: "Strict Trigger Active" },
      ]}
      features={[
        "Append-only PostgreSQL architecture (UPDATE and DELETE prohibited by database triggers)",
        "Captures Actor ID, Company ID, Entity Name, Old JSONB, New JSONB, IP Address, and Timestamptz",
        "Filtered by date range, actor, and affected entity (e.g. Price Lists, Invoices, User Memberships)",
        "Restricted strictly to OWNER role via Row Level Security (RLS) policies",
      ]}
      actionLabel="Export Security Audit CSV"
    />
  );
}
