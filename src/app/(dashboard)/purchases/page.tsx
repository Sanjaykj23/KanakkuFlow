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
  FileSpreadsheet,
  Plus,
  Search,
  Eye,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  Ban,
  Loader2,
  DollarSign,
  Package,
} from "lucide-react";
import { getPurchaseOrders } from "@/modules/purchases/actions";
import { getCompanyBranches } from "@/modules/users/actions";
import { PurchaseOrder, PurchaseOrderStatus } from "@/types/database";

export default function PurchaseOrdersPage() {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [branches, setBranches] = useState<{ id: string; code: string; name: string }[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"ALL" | PurchaseOrderStatus>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const [poRes, branchList] = await Promise.all([
      getPurchaseOrders(
        selectedStatus === "ALL" ? undefined : selectedStatus,
        selectedBranch || undefined,
        searchQuery || undefined
      ),
      getCompanyBranches(),
    ]);

    if (poRes.success && poRes.purchaseOrders) {
      setPurchaseOrders(poRes.purchaseOrders);
    }
    setBranches(branchList);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [selectedStatus, selectedBranch]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  // Metrics
  const openCount = purchaseOrders.filter((p) =>
    ["SUBMITTED", "APPROVED", "PARTIALLY_RECEIVED"].includes(p.status)
  ).length;

  const openValuePaisa = purchaseOrders
    .filter((p) => ["SUBMITTED", "APPROVED", "PARTIALLY_RECEIVED"].includes(p.status))
    .reduce((acc, p) => acc + (p.total_paisa || 0), 0);

  const receivedCount = purchaseOrders.filter((p) => p.status === "RECEIVED").length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-primary" />
            Purchase Orders
          </h1>
          <p className="text-sm text-zinc-500">
            Raw materials and packaging procurement orders, supplier approvals, and delivery schedules.
          </p>
        </div>
        <Link href="/purchases/new">
          <Button size="sm" className="flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            Create Purchase Order
          </Button>
        </Link>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-4 pb-4">
            <div className="text-xs text-zinc-500 font-medium">Open Purchase Orders</div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">
              {openCount} <span className="text-xs text-zinc-400 font-normal">Active Orders</span>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardContent className="pt-4 pb-4">
            <div className="text-xs text-zinc-500 font-medium">Committed Open Value</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">
              ₹{(openValuePaisa / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-50 dark:bg-zinc-900 border">
          <CardContent className="pt-4 pb-4">
            <div className="text-xs text-zinc-500 font-medium">Fully Received</div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">
              {receivedCount} <span className="text-xs text-zinc-400 font-normal">Orders Complete</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Filter Tabs & Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  "ALL",
                  "DRAFT",
                  "SUBMITTED",
                  "APPROVED",
                  "PARTIALLY_RECEIVED",
                  "RECEIVED",
                  "REJECTED",
                  "CANCELLED",
                ] as const
              ).map((tab) => (
                <Button
                  key={tab}
                  size="sm"
                  variant={selectedStatus === tab ? "default" : "outline"}
                  onClick={() => setSelectedStatus(tab)}
                  className="text-xs"
                >
                  {tab.replace("_", " ")}
                </Button>
              ))}
            </div>

            <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full md:w-auto">
              <select
                className="px-3 py-1.5 border rounded-md text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
              >
                <option value="">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-400" />
                <Input
                  placeholder="PO number..."
                  className="pl-8 h-9 text-xs w-40"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </form>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">
            Procurement Orders ({purchaseOrders.length})
          </CardTitle>
          <CardDescription>
            Official supplier contracts with tax rate snapshots and receiving status.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Delivery Warehouse</TableHead>
                  <TableHead>Order Date</TableHead>
                  <TableHead>Expected Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Order Total</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-zinc-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                      Loading purchase orders...
                    </TableCell>
                  </TableRow>
                ) : purchaseOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-zinc-500">
                      No purchase orders found for this criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  purchaseOrders.map((po) => (
                    <TableRow key={po.id}>
                      <TableCell className="font-mono text-xs font-bold text-primary">
                        <Link href={`/purchases/${po.id}`} className="hover:underline">
                          {po.po_number}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                          {po.supplier?.name}
                        </div>
                        <div className="text-xs text-zinc-500">
                          Code: {po.supplier?.code}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-zinc-600 dark:text-zinc-400">
                        {po.delivery_warehouse?.name || "Main Godown"}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-500">
                        {new Date(po.order_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-500">
                        {new Date(po.expected_delivery_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {po.status === "DRAFT" && (
                          <Badge variant="outline" className="text-zinc-500">
                            Draft
                          </Badge>
                        )}
                        {po.status === "SUBMITTED" && (
                          <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-500/10">
                            <Clock className="w-3 h-3 mr-1" />
                            Submitted
                          </Badge>
                        )}
                        {po.status === "APPROVED" && (
                          <Badge variant="outline" className="border-emerald-500 text-emerald-600 bg-emerald-500/10">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Approved
                          </Badge>
                        )}
                        {po.status === "PARTIALLY_RECEIVED" && (
                          <Badge variant="outline" className="border-blue-500 text-blue-600 bg-blue-500/10">
                            <Truck className="w-3 h-3 mr-1" />
                            Partial Receipt
                          </Badge>
                        )}
                        {po.status === "RECEIVED" && (
                          <Badge variant="outline" className="border-emerald-600 text-emerald-700 bg-emerald-500/20">
                            Fulfilled
                          </Badge>
                        )}
                        {po.status === "REJECTED" && (
                          <Badge variant="outline" className="border-red-500 text-red-600 bg-red-500/10">
                            <XCircle className="w-3 h-3 mr-1" />
                            Rejected
                          </Badge>
                        )}
                        {po.status === "CANCELLED" && (
                          <Badge variant="secondary" className="text-zinc-400">
                            <Ban className="w-3 h-3 mr-1" />
                            Cancelled
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs font-bold font-mono text-zinc-900 dark:text-zinc-100">
                        ₹{(po.total_paisa / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/purchases/${po.id}`}>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                            <Eye className="w-4 h-4 text-zinc-500" />
                          </Button>
                        </Link>
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
  );
}
