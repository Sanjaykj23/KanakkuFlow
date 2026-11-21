import React from "react";
import { MetricCard } from "@/components/shared/metric-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Factory,
  Package,
  TrendingUp,
  AlertTriangle,
  QrCode,
  ShieldCheck,
  IndianRupee,
  Store,
} from "lucide-react";
import { formatCurrencyINR } from "@/lib/utils";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page Title & Intro */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Manufacturing Operations Cockpit
          </h1>
          <p className="text-xs text-slate-500">
            Live overview of raw materials, production output, batch tracking, and sales approvals.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-slate-600 bg-white">
            <span className="w-2 h-2 mr-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
            Live FEFO Ledger Active
          </Badge>
        </div>
      </div>

      {/* Top Metric Cards (Retool / ERP Style) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Today's Production"
          value="1,450 kg"
          subtitle="Butter Murukku & Ribbon Pakoda"
          icon={<Factory className="w-4 h-4 text-amber-600" />}
          trend={{ value: "+8.4% vs target", isPositive: true }}
        />
        <MetricCard
          title="Active Batches"
          value="18 Batches"
          subtitle="In QC Quarantine & Packaging"
          icon={<Package className="w-4 h-4 text-blue-600" />}
        />
        <MetricCard
          title="Pending Approvals"
          value="4 Orders"
          subtitle="2 High Credit Risk, 2 New Shops"
          icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
        />
        <MetricCard
          title="Today's Sales Billing"
          value={formatCurrencyINR(284500)}
          subtitle="14 GST Invoices Dispatched"
          icon={<IndianRupee className="w-4 h-4 text-emerald-600" />}
          trend={{ value: "+12.1% this week", isPositive: true }}
        />
      </div>

      {/* Two Column Layout: Production Runs & Batch Traceability */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-7">
        {/* Left Column: Active Batches & FEFO Picking (4 Cols) */}
        <Card className="lg:col-span-4 border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-amber-600" />
                  Live Finished Goods Batches (FEFO Traceability)
                </CardTitle>
                <CardDescription className="text-xs">
                  Physical batches ordered by earliest expiry date for dispatch allocation.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs">
                Auto-FEFO
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Batch Code</TableHead>
                  <TableHead className="text-xs">Product Item</TableHead>
                  <TableHead className="text-xs">Mfg Date</TableHead>
                  <TableHead className="text-xs">Expiry</TableHead>
                  <TableHead className="text-xs">Qty (kg)</TableHead>
                  <TableHead className="text-xs">QC Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-mono text-xs font-medium">BAT-2026-0104</TableCell>
                  <TableCell className="text-xs">Handmade Butter Murukku (200g)</TableCell>
                  <TableCell className="text-xs">18 Nov 2026</TableCell>
                  <TableCell className="text-xs font-semibold text-amber-700">18 Feb 2027</TableCell>
                  <TableCell className="text-xs font-mono">420.0</TableCell>
                  <TableCell>
                    <Badge variant="success">PASSED</Badge>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-xs font-medium">BAT-2026-0105</TableCell>
                  <TableCell className="text-xs">Spicy Ribbon Pakoda (500g)</TableCell>
                  <TableCell className="text-xs">19 Nov 2026</TableCell>
                  <TableCell className="text-xs font-semibold text-amber-700">19 Feb 2027</TableCell>
                  <TableCell className="text-xs font-mono">310.0</TableCell>
                  <TableCell>
                    <Badge variant="success">PASSED</Badge>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-xs font-medium">BAT-2026-0106</TableCell>
                  <TableCell className="text-xs">Garlic Thattai (250g)</TableCell>
                  <TableCell className="text-xs">20 Nov 2026</TableCell>
                  <TableCell className="text-xs font-semibold text-slate-600">20 Mar 2027</TableCell>
                  <TableCell className="text-xs font-mono">250.0</TableCell>
                  <TableCell>
                    <Badge variant="warning">QC TESTING</Badge>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-xs font-medium">BAT-2026-0107</TableCell>
                  <TableCell className="text-xs">Kara Sev (Bulk 5kg)</TableCell>
                  <TableCell className="text-xs">21 Nov 2026</TableCell>
                  <TableCell className="text-xs font-semibold text-slate-600">21 Mar 2027</TableCell>
                  <TableCell className="text-xs font-mono">500.0</TableCell>
                  <TableCell>
                    <Badge variant="secondary">IN BULK FRYING</Badge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Right Column: Pending Shop Registrations & Approvals (3 Cols) */}
        <Card className="lg:col-span-3 border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Store className="w-4 h-4 text-amber-600" />
                  Field Shop Registrations
                </CardTitle>
                <CardDescription className="text-xs">
                  New retail outlets submitted by Salesmen requiring Admin sign-off.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 border rounded-md border-amber-200 bg-amber-50/50">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900">Sri Krishna Sweets & Bakery</div>
                  <div className="text-[11px] text-slate-500">Submitted by: Ramesh (Salesman - Madurai South)</div>
                  <div className="text-[11px] text-slate-500">Phone: 98401 23456 • GSTIN: 33AAACR1234F1Z1</div>
                </div>
                <Badge variant="warning">PENDING</Badge>
              </div>
              <div className="flex gap-2 mt-3">
                <button className="px-2.5 py-1 text-xs font-medium text-white bg-slate-900 rounded hover:bg-slate-800 transition-colors">
                  Review & Approve
                </button>
                <button className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors">
                  Check Duplicates
                </button>
              </div>
            </div>

            <div className="p-3 border rounded-md border-slate-200 bg-slate-50/60">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900">Mani Vilas Departmental Store</div>
                  <div className="text-[11px] text-slate-500">Submitted by: Karthik (Salesman - Dindigul)</div>
                  <div className="text-[11px] text-slate-500">Phone: 94432 98765 • Unregistered Retailer</div>
                </div>
                <Badge variant="warning">PENDING</Badge>
              </div>
              <div className="flex gap-2 mt-3">
                <button className="px-2.5 py-1 text-xs font-medium text-white bg-slate-900 rounded hover:bg-slate-800 transition-colors">
                  Review & Approve
                </button>
                <button className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors">
                  Check Duplicates
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
