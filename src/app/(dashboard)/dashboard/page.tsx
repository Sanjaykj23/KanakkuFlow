"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { MetricCard } from "@/components/shared/metric-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Factory,
  Package,
  TrendingUp,
  AlertTriangle,
  QrCode,
  ShieldCheck,
  IndianRupee,
  ShoppingBag,
  Clock,
  ArrowRight,
  RefreshCw,
  FileSpreadsheet,
  AlertOctagon,
  Boxes,
} from "lucide-react";
import { formatPaisa } from "@/lib/utils";
import { getManagementDashboardData } from "@/modules/reports/actions";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getManagementDashboardData();
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(res.error || "Failed to load dashboard metrics");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const sales = data?.sales || {};
  const finance = data?.finance || {};
  const inventory = data?.inventory || {};
  const production = data?.production || {};
  const recentOrders = data?.recent_orders || [];
  const topProducts = data?.top_products || [];

  return (
    <div className="space-y-6">
      {/* Page Title & Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Manufacturing Operations Cockpit
            </h1>
            <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
              Live Production
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative real-time aggregation across inventory batches, production runs, sales orders, and financial ledgers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="text-xs gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Link href="/reports">
            <Button size="sm" className="text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Unified Reports Hub
            </Button>
          </Link>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={loadData} className="underline font-semibold hover:text-red-900">
            Retry
          </button>
        </div>
      )}

      {/* Primary KPI Grid (Integer Paisa Authoritative Arithmetic) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Today's Sales"
          value={formatPaisa(sales.sales_today_paisa || 0)}
          subtitle={`MTD: ${formatPaisa(sales.sales_month_paisa || 0)}`}
          icon={<IndianRupee className="w-4 h-4 text-emerald-600" />}
        />
        <MetricCard
          title="Customer Receivables"
          value={formatPaisa(finance.outstanding_receivables_paisa || 0)}
          subtitle="Net Authoritative Ledger Balance"
          icon={<Clock className="w-4 h-4 text-amber-600" />}
        />
        <MetricCard
          title="Inventory Valuation"
          value={formatPaisa(inventory.stock_valuation_paisa || 0)}
          subtitle="Active Physical Batches Cost"
          icon={<Boxes className="w-4 h-4 text-blue-600" />}
        />
        <MetricCard
          title="Active Production"
          value={`${production.active_runs_count || 0} Runs`}
          subtitle={`${production.completed_runs_count || 0} Runs Completed`}
          icon={<Factory className="w-4 h-4 text-purple-600" />}
        />
      </div>

      {/* Secondary Operational Counters */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-slate-200 shadow-sm p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Orders</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{sales.pending_orders_count || 0}</p>
            <p className="text-xs text-slate-500 mt-0.5">Awaiting allocation & dispatch</p>
          </div>
          <Link href="/sales/orders" className="p-3 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors">
            <ShoppingBag className="w-5 h-5" />
          </Link>
        </Card>

        <Card className="border-slate-200 shadow-sm p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Batches Expiring (30D)</p>
            <p className="text-2xl font-bold text-amber-700 mt-1">{inventory.expiring_batches_count || 0}</p>
            <p className="text-xs text-slate-500 mt-0.5">Prioritized for FEFO picking</p>
          </div>
          <Link href="/inventory/expiry" className="p-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors">
            <AlertOctagon className="w-5 h-5" />
          </Link>
        </Card>

        <Card className="border-slate-200 shadow-sm p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Collections Received</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{formatPaisa(finance.payments_received_paisa || 0)}</p>
            <p className="text-xs text-slate-500 mt-0.5">Last 30 days remittances</p>
          </div>
          <Link href="/finance/payments" className="p-3 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors">
            <TrendingUp className="w-5 h-5" />
          </Link>
        </Card>
      </div>

      {/* Two Column Layout: Recent Orders & Top Selling Products */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-7">
        {/* Left Column: Recent Orders (4 Cols) */}
        <Card className="lg:col-span-4 border-slate-200 shadow-sm">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-indigo-600" />
                  Recent Sales Orders
                </CardTitle>
                <CardDescription className="text-xs">
                  Latest customer orders submitted for approval and fulfillment.
                </CardDescription>
              </div>
              <Link href="/sales/orders" className="text-xs text-indigo-600 hover:underline font-medium flex items-center gap-1">
                View all orders <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Order #</TableHead>
                  <TableHead className="text-xs">Customer</TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs text-right">Amount</TableHead>
                  <TableHead className="text-xs text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-xs text-slate-400">
                      No sales orders found.
                    </TableCell>
                  </TableRow>
                ) : (
                  recentOrders.map((ord: any) => (
                    <TableRow key={ord.id} className="hover:bg-slate-50 font-mono text-xs">
                      <TableCell className="font-semibold text-indigo-600">
                        <Link href={`/sales/orders/${ord.id}`} className="hover:underline">
                          {ord.order_number}
                        </Link>
                      </TableCell>
                      <TableCell className="font-sans font-medium text-slate-900 max-w-xs truncate">
                        {ord.customer_name}
                      </TableCell>
                      <TableCell className="text-slate-600 whitespace-nowrap">{ord.order_date}</TableCell>
                      <TableCell className="text-right font-semibold text-slate-900">
                        {formatPaisa(ord.total_amount_paisa)}
                      </TableCell>
                      <TableCell className="text-center font-sans">
                        <Badge
                          variant={
                            ord.status === "DISPATCHED"
                              ? "success"
                              : ord.status === "READY_FOR_DISPATCH"
                              ? "outline"
                              : ord.status === "APPROVED"
                              ? "default"
                              : "secondary"
                          }
                          className="text-[10px]"
                        >
                          {ord.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Right Column: Top Products & Fast Navigation (3 Cols) */}
        <Card className="lg:col-span-3 border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    Top Products by Demand
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Packaged snacks with highest ordered volume.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {topProducts.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">
                  No sales order line records found for this period.
                </div>
              ) : (
                topProducts.map((p: any, idx: number) => (
                  <div key={p.item_id || idx} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-100 font-bold flex items-center justify-center text-[10px] text-slate-600">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="font-semibold text-slate-900">{p.item_name}</p>
                        <p className="text-[10px] font-mono text-slate-400">{p.sku}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900">{Number(p.total_qty).toLocaleString()} pkts</p>
                      <p className="text-[10px] font-medium text-emerald-600">{formatPaisa(p.total_revenue_paisa)}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </div>

          <div className="p-4 bg-slate-50 border-t rounded-b-lg">
            <p className="text-xs font-semibold text-slate-700 mb-2">Operations Quick Links</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Link href="/production/runs" className="p-2 bg-white rounded border hover:bg-indigo-50 hover:text-indigo-600 transition-colors font-medium text-slate-700 text-center">
                Production Runs
              </Link>
              <Link href="/inventory/batches" className="p-2 bg-white rounded border hover:bg-indigo-50 hover:text-indigo-600 transition-colors font-medium text-slate-700 text-center">
                FEFO Batches
              </Link>
              <Link href="/finance/invoices" className="p-2 bg-white rounded border hover:bg-indigo-50 hover:text-indigo-600 transition-colors font-medium text-slate-700 text-center">
                GST Invoices
              </Link>
              <Link href="/reports" className="p-2 bg-white rounded border hover:bg-indigo-50 hover:text-indigo-600 transition-colors font-medium text-slate-700 text-center">
                Detailed Reports
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
