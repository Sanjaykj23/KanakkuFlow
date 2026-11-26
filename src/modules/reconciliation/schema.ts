import { z } from "zod";

export const anomalySeveritySchema = z.enum(["WARNING", "ERROR", "CRITICAL"]);
export type AnomalySeverity = z.infer<typeof anomalySeveritySchema>;

export const reconciliationCategorySchema = z.enum([
  "ALL",
  "INVENTORY",
  "FINANCIAL",
  "COSTING",
]);
export type ReconciliationCategory = z.infer<typeof reconciliationCategorySchema>;

export interface ReconciliationFinding {
  id: string;
  category: "INVENTORY" | "FINANCIAL" | "COSTING";
  checkName: string;
  severity: AnomalySeverity;
  title: string;
  description: string;
  referenceType?: string;
  referenceId?: string;
  referenceNumber?: string;
  expectedValue: string | number;
  actualValue: string | number;
  discrepancy: string | number;
  suggestedFix: string;
  detectedAt: string;
}

export interface ReconciliationSummary {
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  criticalCount: number;
  errorCount: number;
  warningCount: number;
  healthScore: number; // 0 - 100%
  runTimestamp: string;
  runBy: string;
  status: "CLEAN" | "DISCREPANCIES_FOUND" | "FAILED";
}

export interface ReconciliationRunResult {
  runId: string;
  companyId: string;
  category: ReconciliationCategory;
  summary: ReconciliationSummary;
  findings: ReconciliationFinding[];
}

export const runReconciliationFilterSchema = z.object({
  category: reconciliationCategorySchema.default("ALL"),
  branchId: z.string().uuid().optional().nullable(),
});

export type RunReconciliationFilterInput = z.infer<typeof runReconciliationFilterSchema>;
