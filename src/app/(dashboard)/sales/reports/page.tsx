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
  BarChart3,
  TrendingUp,
  ShoppingCart,
  Users,
  Boxes,
  Truck,
  AlertTriangle,
  Loader2,
  Calendar,
  FileSpreadsheet,
} from "lucide-react";
import { getSalesOrders } from "@/modules/sales/actions";
import { SalesOrder } from "@/types/database";

export default function SalesReportsPage() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const res = await getSalesOrders();
      if (res.success && res.orders) {
        setOrders(res.orders);
      }
      setLoading(false);
    }
    loadData();
  }, []);

  // Compute Aggregations
  // 1. By Status
  const statusCounts: Record<string, { count: number; totalPaisa: number }> = {};
  orders.forEach((o) => {
    if (!statusCounts[o.status]) statusCounts[o.status] = { count: 0, totalPaisa: 0 };
    statusCounts[o.status].count += 1;
    statusCounts[o.status].totalPaisa += o.total_amount_paisa || 0;
  });

  // 2. By Customer
  const customerMap: Record<string, { name: string; count: number; totalPaisa: number }> = {};
  orders.forEach((o) => {
    const custId = o.customer_id;
    const name = o.customer?.shop_name || "Unknown Shop";
    if (!customerMap[custId]) customerMap[custId] = { name, count: 0, totalPaisa: 0 };
    customerMap[custId].count += 1;
    customerMap[custId].totalPaisa += o.total_amount_paisa || 0;
  });
  const customerRankings = Object.values(customerMap).sort((a, b) => b.totalPaisa - a.totalPaisa);

  // 3. By Salesman
  const salesmanMap: Record<string, { email: string; count: number; totalPaisa: number }> = {};
  orders.forEach((o) => {
    const smId = o.assigned_salesman_id || "unassigned";
    const email = o.salesman?.email || "Direct Booking";
    if (!salesmanMap[smId]) salesmanMap[smId] = { email, count: 0, totalPaisa: 0 };
    salesmanMap[smId].count += 1;
    salesmanMap[smId].totalPaisa += o.total_amount_paisa || 0;
  });
  const salesmanRankings = Object.values(salesmanMap).sort((a, b) => b.totalPaisa - a.totalPaisa);

  // 4. By Item SKU Demand
  const itemMap: Record<string, { name: string; sku: string; qty: number; valuePaisa: number }> = {};
  orders.forEach((o) => {
    if (["CANCELLED", "REJECTED"].includes(o.status)) return;
    (o.lines || []).forEach((l) => {
      const key = l.item_id;
      const name = l.item?.name || l.sku;
      if (!itemMap[key]) itemMap[key] = { name, sku: l.sku, qty: 0, valuePaisa: 0 };
      itemMap[key].qty += Number(l.ordered_qty || 0);
      itemMap[key].valuePaisa += l.line_total_paisa || 0;
    });
  });
  const itemRankings = Object.values(itemMap).sort((a, b) => b.qty - a.qty);

  return (
    <div className="space-y-6 pb-16 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            Sales &amp; Demand Performance Reports
          </h1>
          <p className="text-sm text-zinc-500">
            Pipeline order performance, territory demand trends, customer sales volume, and SKU velocity.
          </p>
        </div>
      </div>

      {/* Accounting Notice Banner */}
      <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-800 dark:text-blue-300 flex items-center gap-2">
        <ShoppingCart className="w-4 h-4 text-blue-600 flex-shrink-0" />
        <span>
          <strong>Important Note:</strong> Values presented in this module represent committed sales demand and pipeline bookings. Realized accounting revenue, GST tax liability, and receivables belong to Phase 7 Invoicing.
        </span>
      </div>

      {/* Top Level Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* By Status Breakdown */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-primary" />
              Pipeline by Order Status
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-2 text-xs">
            {Object.entries(statusCounts).map(([status, data]) => (
              <div key={status} className="flex justify-between items-center py-1 border-b last:border-b-0">
                <span className="font-mono text-[11px]">{status}</span>
                <div className="text-right">
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {data.count} Orders
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono">
                    ₹{(data.totalPaisa / 100).toLocaleString("en-IN")}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* By Salesman Performance */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <Users className="w-4 h-4 text-blue-600" />
              Salesman Bookings
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-2 text-xs">
            {salesmanRankings.map((sm, idx) => (
              <div key={idx} className="flex justify-between items-center py-1 border-b last:border-b-0">
                <div>
                  <div className="font-semibold text-zinc-800 dark:text-zinc-200">{sm.email}</div>
                  <div className="text-[10px] text-zinc-500">{sm.count} Orders Booked</div>
                </div>
                <div className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                  ₹{(sm.totalPaisa / 100).toLocaleString("en-IN")}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Top Customers */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <ShoppingCart className="w-4 h-4 text-emerald-600" />
              Top Customer Accounts
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-2 text-xs">
            {customerRankings.slice(0, 5).map((cust, idx) => (
              <div key={idx} className="flex justify-between items-center py-1 border-b last:border-b-0">
                <div>
                  <div className="font-semibold text-zinc-800 dark:text-zinc-200">{cust.name}</div>
                  <div className="text-[10px] text-zinc-500">{cust.count} Orders</div>
                </div>
                <div className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                  ₹{(cust.totalPaisa / 100).toLocaleString("en-IN")}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Product SKU Demand Velocity */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Boxes className="w-4 h-4 text-primary" />
            Product Demand Velocity (Packaged Snacks)
          </CardTitle>
          <CardDescription className="text-xs">
            Total quantities booked across active sales orders (excluding cancellations).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-50/50 dark:bg-zinc-900/50">
                <TableHead>SKU</TableHead>
                <TableHead>Product Name</TableHead>
                <TableHead className="text-right">Total Units Booked</TableHead>
                <TableHead className="text-right">Committed Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" />
                    <p className="text-xs text-zinc-500 mt-1">Calculating SKU demand...</p>
                  </TableCell>
                </TableRow>
              ) : itemRankings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-zinc-500 text-xs">
                    No product demand recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                itemRankings.map((it, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono text-xs font-semibold">{it.sku}</TableCell>
                    <TableCell className="text-sm font-medium">{it.name}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-emerald-600">
                      {it.qty.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ₹{(it.valuePaisa / 100).toLocaleString("en-IN")}
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
