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
  Factory,
  ChefHat,
  PlayCircle,
  FlaskConical,
  TrendingUp,
  Boxes,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Sparkles,
} from "lucide-react";
import {
  getProductionMetrics,
  getProductionOrders,
} from "@/modules/production/actions";
import { ProductionOrder } from "@/types/database";

export default function ProductionOverviewPage() {
  const [metrics, setMetrics] = useState<{
    activeOrdersCount: number;
    completedOrdersCount: number;
    totalProductionSpendPaisa: number;
    bulkRunsCount: number;
    packagingRunsCount: number;
  } | null>(null);
  const [recentOrders, setRecentOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const [mRes, oRes] = await Promise.all([
        getProductionMetrics(),
        getProductionOrders(),
      ]);

      if (mRes.success && mRes.metrics) setMetrics(mRes.metrics);
      if (oRes.success && oRes.orders) setRecentOrders(oRes.orders.slice(0, 5));
      setLoading(false);
    }
    loadData();
  }, []);

  const totalSpendRupees = ((metrics?.totalProductionSpendPaisa || 0) / 100).toLocaleString(
    "en-IN",
    { maximumFractionDigits: 2 }
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Factory className="w-6 h-6 text-primary" />
            Manufacturing & Production Operations
          </h1>
          <p className="text-sm text-zinc-500">
            Two-stage food manufacturing: Bulk frying &amp; blending, packaging runs, BOM recipe yields, and QC release.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/production/recipes/new">
            <Button variant="outline" size="sm" className="flex items-center gap-1.5">
              <ChefHat className="w-4 h-4" />
              New Recipe (BOM)
            </Button>
          </Link>
          <Link href="/production/runs/new">
            <Button size="sm" className="flex items-center gap-1.5">
              <PlayCircle className="w-4 h-4" />
              Launch Work Order
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Total Production Cost
            </div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1 font-mono">
              {loading ? "-" : `₹${totalSpendRupees}`}
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              Accumulated cost of outputs
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Active Work Orders
            </div>
            <div className="text-2xl font-bold text-amber-600 mt-1">
              {loading ? "-" : metrics?.activeOrdersCount || 0}
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              Reserved &amp; in-progress runs
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Stage 1 Bulk Runs
            </div>
            <div className="text-2xl font-bold text-blue-600 mt-1">
              {loading ? "-" : metrics?.bulkRunsCount || 0}
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              Bulk dough mixing &amp; frying
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Stage 2 Packaging Runs
            </div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">
              {loading ? "-" : metrics?.packagingRunsCount || 0}
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              Pouch nitrogen packaging
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Modules Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/production/recipes" className="group">
          <Card className="h-full border hover:border-primary/50 transition-all hover:shadow-md">
            <CardHeader>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-2 group-hover:scale-105 transition-transform">
                <ChefHat className="w-5 h-5" />
              </div>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Recipe &amp; BOM Studio</span>
                <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-primary transition-colors" />
              </CardTitle>
              <CardDescription className="text-xs">
                Maintain standard ingredient recipes, component types (Raw, Packaging, Bulk WIP), expected yields, and anti-circular versioning.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-primary font-medium flex items-center gap-1">
              Explore Recipes &rarr;
            </CardContent>
          </Card>
        </Link>

        <Link href="/production/runs" className="group">
          <Card className="h-full border hover:border-primary/50 transition-all hover:shadow-md">
            <CardHeader>
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 mb-2 group-hover:scale-105 transition-transform">
                <PlayCircle className="w-5 h-5" />
              </div>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Work Orders Execution</span>
                <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-primary transition-colors" />
              </CardTitle>
              <CardDescription className="text-xs">
                Stage 1 &amp; Stage 2 production dispatch, atomic FEFO batch reservation, material consumption, and output logging.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-blue-600 font-medium flex items-center gap-1">
              View Active Orders &rarr;
            </CardContent>
          </Card>
        </Link>

        <Link href="/production/qc" className="group">
          <Card className="h-full border hover:border-primary/50 transition-all hover:shadow-md">
            <CardHeader>
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 mb-2 group-hover:scale-105 transition-transform">
                <FlaskConical className="w-5 h-5" />
              </div>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Quality Control &amp; Release</span>
                <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-primary transition-colors" />
              </CardTitle>
              <CardDescription className="text-xs">
                Sensory tests, moisture checks, free fatty acid analysis, and mandatory QC sign-off before unlocking batches for dispatch.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-emerald-600 font-medium flex items-center gap-1">
              Inspect Batches &rarr;
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent Production Orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base">Recent Production Work Orders</CardTitle>
            <CardDescription className="text-xs">
              Live status across Stage 1 bulk and Stage 2 retail packaging runs.
            </CardDescription>
          </div>
          <Link href="/production/runs">
            <Button variant="ghost" size="sm" className="text-xs">
              View All Runs &rarr;
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-zinc-500 text-xs">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary mb-2" />
              Loading production activity...
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="py-8 text-center text-zinc-500 text-xs">
              <Boxes className="w-8 h-8 mx-auto text-zinc-400 mb-2" />
              No production orders created yet.
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {recentOrders.map((order) => {
                const stageLabel =
                  order.order_type === "BULK_PRODUCTION" ? "Stage 1 (Bulk)" : "Stage 2 (Packaging)";
                return (
                  <div
                    key={order.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-xs text-zinc-900 dark:text-zinc-100">
                          {order.order_number}
                        </span>
                        <Badge variant="outline" className="text-[10px] py-0 font-normal">
                          {stageLabel}
                        </Badge>
                      </div>
                      <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200 mt-0.5">
                        {order.product?.name || "Product"}
                      </div>
                      <div className="text-xs text-zinc-500">
                        Planned: {Number(order.planned_qty).toLocaleString()} {order.product?.primary_unit?.symbol} &bull; Target: {order.finished_warehouse?.name || "Warehouse"}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="font-mono text-xs">{order.status}</Badge>
                      <Link href={`/production/runs/${order.id}`}>
                        <Button variant="outline" size="sm" className="h-7 text-xs">
                          Execution Hub
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
