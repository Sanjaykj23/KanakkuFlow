"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Boxes,
  QrCode,
  ArrowLeftRight,
  Sliders,
  AlertOctagon,
  TrendingUp,
  Search,
  Loader2,
  Warehouse,
  Package,
  ShieldAlert,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
} from "lucide-react";
import {
  getInventoryDashboardMetrics,
  getStockSummary,
} from "@/modules/inventory/actions";
import { getCompanyBranches } from "@/modules/users/actions";
import { getWarehouses } from "@/modules/master/actions";
import { Warehouse as WarehouseType } from "@/types/database";

export default function InventoryDashboardPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [summary, setSummary] = useState<any[]>([]);
  const [branches, setBranches] = useState<{ id: string; code: string; name: string }[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);

  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const [metricsRes, summaryRes, branchList, whRes] = await Promise.all([
      getInventoryDashboardMetrics({
        branchId: selectedBranch || undefined,
        warehouseId: selectedWarehouse || undefined,
        category: selectedCategory || undefined,
      }),
      getStockSummary({
        warehouseId: selectedWarehouse || undefined,
        category: selectedCategory || undefined,
        search: searchQuery || undefined,
      }),
      getCompanyBranches(),
      getWarehouses(),
    ]);

    if (metricsRes.success && metricsRes.metrics) {
      setMetrics(metricsRes.metrics);
    }
    if (summaryRes.success && summaryRes.summary) {
      setSummary(summaryRes.summary);
    }
    setBranches(branchList);
    if (whRes.success && whRes.warehouses) {
      setWarehouses(whRes.warehouses);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [selectedBranch, selectedWarehouse, selectedCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Boxes className="w-6 h-6 text-primary" />
            Inventory & Batch Management
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Real-time stock valuation, physical FEFO batch tracking, reservations, and inter-warehouse logistics.
          </p>
        </div>

        {/* Quick Action Navigation Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/inventory/transfers">
            <Button variant="outline" size="sm" className="flex items-center gap-1.5 text-xs">
              <ArrowLeftRight className="w-3.5 h-3.5" /> Stock Transfers
            </Button>
          </Link>
          <Link href="/inventory/adjustments">
            <Button variant="outline" size="sm" className="flex items-center gap-1.5 text-xs">
              <Sliders className="w-3.5 h-3.5" /> Adjustments
            </Button>
          </Link>
          <Link href="/inventory/expiry">
            <Button variant="outline" size="sm" className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <AlertOctagon className="w-3.5 h-3.5" /> Expiry Alerts
            </Button>
          </Link>
          <Link href="/inventory/batches">
            <Button size="sm" className="flex items-center gap-1.5 text-xs">
              <QrCode className="w-3.5 h-3.5" /> Batches (FEFO)
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="py-3 px-4 pb-1">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Total On-Hand Stock
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 py-2">
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {metrics ? metrics.totalOnHandQty.toLocaleString("en-IN") : "—"}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">Physical items across warehouses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3 px-4 pb-1">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-primary">
              Total Stock Valuation
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 py-2">
            <div className="text-2xl font-bold text-primary font-mono">
              ₹{metrics ? ((metrics.totalValuationPaisa || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "—"}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">Weighted-average financial asset value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3 px-4 pb-1">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Available For Allocation
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 py-2">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {metrics ? metrics.availableStockQty.toLocaleString("en-IN") : "—"}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-0.5">
              <span>Reserved: {metrics?.reservedStockQty || 0}</span>
              <span>•</span>
              <span>QC Hold: {metrics?.qcPendingStockQty || 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3 px-4 pb-1">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Expiry Watchlist
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 py-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-red-600 dark:text-red-400">
                {metrics?.expiredBatchesCount || 0}
              </span>
              <span className="text-xs text-zinc-400">Expired</span>
              <span className="text-zinc-300">|</span>
              <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {metrics?.nearExpiryBatchesCount || 0}
              </span>
              <span className="text-xs text-zinc-400">&lt;30d</span>
            </div>
            <Link
              href="/inventory/expiry"
              className="text-[11px] text-amber-600 hover:underline flex items-center gap-0.5 mt-0.5"
            >
              <span>View high-risk batches</span>
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="h-9 px-3 text-xs bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>

              <select
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                className="h-9 px-3 text-xs bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">All Warehouses</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </select>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-9 px-3 text-xs bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">All Categories</option>
                <option value="RAW_MATERIAL">Raw Materials (Flour, Oil, Spices)</option>
                <option value="PACKAGING">Packaging (Pouches, Boxes)</option>
                <option value="WIP">Bulk WIP (Unpackaged Murukku)</option>
                <option value="FINISHED_GOODS">Finished Goods (Retail Packs)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full md:w-64">
                <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-zinc-400" />
                <Input
                  type="text"
                  placeholder="Search item SKU or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9 text-xs"
                />
              </div>
              <Button type="submit" variant="secondary" size="sm" className="h-9 text-xs">
                Filter
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Main Grid: Stock Summary Table & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Stock Summary Table */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="py-4 px-6 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Stock Summary</CardTitle>
                  <CardDescription className="text-xs">
                    Aggregated physical on-hand, reserved, and unencumbered available stock
                  </CardDescription>
                </div>
                <Link href="/inventory/valuation" className="text-xs text-primary hover:underline flex items-center gap-1">
                  <span>Valuation Breakdown</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-zinc-50 dark:bg-zinc-900/50">
                      <TableHead className="text-xs font-semibold">Item SKU & Name</TableHead>
                      <TableHead className="text-xs font-semibold">Warehouse</TableHead>
                      <TableHead className="text-xs font-semibold text-right">On-Hand</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Reserved</TableHead>
                      <TableHead className="text-xs font-semibold text-right text-emerald-600 dark:text-emerald-400">Available</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Valuation (₹)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12">
                          <div className="flex flex-col items-center justify-center gap-2 text-zinc-500">
                            <Loader2 className="w-5 h-5 animate-spin text-primary" />
                            <span className="text-xs">Loading live inventory summary...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : summary.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-zinc-500">
                          <Package className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
                          <p className="text-sm font-medium">No stock records found</p>
                          <p className="text-xs text-zinc-400">Receive goods via GRN or post an opening stock adjustment.</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      summary.map((row) => (
                        <TableRow key={`${row.itemId}_${row.warehouseId}`} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                          <TableCell>
                            <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{row.itemName}</div>
                            <div className="text-[10px] font-mono text-zinc-500">{row.itemCode}</div>
                          </TableCell>
                          <TableCell className="text-xs text-zinc-600 dark:text-zinc-400">
                            {row.warehouseName}
                          </TableCell>
                          <TableCell className="text-xs text-right font-mono font-semibold">
                            {row.onHandQty} {row.unitSymbol}
                          </TableCell>
                          <TableCell className="text-xs text-right font-mono text-zinc-500">
                            {row.reservedQty > 0 ? `${row.reservedQty} ${row.unitSymbol}` : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {row.availableQty} {row.unitSymbol}
                          </TableCell>
                          <TableCell className="text-xs text-right font-mono text-zinc-900 dark:text-zinc-100">
                            ₹{(row.valuationPaisa / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right 1 Col: Recent Stock Movements Ledger Feed */}
        <div>
          <Card>
            <CardHeader className="py-4 px-6 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Recent Stock Ledger</CardTitle>
                  <CardDescription className="text-xs">Immutable audit trail</CardDescription>
                </div>
                <Link href="/inventory/stock" className="text-xs text-primary hover:underline">
                  Full Ledger
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {metrics?.recentMovements?.length === 0 ? (
                <div className="text-center py-8 text-xs text-zinc-400">
                  No stock movements recorded yet.
                </div>
              ) : (
                metrics?.recentMovements?.map((m: any) => {
                  const isPositive = Number(m.quantity) > 0;
                  return (
                    <div
                      key={m.id}
                      className="p-2.5 rounded border border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/30 flex items-start justify-between gap-2 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {m.item?.name || "Item"}
                        </div>
                        <div className="text-[10px] text-zinc-500">
                          {m.warehouse?.name} • {m.movement_type.replace(/_/g, " ")}
                        </div>
                        {m.batch?.batch_number && (
                          <div className="text-[10px] font-mono text-primary">
                            Batch: {m.batch.batch_number}
                          </div>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <div
                          className={`font-mono font-bold flex items-center justify-end ${
                            isPositive
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {isPositive ? (
                            <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                          ) : (
                            <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                          )}
                          {isPositive ? `+${m.quantity}` : m.quantity} {m.base_unit?.symbol}
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
