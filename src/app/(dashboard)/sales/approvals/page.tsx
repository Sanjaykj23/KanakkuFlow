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
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Search,
  Loader2,
  Boxes,
  ShoppingCart,
  CreditCard,
  ArrowRight,
} from "lucide-react";
import {
  getSalesOrders,
  approveSalesOrderAction,
} from "@/modules/sales/actions";
import { SalesOrder } from "@/types/database";

export default function OrderApprovalsPage() {
  const [pendingOrders, setPendingOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Review Modal State
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [notes, setNotes] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const res = await getSalesOrders({ status: "PENDING_APPROVAL" });
    if (res.success && res.orders) {
      setPendingOrders(res.orders);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const openReview = (order: SalesOrder) => {
    setSelectedOrder(order);
    setDecision("APPROVED");
    setNotes("");
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleDecisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    setSubmitting(true);
    setModalError(null);

    const res = await approveSalesOrderAction({
      orderId: selectedOrder.id,
      decision,
      notes: notes || undefined,
    });

    setSubmitting(false);

    if (!res.success) {
      setModalError(res.error || "Failed to process approval.");
    } else {
      setIsModalOpen(false);
      loadData();
    }
  };

  const filteredOrders = pendingOrders.filter(
    (o) =>
      o.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customer?.shop_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customer?.owner_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            Manager Order Approval Queue
          </h1>
          <p className="text-sm text-zinc-500">
            Review sales orders requiring manager sign-off for credit limit breaches, value benchmarks, or high discounts.
          </p>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Awaiting Manager Decision
            </div>
            <div className="text-2xl font-bold text-amber-600 mt-1">
              {pendingOrders.length} Orders
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              Held from warehouse allocation
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Total Exposure Held
            </div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1 font-mono">
              ₹
              {(
                pendingOrders.reduce((acc, o) => acc + (o.total_amount_paisa || 0), 0) / 100
              ).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              Pending review orders total
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Approval Authority
            </div>
            <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mt-2">
              Owner, Admin &amp; Branch Supervisor
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              Strict anti-self-approval enforced
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="p-4 pb-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
            <Input
              placeholder="Search pending orders by order # or customer..."
              className="pl-9 h-9 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-50/50 dark:bg-zinc-900/50">
                <TableHead>Order #</TableHead>
                <TableHead>Customer / Shop</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Trigger Reason</TableHead>
                <TableHead className="text-right">Order Amount</TableHead>
                <TableHead>Date Booked</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                    <p className="text-xs text-zinc-500 mt-2">Loading pending approvals...</p>
                  </TableCell>
                </TableRow>
              ) : filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-zinc-500">
                    <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                    All caught up! No sales orders currently awaiting manager approval.
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => {
                  const total = ((order.total_amount_paisa || 0) / 100).toFixed(2);
                  return (
                    <TableRow key={order.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                      <TableCell className="font-mono font-medium text-xs">
                        <Link href={`/sales/orders/${order.id}`} className="hover:underline text-primary">
                          {order.order_number}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                          {order.customer?.shop_name}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {order.customer?.owner_name}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-zinc-600">
                        {order.branch?.name}
                      </TableCell>
                      <TableCell>
                        <div className="p-1.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded text-[11px] text-amber-800 dark:text-amber-300 max-w-xs">
                          {order.approval_required_reason || "Manager review requested"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-sm">
                        ₹{Number(total).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-500">
                        {new Date(order.created_at).toLocaleDateString("en-IN")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => openReview(order)}
                        >
                          <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                          Review &amp; Decide
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Decision Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Sales Order Approval Decision
            </DialogTitle>
            <DialogDescription>
              Authorize order for warehouse picking or reject with audit explanation.
            </DialogDescription>
          </DialogHeader>

          {modalError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-600">
              {modalError}
            </div>
          )}

          {selectedOrder && (
            <form onSubmit={handleDecisionSubmit} className="space-y-4 pt-2">
              <div className="bg-zinc-50 dark:bg-zinc-900 p-3 rounded border text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Order Number:</span>
                  <span className="font-mono font-semibold">{selectedOrder.order_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Customer:</span>
                  <span className="font-semibold">{selectedOrder.customer?.shop_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Order Value:</span>
                  <span className="font-mono font-bold text-primary">
                    ₹{((selectedOrder.total_amount_paisa || 0) / 100).toFixed(2)}
                  </span>
                </div>
                {selectedOrder.approval_required_reason && (
                  <div className="text-amber-700 dark:text-amber-300 pt-1 font-medium">
                    Trigger Reason: {selectedOrder.approval_required_reason}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Decision *</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={decision === "APPROVED" ? "default" : "outline"}
                    onClick={() => setDecision("APPROVED")}
                    className="h-8 text-xs font-semibold"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                    Approve Order
                  </Button>
                  <Button
                    type="button"
                    variant={decision === "REJECTED" ? "destructive" : "outline"}
                    onClick={() => setDecision("REJECTED")}
                    className="h-8 text-xs font-semibold"
                  >
                    <XCircle className="w-3.5 h-3.5 mr-1" />
                    Reject Order
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="appNotes" className="text-xs">Manager Notes / Justification</Label>
                <Input
                  id="appNotes"
                  placeholder="e.g., Credit limit override approved based on advance payment commitment."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={submitting}>
                  {submitting ? "Saving..." : "Confirm Decision"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
