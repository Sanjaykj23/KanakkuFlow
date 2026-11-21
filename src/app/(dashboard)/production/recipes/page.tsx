import React from "react";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export default function RecipesPage() {
  return (
    <ModulePlaceholder
      category="Production & Quality"
      moduleName="Bill of Materials (BOM) & Recipes"
      description="Formulations for bulk frying (raw rice flour, urad dal, edible oil, spices) and packaging materials."
      sampleMetrics={[
        { label: "Active Recipes", value: "14 BOMs" },
        { label: "Standard Yield", value: "96.4%" },
        { label: "Two-Stage Split", value: "Bulk + Pack" },
      ]}
      features={[
        "Two-stage production modeling: Bulk murukku frying followed by secondary packaging runs",
        "Version-controlled recipes with effective dates and raw material consumption ratios",
        "Yield factor calculations and permissible loss tolerances (evaporation, frying scrap)",
        "Restricted modification access: Only OWNER and ADMIN can alter recipe formulations",
      ]}
      actionLabel="Create Recipe Version"
    />
  );
}
