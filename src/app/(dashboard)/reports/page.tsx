"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Filter,
  RefreshCw,
  TrendingUp,
  ShoppingBag,
  Boxes,
  Factory,
  CreditCard,
  IndianRupee,
  Clock,
  Printer,
  ChevronRight,
  ArrowRight,
  AlertTriangle,
  FileText,
  BarChart3,
  Layers,
  ShieldCheck,
} from "lucide-react";
import { formatPaisa } from "@/lib/utils";
import {
  getManagementDashboardData,
  getSalesAnalyticsData,
  getInventoryAnalyticsData,
  getProductionAnalyticsData,
} from "@/modules/reports/actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function UnifiedReportsPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "sales" | "inventory" | "production" | "finance">("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Report Datasets
  const [overviewData, setOverviewData] = useState<any>(null);
  const [salesData, setSalesData] = useState<any>(null);
  const [inventoryData, setInventoryData] = useState<any>(null);
  const [productionData, setProductionData] = useState<any>(null);

  const loadAllReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ovRes, slRes, invRes, prRes] = await Promise.all([
        getManagementDashboardData({ startDate, endDate }),
        getSalesAnalyticsData({ startDate, endDate }),
        getInventoryAnalyticsData({}),
        getProductionAnalyticsData({ startDate, endDate }),
      ]);

      if (ovRes.success) setOverviewData(ovRes.data);
      if (slRes.success) setSalesData(slRes.data);
      if (invRes.success) setInventoryData(invRes.data);
      if (prRes.success) setProductionData(prRes.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load report analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllReports();
  }, []);

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    loadAllReports();
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Enterprise Reporting Hub
            </h1>
            <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
              Phase 9 Authoritative
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative, multi-tenant analytics across Sales, Inventory, Production, and Financial Ledgers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadAllReports}
            disabled={loading}
            className="text-xs gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Link href="/reports/reconciliation">
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Reconciliation
            </Button>
          </Link>
          <Button
            variant="default"
            size="sm"
            onClick={() => window.print()}
            className="text-xs gap-1.5 bg-slate-900 text-white hover:bg-slate-800 print:hidden"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Report
          </Button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <form onSubmit={handleApplyFilter} className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-semibold text-slate-700">Period:</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">From:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">To:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white"
            />
          </div>
          <Button type="submit" size="sm" variant="secondary" className="text-xs">
            Apply Filters
          </Button>
        </div>
        <div className="text-xs text-slate-500">
          Aggregating strictly from database records &bull; No client-side floating point drift
        </div>
      </form>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={loadAllReports} className="underline font-semibold hover:text-red-900">
            Retry
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab("overview")}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "overview"
              ? "border-indigo-600 text-indigo-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Management Overview
        </button>
        <button
          onClick={() => setActiveTab("sales")}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "sales"
              ? "border-indigo-600 text-indigo-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          Sales Reports
        </button>
        <button
          onClick={() => setActiveTab("inventory")}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "inventory"
              ? "border-indigo-600 text-indigo-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Boxes className="w-4 h-4" />
          Inventory & Batches
        </button>
        <button
          onClick={() => setActiveTab("production")}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "production"
              ? "border-indigo-600 text-indigo-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Factory className="w-4 h-4" />
          Production & Costing
        </button>
        <button
          onClick={() => setActiveTab("finance")}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "finance"
              ? "border-indigo-600 text-indigo-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Finance & Ledgers
        </button>
      </div>

      {/* TAB 1: MANAGEMENT OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4 border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Total Sales in Period</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {formatPaisa(overviewData?.sales?.sales_total_paisa || 0)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Today: {formatPaisa(overviewData?.sales?.sales_today_paisa || 0)}
              </p>
            </Card>

            <Card className="p-4 border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Customer Outstanding</p>
              <p className="text-2xl font-bold text-amber-700 mt-1">
                {formatPaisa(overviewData?.finance?.outstanding_receivables_paisa || 0)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Collections: {formatPaisa(overviewData?.finance?.payments_received_paisa || 0)}
              </p>
            </Card>

            <Card className="p-4 border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Stock Valuation</p>
              <p className="text-2xl font-bold text-blue-700 mt-1">
                {formatPaisa(overviewData?.inventory?.stock_valuation_paisa || 0)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Expiring (30D): {overviewData?.inventory?.expiring_batches_count || 0} batches
              </p>
            </Card>

            <Card className="p-4 border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Purchases Total</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {formatPaisa(overviewData?.procurement?.purchases_total_paisa || 0)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Approved procurement POs</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Products */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-semibold text-slate-900">
                  Top Selling Products by Volume
                </CardTitle>
                <CardDescription className="text-xs">
                  Sales order lines fulfilled in the selected date range.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Product</TableHead>
                      <TableHead className="text-xs">SKU</TableHead>
                      <TableHead className="text-xs text-right">Quantity</TableHead>
                      <TableHead className="text-xs text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(overviewData?.top_products || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-6 text-xs text-slate-400">
                          No order line items found for this period.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (overviewData?.top_products || []).map((tp: any, i: number) => (
                        <TableRow key={tp.item_id || i} className="text-xs">
                          <TableCell className="font-medium text-slate-900">{tp.item_name}</TableCell>
                          <TableCell className="font-mono text-slate-500">{tp.sku}</TableCell>
                          <TableCell className="text-right font-bold text-slate-900">
                            {Number(tp.total_qty).toLocaleString()} pkts
                          </TableCell>
                          <TableCell className="text-right text-emerald-600 font-semibold font-mono">
                            {formatPaisa(tp.total_revenue_paisa)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Quick Navigation to Dedicated Ledgers */}
            <Card className="border-slate-200 shadow-sm flex flex-col justify-between">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-semibold text-slate-900">
                  Statutory & Operational Registers
                </CardTitle>
                <CardDescription className="text-xs">
                  Direct access to dedicated audit and transaction registers.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <Link
                  href="/finance/reports"
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  <div>
                    <p className="text-xs font-semibold text-slate-900">GSTR-1 Tax Summary (Table 4A & 7)</p>
                    <p className="text-[11px] text-slate-500">B2B vs B2C taxable turnover and CGST/SGST/IGST breakdown</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </Link>

                <Link
                  href="/finance/outstanding"
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  <div>
                    <p className="text-xs font-semibold text-slate-900">Receivables Aging Analysis</p>
                    <p className="text-[11px] text-slate-500">Current, 1-30, 31-60, 61-90, and 90+ days overdue analysis</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </Link>

                <Link
                  href="/inventory/valuation"
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  <div>
                    <p className="text-xs font-semibold text-slate-900">Stock Valuation by Warehouse</p>
                    <p className="text-[11px] text-slate-500">Perpetual weighted-average inventory valuation report</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: SALES REPORTS */}
      {activeTab === "sales" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Sales by Customer */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-semibold text-slate-900">
                  Sales by Customer (Top Distributors & Outlets)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Customer Name</TableHead>
                      <TableHead className="text-xs text-right">Orders</TableHead>
                      <TableHead className="text-xs text-right">Total Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(salesData?.by_customer || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-6 text-xs text-slate-400">
                          No customer sales records in this period.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (salesData?.by_customer || []).map((c: any, i: number) => (
                        <TableRow key={c.customer_id || i} className="text-xs">
                          <TableCell className="font-medium text-slate-900">{c.customer_name}</TableCell>
                          <TableCell className="text-right font-mono">{c.order_count}</TableCell>
                          <TableCell className="text-right font-mono font-semibold text-slate-900">
                            {formatPaisa(c.total_revenue_paisa)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Sales by Branch */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-semibold text-slate-900">
                  Sales by Branch / Factory
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Branch Name</TableHead>
                      <TableHead className="text-xs text-right">Orders</TableHead>
                      <TableHead className="text-xs text-right">Total Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(salesData?.by_branch || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-6 text-xs text-slate-400">
                          No branch sales records in this period.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (salesData?.by_branch || []).map((b: any, i: number) => (
                        <TableRow key={b.branch_id || i} className="text-xs">
                          <TableCell className="font-medium text-slate-900">{b.branch_name}</TableCell>
                          <TableCell className="text-right font-mono">{b.order_count}</TableCell>
                          <TableCell className="text-right font-mono font-semibold text-slate-900">
                            {formatPaisa(b.total_revenue_paisa)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 3: INVENTORY REPORTS */}
      {activeTab === "inventory" && (
        <div className="space-y-6">
          {/* Stock Summary Banner */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4 border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Total Physical Stock</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {Number(inventoryData?.summary?.total_physical_qty || 0).toLocaleString()} units
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Across all active batches</p>
            </Card>

            <Card className="p-4 border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Reserved Stock</p>
              <p className="text-2xl font-bold text-amber-700 mt-1">
                {Number(inventoryData?.summary?.total_reserved_qty || 0).toLocaleString()} units
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Locked for approved orders</p>
            </Card>

            <Card className="p-4 border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Available Stock</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">
                {Number(inventoryData?.summary?.total_available_qty || 0).toLocaleString()} units
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Eligible for new orders</p>
            </Card>

            <Card className="p-4 border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Total Valuation</p>
              <p className="text-2xl font-bold text-blue-700 mt-1">
                {formatPaisa(inventoryData?.summary?.total_valuation_paisa || 0)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Weighted average valuation</p>
            </Card>
          </div>

          {/* Expiry Schedule Card */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold text-slate-900">
                Batch Expiry Aging Schedule
              </CardTitle>
              <CardDescription className="text-xs">
                Physical batches grouped by remaining shelf life for First-Expired, First-Out (FEFO) adherence.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-center">
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-xs font-semibold text-red-800">Already Expired</p>
                  <p className="text-lg font-bold text-red-700 mt-1">
                    {Number(inventoryData?.expiry_schedule?.expired_qty || 0).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-red-600">Quarantine Required</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-xs font-semibold text-amber-800">0 – 30 Days</p>
                  <p className="text-lg font-bold text-amber-700 mt-1">
                    {Number(inventoryData?.expiry_schedule?.expiring_30_days_qty || 0).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-amber-600">Urgent Picking</p>
                </div>
                <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <p className="text-xs font-semibold text-yellow-800">31 – 60 Days</p>
                  <p className="text-lg font-bold text-yellow-700 mt-1">
                    {Number(inventoryData?.expiry_schedule?.expiring_60_days_qty || 0).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-yellow-600">Active Stock</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs font-semibold text-blue-800">61 – 90 Days</p>
                  <p className="text-lg font-bold text-blue-700 mt-1">
                    {Number(inventoryData?.expiry_schedule?.expiring_90_days_qty || 0).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-blue-600">Good Condition</p>
                </div>
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <p className="text-xs font-semibold text-emerald-800">&gt; 90 Days</p>
                  <p className="text-lg font-bold text-emerald-700 mt-1">
                    {Number(inventoryData?.expiry_schedule?.good_condition_qty || 0).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-emerald-600">Optimal Shelf Life</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 4: PRODUCTION REPORTS */}
      {activeTab === "production" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4 border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Total Production Orders</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {productionData?.summary?.total_orders || 0}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Completed: {productionData?.summary?.completed_orders || 0}
              </p>
            </Card>

            <Card className="p-4 border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Active Runs in Plant</p>
              <p className="text-2xl font-bold text-amber-700 mt-1">
                {productionData?.summary?.in_progress_orders || 0}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">In progress & reserved</p>
            </Card>

            <Card className="p-4 border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Planned Output Total</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {Number(productionData?.summary?.planned_qty_total || 0).toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Standard BOM expected output</p>
            </Card>

            <Card className="p-4 border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Actual Output Yield</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">
                {Number(productionData?.summary?.actual_qty_total || 0).toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Verified QC released batches</p>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 5: FINANCE REPORTS */}
      {activeTab === "finance" && (
        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold text-slate-900">
                Financial Ledgers & Tax Reports
              </CardTitle>
              <CardDescription className="text-xs">
                KanakkuFlow enforces exact integer paisa arithmetic with append-only ledger security.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link
                href="/finance/reports"
                className="p-4 rounded-lg border border-slate-200 hover:border-indigo-500 hover:bg-slate-50 transition-all flex flex-col justify-between"
              >
                <div>
                  <BarChart3 className="w-5 h-5 text-indigo-600 mb-2" />
                  <p className="text-sm font-semibold text-slate-900">GSTR-1 Tax Summary</p>
                  <p className="text-xs text-slate-500 mt-1">
                    B2B and B2C outward supplies categorized for monthly return filing.
                  </p>
                </div>
                <span className="text-xs font-medium text-indigo-600 mt-4 flex items-center gap-1">
                  Open GSTR-1 Register <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </Link>

              <Link
                href="/finance/outstanding"
                className="p-4 rounded-lg border border-slate-200 hover:border-indigo-500 hover:bg-slate-50 transition-all flex flex-col justify-between"
              >
                <div>
                  <Clock className="w-5 h-5 text-amber-600 mb-2" />
                  <p className="text-sm font-semibold text-slate-900">Receivables Aging Report</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Customer outstanding balances bucketed into 30, 60, 90+ days overdue.
                  </p>
                </div>
                <span className="text-xs font-medium text-amber-600 mt-4 flex items-center gap-1">
                  Open Aging Report <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </Link>

              <Link
                href="/finance/payments"
                className="p-4 rounded-lg border border-slate-200 hover:border-indigo-500 hover:bg-slate-50 transition-all flex flex-col justify-between"
              >
                <div>
                  <IndianRupee className="w-5 h-5 text-emerald-600 mb-2" />
                  <p className="text-sm font-semibold text-slate-900">Customer Collections</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Receipts, bank transfers, UPI collections, and multi-invoice payment allocations.
                  </p>
                </div>
                <span className="text-xs font-medium text-emerald-600 mt-4 flex items-center gap-1">
                  Open Payments Register <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </Link>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
