"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  RefreshCw,
  Search,
  Filter,
  FileSpreadsheet,
  Calendar,
  User,
  ArrowRight,
  Database,
  Lock,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { getAuditLogsAction, AuditLogEntry } from "@/modules/audit/actions";

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedAction, setSelectedAction] = useState("ALL");
  const [selectedEntity, setSelectedEntity] = useState("ALL");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    loadLogs();
  }, [selectedAction, selectedEntity]);

  async function loadLogs() {
    setLoading(true);
    setError(null);
    try {
      const res = await getAuditLogsAction({
        action: selectedAction,
        entityName: selectedEntity,
        limit: 100,
      });
      if (res.success && res.data) {
        setLogs(res.data);
      } else {
        setError(res.error || "Failed to load audit logs.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setLoading(false);
    }
  }

  const filteredLogs = logs.filter((log) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      log.action.toLowerCase().includes(term) ||
      log.entityName.toLowerCase().includes(term) ||
      log.entityId.toLowerCase().includes(term) ||
      log.userName.toLowerCase().includes(term)
    );
  });

  function exportCsv() {
    if (!logs.length) return;
    const headers = ["Timestamp", "Action", "Entity", "Entity ID", "Actor", "Email", "IP Address"];
    const rows = filteredLogs.map((l) => [
      `"${new Date(l.createdAt).toISOString()}"`,
      `"${l.action}"`,
      `"${l.entityName}"`,
      `"${l.entityId}"`,
      `"${l.userName.replace(/"/g, '""')}"`,
      `"${l.userEmail}"`,
      `"${l.ipAddress || "N/A"}"`,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit_trail_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Immutable Audit Trail
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-700/10 dark:bg-emerald-950 dark:text-emerald-300">
              <Lock className="h-3 w-3" />
              Append-Only Trigger Protected
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Tamper-proof record of all user activities, security approvals, price list changes, and state transitions. Strictly restricted to OWNER role.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            disabled={!filteredLogs.length}
            className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50 transition"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Export CSV
          </button>
          <button
            onClick={loadLogs}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 border border-red-200 text-sm text-red-800 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300">
          <strong>Security Notice:</strong> {error}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/40 p-3 rounded-xl border">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search action, actor, or entity..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-background border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex items-center gap-1 text-xs">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="rounded-md border bg-background px-2.5 py-1 text-xs font-medium focus:outline-none"
            >
              <option value="ALL">All Actions</option>
              <option value="LOGIN">LOGIN</option>
              <option value="CREATE">CREATE</option>
              <option value="UPDATE">UPDATE</option>
              <option value="APPROVE">APPROVE</option>
              <option value="DISPATCH">DISPATCH</option>
              <option value="PRICE_OVERRIDE">PRICE_OVERRIDE</option>
            </select>
          </div>

          <div className="flex items-center gap-1 text-xs">
            <Database className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
              className="rounded-md border bg-background px-2.5 py-1 text-xs font-medium focus:outline-none"
            >
              <option value="ALL">All Entities</option>
              <option value="sales_orders">Sales Orders</option>
              <option value="sales_invoices">Invoices</option>
              <option value="customers">Customers</option>
              <option value="inventory_batches">Batches</option>
              <option value="production_orders">Production</option>
              <option value="company_memberships">Users & Roles</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{filteredLogs.length}</span> audit events
        </div>
      </div>

      {/* Log Entries Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs font-semibold text-muted-foreground uppercase border-b">
              <tr>
                <th className="p-3 w-8"></th>
                <th className="p-3">Timestamp</th>
                <th className="p-3">Action</th>
                <th className="p-3">Entity</th>
                <th className="p-3">Entity ID</th>
                <th className="p-3">Actor</th>
                <th className="p-3">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y text-xs font-mono">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground font-sans">
                    {loading ? "Loading audit logs..." : "No audit log entries found matching criteria."}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isExpanded = expandedRow === log.id;
                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                        className="hover:bg-muted/30 cursor-pointer transition"
                      >
                        <td className="p-3 text-center">
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="p-3 font-sans">
                          <span
                            className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold ${
                              log.action.includes("CREATE")
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : log.action.includes("APPROVE")
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                                : log.action.includes("DELETE") || log.action.includes("REJECT")
                                ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                                : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="p-3 font-sans font-medium text-foreground">
                          {log.entityName}
                        </td>
                        <td className="p-3 text-muted-foreground truncate max-w-[150px]">
                          {log.entityId}
                        </td>
                        <td className="p-3 font-sans">
                          <div className="font-medium text-foreground">{log.userName}</div>
                          <div className="text-[11px] text-muted-foreground">{log.userEmail}</div>
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {log.ipAddress || "Internal"}
                        </td>
                      </tr>

                      {/* Expanded JSON Diff Payload */}
                      {isExpanded && (
                        <tr className="bg-muted/20">
                          <td colSpan={7} className="p-4 border-t border-b">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                              <div className="rounded-lg border bg-background p-3">
                                <span className="font-sans font-semibold text-muted-foreground uppercase text-[10px] tracking-wider block mb-2">
                                  Previous State (old_values)
                                </span>
                                <pre className="max-h-48 overflow-auto text-muted-foreground text-[11px]">
                                  {log.oldValues
                                    ? JSON.stringify(log.oldValues, null, 2)
                                    : "// No previous state"}
                                </pre>
                              </div>
                              <div className="rounded-lg border bg-background p-3">
                                <span className="font-sans font-semibold text-primary uppercase text-[10px] tracking-wider block mb-2">
                                  Updated State (new_values)
                                </span>
                                <pre className="max-h-48 overflow-auto text-foreground text-[11px]">
                                  {log.newValues
                                    ? JSON.stringify(log.newValues, null, 2)
                                    : "// No modified fields"}
                                </pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
