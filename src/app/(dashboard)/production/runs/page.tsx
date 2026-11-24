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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Factory,
  Plus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Layers,
  Package,
} from "lucide-react";
import { getProductionOrders, getProductionMetrics } from "@/modules/production/actions";
import { ProductionOrder, ProductionOrderStatus } from "@/types/database";

export default function ProductionRunsPage() {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [selectedStatus, setSelectedStatus] = useState<"ALL" | ProductionOrderStatus>("ALL");
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const [ordersRes, metricsRes] = await Promise.all([
      getProductionOrders(selectedStatus === "ALL" ? undefined : selectedStatus),
      getProductionMetrics(),
    ]);

    if (ordersRes.success && ordersRes.orders) {
      setOrders(ordersRes.orders);
    }
    if (metricsRes.success && metricsRes.metrics) {
      setMetrics(metricsRes.metrics);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [selectedStatus]);

  const getStatusBadge = (status: ProductionOrderStatus) => {
    switch (status) {
      case "COMPLETED":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Completed
          </Badge>
        );
      case "IN_PROGRESS":
        return (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300">
            <Factory className="w-3 h-3 mr-1" /> In Progress
          </Badge>
        );
      case "MATERIAL_RESERVED":
        return (
          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
            <Clock className="w-3 h-3 mr-1" /> Materials Reserved
          </Badge>
        );
      case "APPROVED":
        return <Badge variant="outline" className="border-blue-400 text-blue-700">Approved</Badge>;
      case "CANCELLED":
      case "REJECTED":
        return <Badge variant="destructive">{status}</Badge>;
      case "DRAFT":
      default:
        return <Badge variant="outline">Draft</Badge>;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Factory className="w-6 h-6 text-primary" />
            Production Orders & Shop Floor
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Two-stage food manufacturing: Stage 1 Bulk Frying & Stage 2 Packaging into Retail SKUs.
          </p>
        </div>

        <Link href="/production/runs/new">
          <Button className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Production Order
          </Button>
        </Link>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="py-3 px-4 pb-1">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Active Work Orders
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 py-2">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {metrics ? metrics.activeOrdersCount : "—"}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">In progress on shop floor</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3 px-4 pb-1">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Completed Runs
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 py-2">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {metrics ? metrics.completedOrdersCount : "—"}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">Finished output batches</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3 px-4 pb-1">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Stage Breakdown
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 py-2">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
                {metrics?.bulkRunsCount || 0}
              </span>
              <span className="text-xs text-zinc-400">Bulk WIP</span>
              <span className="text-zinc-300">|</span>
              <span className="text-xl font-bold font-mono text-primary">
                {metrics?.packagingRunsCount || 0}
              </span>
              <span className="text-xs text-zinc-400">Packaging</span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">Two-stage manufacturing runs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3 px-4 pb-1">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-primary">
              Total Manufacturing Cost
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 py-2">
            <div className="text-2xl font-bold font-mono text-primary">
              ₹{metrics ? ((metrics.totalProductionSpendPaisa || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "—"}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">Raw materials & overhead consumed</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-1.5">
            {(["ALL", "APPROVED", "MATERIAL_RESERVED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const).map((st) => (
              <button
                key={st}
                onClick={() => setSelectedStatus(st)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  selectedStatus === st
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                }`}
              >
                {st === "ALL" ? "All Orders" : st.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Orders Directory Table */}
      <Card>
        <CardHeader className="py-4 px-6 border-b border-zinc-200 dark:border-zinc-800">
          <CardTitle className="text-base font-semibold">Production Work Orders</CardTitle>
          <CardDescription className="text-xs">
            Showing {orders.length} work orders
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-50 dark:bg-zinc-900/50">
                <TableHead className="text-xs font-semibold">Order #</TableHead>
                <TableHead className="text-xs font-semibold">Output Product</TableHead>
                <TableHead className="text-xs font-semibold">Stage</TableHead>
                <TableHead className="text-xs font-semibold">BOM Recipe</TableHead>
                <TableHead className="text-xs font-semibold text-right">Planned Qty</TableHead>
                <TableHead className="text-xs font-semibold text-right">Produced Qty</TableHead>
                <TableHead className="text-xs font-semibold">Warehouse</TableHead>
                <TableHead className="text-xs font-semibold">Status</TableHead>
                <TableHead className="text-xs font-semibold text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center gap-2 text-zinc-500">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <span className="text-xs">Loading production orders...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-zinc-500">
                    <Factory className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
                    <p className="text-sm font-medium">No production orders found</p>
                    <p className="text-xs text-zinc-400">Initiate a work order from an approved BOM recipe.</p>
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((o) => (
                  <TableRow key={o.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                    <TableCell className="font-mono font-bold text-xs text-primary">
                      {o.order_number}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{o.product?.name}</div>
                      <div className="text-[10px] font-mono text-zinc-500">{o.product?.code}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-mono">
                        {o.order_type === "BULK_PRODUCTION" ? "Stage 1 (Bulk WIP)" : "Stage 2 (Packaging)"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {o.bom?.bom_number} ({o.bom?.version})
                    </TableCell>
                    <TableCell className="text-xs text-right font-mono font-bold">
                      {o.planned_qty} {o.unit?.symbol}
                    </TableCell>
                    <TableCell className="text-xs text-right font-mono font-bold text-emerald-600">
                      {o.produced_qty} {o.unit?.symbol}
                    </TableCell>
                    <TableCell className="text-xs text-zinc-600 dark:text-zinc-400">
                      {o.finished_warehouse?.name}
                    </TableCell>
                    <TableCell>{getStatusBadge(o.status)}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/production/runs/${o.id}`}>
                        <Button variant="ghost" size="sm" className="h-7 text-xs flex items-center gap-1">
                          <span>Execute Run</span>
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
