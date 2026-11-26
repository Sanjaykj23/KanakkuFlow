"use client";

import React, { useState, useEffect } from "react";
import {
  Building2,
  MapPin,
  Shield,
  Layers,
  Percent,
  CheckCircle2,
  RefreshCw,
  Lock,
  Globe,
  Phone,
  Mail,
  FileText,
} from "lucide-react";
import { getCompanySettingsAction, CompanySettingsData } from "@/modules/settings/actions";

export default function SettingsPage() {
  const [data, setData] = useState<CompanySettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"company" | "branches" | "security">("company");

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    setError(null);
    try {
      const res = await getCompanySettingsAction();
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(res.error || "Failed to load settings.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setLoading(false);
    }
  }

  const company = data?.company;
  const branches = data?.branches || [];
  const config = data?.systemConfig;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Company & System Settings
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-300">
              <Building2 className="h-3 w-3" />
              Tenant Master
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Authoritative configuration for legal entity, GSTIN registration, branch plants, sequence counters, and security rules.
          </p>
        </div>

        <button
          onClick={loadSettings}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition shadow-sm self-start"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 border border-red-200 text-sm text-red-800 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300">
          <strong>Access Notice:</strong> {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b space-x-2">
        <button
          onClick={() => setActiveTab("company")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition -mb-px flex items-center gap-2 ${
            activeTab === "company"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Building2 className="h-4 w-4" />
          Company Profile & Tax IDs
        </button>
        <button
          onClick={() => setActiveTab("branches")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition -mb-px flex items-center gap-2 ${
            activeTab === "branches"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <MapPin className="h-4 w-4" />
          Branch Plants & Warehouses ({branches.length})
        </button>
        <button
          onClick={() => setActiveTab("security")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition -mb-px flex items-center gap-2 ${
            activeTab === "security"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Shield className="h-4 w-4" />
          Security & Invariants
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
          Loading company configuration...
        </div>
      ) : activeTab === "company" && company ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2 border-b pb-3">
              <Building2 className="h-4 w-4 text-primary" />
              Legal Entity Details
            </h3>

            <div className="space-y-3 text-sm">
              <div>
                <span className="text-xs text-muted-foreground block">Legal Name</span>
                <span className="font-semibold text-foreground">{company.legalName}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Trade Name / Brand</span>
                <span className="font-medium text-foreground">{company.tradeName}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-muted-foreground block">GSTIN</span>
                  <span className="font-mono font-bold text-foreground">{company.gstin}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Permanent Account No (PAN)</span>
                  <span className="font-mono font-bold text-foreground">{company.pan}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2 border-b pb-3">
              <MapPin className="h-4 w-4 text-primary" />
              Registered Address & Contact
            </h3>

            <div className="space-y-3 text-sm">
              <div>
                <span className="text-xs text-muted-foreground block">Registered Office</span>
                <span className="text-foreground">
                  {company.addressLine1 ? `${company.addressLine1}, ` : ""}
                  {company.city}, {company.state} {company.postalCode}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-muted-foreground block flex items-center gap-1">
                    <Mail className="h-3 w-3" /> Email
                  </span>
                  <span className="text-foreground">{company.email}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block flex items-center gap-1">
                    <Phone className="h-3 w-3" /> Phone
                  </span>
                  <span className="text-foreground">{company.phone}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === "branches" ? (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs font-semibold text-muted-foreground uppercase border-b">
                <tr>
                  <th className="p-3">Branch Code</th>
                  <th className="p-3">Branch Name</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">GSTIN</th>
                  <th className="p-3">Location</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y text-xs">
                {branches.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      No branches found.
                    </td>
                  </tr>
                ) : (
                  branches.map((b) => (
                    <tr key={b.id} className="hover:bg-muted/30">
                      <td className="p-3 font-mono font-bold text-foreground">{b.code}</td>
                      <td className="p-3 font-medium text-foreground">{b.name}</td>
                      <td className="p-3">
                        <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-semibold">
                          {b.branchType}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-muted-foreground">{b.gstin || company?.gstin}</td>
                      <td className="p-3 text-muted-foreground">{b.city}, {b.state}</td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            b.isActive
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {b.isActive ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === "security" && config ? (
        <div className="rounded-xl border bg-card p-6 shadow-sm space-y-6">
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2 border-b pb-3">
            <Shield className="h-4 w-4 text-primary" />
            Mandatory Architectural Policies & Compliance
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border p-4 bg-muted/20">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Arithmetic Precision
              </span>
              <p className="font-medium text-foreground text-sm">{config.baseCurrency}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Zero JavaScript floating point drift. All ledgers, taxes, and prices execute as strict integer paisa.
              </p>
            </div>

            <div className="rounded-lg border p-4 bg-muted/20">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Multi-Tenant Isolation
              </span>
              <p className="font-medium text-foreground text-sm">{config.securityPolicy}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Non-recursive PostgreSQL RLS functions verify active company membership and branch scope on every query.
              </p>
            </div>

            <div className="rounded-lg border p-4 bg-muted/20">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Inventory Valuation Invariant
              </span>
              <p className="font-medium text-foreground text-sm">{config.inventoryMethod}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Physical picking follows First-Expired, First-Out (FEFO). Financial valuation is perpetual weighted average cost snapshot.
              </p>
            </div>

            <div className="rounded-lg border p-4 bg-muted/20">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Statutory GST Standard
              </span>
              <p className="font-medium text-foreground text-sm">{config.gstFormat}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Place-of-supply resolution auto-splits into CGST + SGST (33 - Tamil Nadu intra-state) or IGST (inter-state).
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
