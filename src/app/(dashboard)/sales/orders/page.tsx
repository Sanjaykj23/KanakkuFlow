"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
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
  ShoppingCart,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Truck,
  Boxes,
  Loader2,
  Calendar,
  Layers,
  ArrowRight,
} from "lucide-react";
import { getSalesOrders } from "@/modules/sales/actions";
import { SalesOrder, SalesOrderStatus } from "@/types/database";

export default function SalesOrdersDirectoryPage() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const loadData = async () => {
    setLoading(true);
    const res = await getSalesOrders();
    if (res.success && res.orders) {
      setOrders(res.orders);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const getStatusBadge = (status: SalesOrderStatus) => {
    switch (status) {
      case "READY_FOR_DISPATCH":
      case "ALLOCATED":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-mono text-[11px] flex items-center gap-1">
            <Truck className="w-3 h-3" /> {status}
          </Badge>
        );
      case "APPROVED":
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 font-mono text-[11px] flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> APPROVED
          </Badge>
        );
      case "PENDING_APPROVAL":
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 font-mono text-[11px] flex items-center gap-1 animate-pulse">
            <Clock className="w-3 h-3" /> PENDING APPROVAL
          </Badge>
        );
      case "PARTIALLY_ALLOCATED":
        return (
          <Badge className="bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30 font-mono text-[11px] flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> PARTIAL ALLOC
          </Badge>
        );
      case "CANCELLED":
      case "REJECTED":
        return (
          <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 font-mono text-[11px] flex items-center gap-1">
            <XCircle className="w-3 h-3" /> {status}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="font-mono text-[11px]">
            {status}
          </Badge>
        );
    }
  };

  const filteredOrders = orders.filter((o) => {
    const matchesStatus = statusFilter === "ALL" || o.status === statusFilter;
    const orderNum = o.order_number || "";
    const customerName = o.customer?.shop_name || "";
    const ownerName = o.customer?.owner_name || "";
    const matchesSearch =
      !searchQuery.trim() ||
      orderNum.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ownerName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-primary" />
            Sales Orders &amp; Demand Pipeline
          </h1>
          <p className="text-sm text-zinc-500">
            Manage customer sales orders, FEFO stock allocation, credit validation, and dispatch preparation.
          </p>
        </div>
        <Link href="/sales/orders/new">
          <Button size="sm" className="flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            Book Sales Order
          </Button>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardHeader className="p-4 pb-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
              <Input
                placeholder="Search by order number or customer shop name..."
                className="pl-9 h-9 text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {(
                [
                  "ALL",
                  "PENDING_APPROVAL",
                  "APPROVED",
                  "PARTIALLY_ALLOCATED",
                  "READY_FOR_DISPATCH",
                  "CANCELLED",
                ] as const
              ).map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-xs font-medium"
                  onClick={() => setStatusFilter(status)}
                >
                  {status.replace(/_/g, " ")}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-50/50 dark:bg-zinc-900/50">
                <TableHead>Order #</TableHead>
                <TableHead>Customer / Shop</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Order Date</TableHead>
                <TableHead>Requested Delivery</TableHead>
                <TableHead className="text-right">Total Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                    <p className="text-xs text-zinc-500 mt-2">Loading sales orders...</p>
                  </TableCell>
                </TableRow>
              ) : filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-zinc-500">
                    <Boxes className="w-8 h-8 mx-auto text-zinc-400 mb-2" />
                    No sales orders found matching current filter.
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => {
                  const total = ((order.total_amount_paisa || 0) / 100).toFixed(2);
                  const orderDate = order.order_date
                    ? new Date(order.order_date).toLocaleDateString("en-IN")
                    : "-";
                  const delDate = order.requested_delivery_date
                    ? new Date(order.requested_delivery_date).toLocaleDateString("en-IN")
                    : "-";

                  return (
                    <TableRow key={order.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                      <TableCell className="font-mono font-medium text-xs">
                        <Link href={`/sales/orders/${order.id}`} className="hover:underline text-primary">
                          {order.order_number}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                          {order.customer?.shop_name || "Customer"}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {order.customer?.owner_name} &bull; {order.customer?.mobile_number}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-zinc-600">
                        {order.branch?.name}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-500">{orderDate}</TableCell>
                      <TableCell className="text-xs text-zinc-500">{delDate}</TableCell>
                      <TableCell className="text-right font-mono font-medium text-sm">
                        ₹{Number(total).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell className="text-right">
                        <Link href={`/sales/orders/${order.id}`}>
                          <Button variant="outline" size="sm" className="h-7 text-xs">
                            Manage &rarr;
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
