"use client";

import { useState, useEffect } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  Banknote,
  Factory,
  ArrowRight,
  Filter,
} from "lucide-react";
import {
  runSystemReconciliationAction,
  getReconciliationHistoryAction,
} from "@/modules/reconciliation/actions";
import {
  ReconciliationCategory,
  ReconciliationFinding,
  ReconciliationRunResult,
  AnomalySeverity,
} from "@/modules/reconciliation/schema";

export default function ReconciliationPage() {
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState<ReconciliationCategory>("ALL");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<"ALL" | "INVENTORY" | "FINANCIAL" | "COSTING" | "HISTORY">("ALL");
  const [result, setResult] = useState<ReconciliationRunResult | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Trigger initial reconciliation run
  useEffect(() => {
    handleRunAudit("ALL");
    loadHistory();
  }, []);

  async function handleRunAudit(cat: ReconciliationCategory) {
    setLoading(true);
    setError(null);
    try {
      const res = await runSystemReconciliationAction({ category: cat });
      if (res.success && res.data) {
        setResult(res.data);
      } else {
        setError(res.error || "Failed to execute reconciliation checks.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Reconciliation runner failed.");
    } finally {
      setLoading(false);
      loadHistory();
    }
  }

  async function loadHistory() {
    try {
      const res = await getReconciliationHistoryAction();
      if (res.success && res.data) {
        setHistory(res.data);
      }
    } catch {
      // ignore history fetch error
    }
  }

  const findings = result?.findings || [];

  const filteredFindings = findings.filter((f) => {
    if (activeTab !== "ALL" && f.category !== activeTab) return false;
    if (selectedSeverity !== "ALL" && f.severity !== selectedSeverity) return false;
    return true;
  });

  const summary = result?.summary;

  function exportFindingsCsv() {
    if (!findings.length) return;
    const headers = [
      "Category",
      "Check Name",
      "Severity",
      "Title",
      "Reference Type",
      "Reference Number",
      "Expected Value",
      "Actual Value",
      "Discrepancy",
      "Suggested Fix",
    ];
    const rows = findings.map((f) => [
      `"${f.category}"`,
      `"${f.checkName}"`,
      `"${f.severity}"`,
      `"${f.title}"`,
      `"${f.referenceType || ""}"`,
      `"${f.referenceNumber || ""}"`,
      `"${f.expectedValue}"`,
      `"${f.actualValue}"`,
      `"${f.discrepancy}"`,
      `"${f.suggestedFix.replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reconciliation_audit_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Automated Data Reconciliation
            </h1>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-900/30 dark:text-blue-400">
              Zero-Downtime Engine
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time cross-ledger integrity verifier across Physical Batches, Stock Movements, Reservations, Invoices, Customer Balances, and Production Yield.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportFindingsCsv}
            disabled={!findings.length}
            className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50 transition"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Export CSV
          </button>
          <button
            onClick={() => handleRunAudit(category)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Auditing System..." : "Run Complete Audit"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 border border-red-200 text-sm text-red-800 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300">
          <strong>Reconciliation Error:</strong> {error}
        </div>
      )}

      {/* Summary Scorecard */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Audit Health Score</span>
              {summary.healthScore === 100 ? (
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
              ) : (
                <ShieldAlert className="h-5 w-5 text-amber-500" />
              )}
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-foreground">{summary.healthScore}%</span>
              <span className="text-xs text-muted-foreground">
                {summary.healthScore === 100 ? "Flawless" : "Attention Required"}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full ${
                  summary.healthScore >= 90
                    ? "bg-emerald-500"
                    : summary.healthScore >= 70
                    ? "bg-amber-500"
                    : "bg-red-500"
                }`}
                style={{ width: `${summary.healthScore}%` }}
              />
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Total Integrity Checks</span>
              <CheckCircle2 className="h-5 w-5 text-primary" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-foreground">{summary.totalChecks}</span>
              <span className="text-xs text-muted-foreground">Rules Verified</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {summary.passedChecks} passed, {summary.failedChecks} flagged
            </p>
          </div>

          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Critical Discrepancies</span>
              <XCircle className="h-5 w-5 text-red-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-red-600 dark:text-red-400">
                {summary.criticalCount}
              </span>
              <span className="text-xs text-muted-foreground">Immediate action</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Stock ledger / Tax mismatches</p>
          </div>

          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Integrity Errors</span>
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                {summary.errorCount}
              </span>
              <span className="text-xs text-muted-foreground">Discrepancies</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Reservations / Customer ledger</p>
          </div>

          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Costing Warnings</span>
              <Clock className="h-5 w-5 text-blue-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {summary.warningCount}
              </span>
              <span className="text-xs text-muted-foreground">Outliers</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Yield & variance outliers</p>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b">
        <div className="flex space-x-1">
          <button
            onClick={() => setActiveTab("ALL")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition -mb-px flex items-center gap-1.5 ${
              activeTab === "ALL"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            All Findings ({findings.length})
          </button>
          <button
            onClick={() => setActiveTab("INVENTORY")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition -mb-px flex items-center gap-1.5 ${
              activeTab === "INVENTORY"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="h-4 w-4" />
            Inventory ({findings.filter((f) => f.category === "INVENTORY").length})
          </button>
          <button
            onClick={() => setActiveTab("FINANCIAL")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition -mb-px flex items-center gap-1.5 ${
              activeTab === "FINANCIAL"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Banknote className="h-4 w-4" />
            Financial ({findings.filter((f) => f.category === "FINANCIAL").length})
          </button>
          <button
            onClick={() => setActiveTab("COSTING")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition -mb-px flex items-center gap-1.5 ${
              activeTab === "COSTING"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Factory className="h-4 w-4" />
            Costing & Yield ({findings.filter((f) => f.category === "COSTING").length})
          </button>
          <button
            onClick={() => setActiveTab("HISTORY")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition -mb-px flex items-center gap-1.5 ${
              activeTab === "HISTORY"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock className="h-4 w-4" />
            Audit History ({history.length})
          </button>
        </div>

        {activeTab !== "HISTORY" && (
          <div className="flex items-center gap-2 mb-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="rounded-md border bg-background px-2.5 py-1 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical Only</option>
              <option value="ERROR">Errors Only</option>
              <option value="WARNING">Warnings Only</option>
            </select>
          </div>
        )}
      </div>

      {/* Findings Content */}
      {activeTab !== "HISTORY" ? (
        <div className="space-y-4">
          {filteredFindings.length === 0 ? (
            <div className="rounded-xl border bg-card p-12 text-center shadow-sm">
              <ShieldCheck className="mx-auto h-12 w-12 text-emerald-500" />
              <h3 className="mt-3 text-lg font-semibold text-foreground">
                No Discrepancies Detected
              </h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
                All ledger invariants, batch quantities, tax totals, and customer balances are in 100% mathematical alignment.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFindings.map((finding) => (
                <div
                  key={finding.id}
                  className={`rounded-xl border p-4 shadow-sm transition ${
                    finding.severity === "CRITICAL"
                      ? "bg-red-50/50 border-red-200 dark:bg-red-950/20 dark:border-red-900"
                      : finding.severity === "ERROR"
                      ? "bg-amber-50/50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900"
                      : "bg-blue-50/50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900"
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
                            finding.severity === "CRITICAL"
                              ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                              : finding.severity === "ERROR"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                          }`}
                        >
                          {finding.severity}
                        </span>
                        <span className="text-xs font-mono text-muted-foreground">
                          [{finding.category}] {finding.checkName}
                        </span>
                        {finding.referenceNumber && (
                          <span className="text-xs font-semibold text-foreground bg-muted px-2 py-0.5 rounded">
                            {finding.referenceType}: {finding.referenceNumber}
                          </span>
                        )}
                      </div>
                      <h4 className="text-base font-semibold text-foreground">{finding.title}</h4>
                      <p className="text-sm text-muted-foreground">{finding.description}</p>
                    </div>

                    <div className="flex sm:flex-col items-end gap-1 text-right text-xs bg-background/80 p-2.5 rounded-lg border min-w-[200px]">
                      <div className="text-muted-foreground">
                        Expected: <span className="font-mono font-semibold text-foreground">{String(finding.expectedValue)}</span>
                      </div>
                      <div className="text-muted-foreground">
                        Actual: <span className="font-mono font-semibold text-foreground">{String(finding.actualValue)}</span>
                      </div>
                      <div className="text-red-600 dark:text-red-400 font-semibold">
                        Discrepancy: <span className="font-mono">{String(finding.discrepancy)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t flex items-start gap-2 text-xs text-muted-foreground">
                    <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-foreground">Actionable Fix:</span>{" "}
                      {finding.suggestedFix}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* History Tab */
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs font-semibold text-muted-foreground uppercase border-b">
                <tr>
                  <th className="p-3">Run Timestamp</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Health Score</th>
                  <th className="p-3">Critical</th>
                  <th className="p-3">Errors</th>
                  <th className="p-3">Warnings</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-muted-foreground">
                      No historical reconciliation runs logged yet.
                    </td>
                  </tr>
                ) : (
                  history.map((h) => (
                    <tr key={h.id} className="hover:bg-muted/30">
                      <td className="p-3 font-mono text-xs">
                        {new Date(h.created_at).toLocaleString()}
                      </td>
                      <td className="p-3 font-medium">{h.category}</td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            h.status === "CLEAN"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                          }`}
                        >
                          {h.status}
                        </span>
                      </td>
                      <td className="p-3 font-bold">{h.health_score}%</td>
                      <td className="p-3 text-red-600 font-semibold">{h.critical_count}</td>
                      <td className="p-3 text-amber-600 font-semibold">{h.error_count}</td>
                      <td className="p-3 text-blue-600 font-semibold">{h.warning_count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
