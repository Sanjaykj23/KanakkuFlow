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
  ShoppingCart,
  Plus,
  ShieldCheck,
  Tag,
  BarChart3,
  ArrowRight,
  Clock,
  Truck,
  CheckCircle2,
  Boxes,
  Loader2,
  Users,
} from "lucide-react";
import { getSalesMetrics, getSalesOrders } from "@/modules/sales/actions";
import { SalesOrder } from "@/types/database";

export default function SalesOverviewPage() {
  const [metrics, setMetrics] = useState<{
    todayBookingsCount: number;
    pendingApprovalCount: number;
    awaitingDispatchCount: number;
    totalBookedValuePaisa: number;
  } | null>(null);
  const [recentOrders, setRecentOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const [mRes, oRes] = await Promise.all([
        getSalesMetrics(),
        getSalesOrders(),
      ]);

      if (mRes.success && mRes.metrics) setMetrics(mRes.metrics);
      if (oRes.success && oRes.orders) setRecentOrders(oRes.orders.slice(0, 5));
      setLoading(false);
    }
    loadData();
  }, []);

  const totalValueRupees = ((metrics?.totalBookedValuePaisa || 0) / 100).toLocaleString(
    "en-IN",
    { maximumFractionDigits: 2 }
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-primary" />
            Field Sales &amp; Order Management
          </h1>
          <p className="text-sm text-zinc-500">
            End-to-end sales lifecycle: Customer bookings, tier pricing, credit checks, FEFO stock allocation, and dispatch.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/sales/pricing">
            <Button variant="outline" size="sm" className="flex items-center gap-1.5">
              <Tag className="w-4 h-4" />
              Price Lists
            </Button>
          </Link>
          <Link href="/sales/orders/new">
            <Button size="sm" className="flex items-center gap-1.5">
              <Plus className="w-4 h-4" />
              Book Sales Order
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Total Booked Value
            </div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1 font-mono">
              {loading ? "-" : `₹${totalValueRupees}`}
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              Active demand in pipeline
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Booked Today
            </div>
            <div className="text-2xl font-bold text-blue-600 mt-1">
              {loading ? "-" : metrics?.todayBookingsCount || 0}
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              New orders taken today
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Pending Approval
            </div>
            <div className="text-2xl font-bold text-amber-600 mt-1">
              {loading ? "-" : metrics?.pendingApprovalCount || 0}
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              Credit / discount approvals
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Awaiting Dispatch
            </div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">
              {loading ? "-" : metrics?.awaitingDispatchCount || 0}
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              FEFO allocated &amp; ready
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Modules */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/sales/orders" className="group">
          <Card className="h-full border hover:border-primary/50 transition-all hover:shadow-md">
            <CardHeader>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-2 group-hover:scale-105 transition-transform">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Sales Orders Pipeline</span>
                <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-primary transition-colors" />
              </CardTitle>
              <CardDescription className="text-xs">
                Track all distributor and retail orders from booking to FEFO reservation and warehouse dispatch.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-primary font-medium flex items-center gap-1">
              View All Orders &rarr;
            </CardContent>
          </Card>
        </Link>

        <Link href="/sales/approvals" className="group">
          <Card className="h-full border hover:border-primary/50 transition-all hover:shadow-md">
            <CardHeader>
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 mb-2 group-hover:scale-105 transition-transform">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Manager Approval Queue</span>
                <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-primary transition-colors" />
              </CardTitle>
              <CardDescription className="text-xs">
                Review orders exceeding credit limits, threshold value, or high salesman discounts before releasing to warehouse.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-amber-600 font-medium flex items-center gap-1">
              Review Pending Approvals &rarr;
            </CardContent>
          </Card>
        </Link>

        <Link href="/sales/pricing" className="group">
          <Card className="h-full border hover:border-primary/50 transition-all hover:shadow-md">
            <CardHeader>
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-600 mb-2 group-hover:scale-105 transition-transform">
                <Tag className="w-5 h-5" />
              </div>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Price Lists &amp; Contracts</span>
                <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-primary transition-colors" />
              </CardTitle>
              <CardDescription className="text-xs">
                Configure standard company price lists, distributor discount slabs, and customer-specific contract prices.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-purple-600 font-medium flex items-center gap-1">
              Manage Pricing &rarr;
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent Orders Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base">Recent Sales Bookings</CardTitle>
            <CardDescription className="text-xs">
              Live status across retail shop orders and distributor dispatches.
            </CardDescription>
          </div>
          <Link href="/sales/orders">
            <Button variant="ghost" size="sm" className="text-xs">
              View All Orders &rarr;
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-zinc-500 text-xs">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary mb-2" />
              Loading sales orders...
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="py-8 text-center text-zinc-500 text-xs">
              <Boxes className="w-8 h-8 mx-auto text-zinc-400 mb-2" />
              No sales orders booked yet. Click &quot;Book Sales Order&quot; to begin.
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {recentOrders.map((order) => {
                const totalRupees = ((order.total_amount_paisa || 0) / 100).toFixed(2);
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
                          {order.customer?.shop_name || "Customer"}
                        </Badge>
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        Branch: {order.branch?.name} &bull; Delivery: {new Date(order.requested_delivery_date).toLocaleDateString("en-IN")} &bull; Items: {order.lines?.length || 0}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="font-mono font-medium text-sm text-zinc-900 dark:text-zinc-100">
                        ₹{Number(totalRupees).toLocaleString("en-IN")}
                      </div>
                      <Badge className="font-mono text-xs">{order.status}</Badge>
                      <Link href={`/sales/orders/${order.id}`}>
                        <Button variant="outline" size="sm" className="h-7 text-xs">
                          Details
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
