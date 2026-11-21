import React from "react";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export default function StockLedgerPage() {
  return (
    <ModulePlaceholder
      category="Inventory & Batches"
      moduleName="Stock Ledger & Warehouse Balances"
      description="Append-only stock balance view across raw materials, bulk intermediates, and finished goods."
      sampleMetrics={[
        { label: "Raw Materials Value", value: "₹8,45,000" },
        { label: "Finished Goods Value", value: "₹14,90,000" },
        { label: "Costing Valuation", value: "Weighted Average" },
      ]}
      features={[
        "Double-entry stock movement ledger: receipts, transfers, production usage, scrap, and dispatches",
        "Perpetual weighted-average cost snapshots per warehouse and item",
        "Real-time physical vs reserved stock tracking to prevent over-promising orders",
        "Company-wide access for Owner/Accountant; branch-locked access for Warehouse operators",
      ]}
      actionLabel="Stock Transfer / Adjustment"
    />
  );
}
