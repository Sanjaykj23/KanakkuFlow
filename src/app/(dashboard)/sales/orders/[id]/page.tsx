"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
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
  ShoppingCart,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Truck,
  Boxes,
  Loader2,
  ShieldCheck,
  CreditCard,
  Building2,
  Calendar,
  Layers,
  FileText,
} from "lucide-react";
import {
  getSalesOrderById,
  approveSalesOrderAction,
  allocateSalesOrderStockAction,
  cancelSalesOrderAction,
} from "@/modules/sales/actions";
import { SalesOrder, SalesOrderStatus } from "@/types/database";

export default function SalesOrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  // Approval Modal
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [approvalDecision, setApprovalDecision] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [approvalNotes, setApprovalNotes] = useState("");
  const [submittingApproval, setSubmittingApproval] = useState(false);

  // Allocation State
  const [allocating, setAllocating] = useState(false);

  // Cancellation Modal
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [submittingCancel, setSubmittingCancel] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const res = await getSalesOrderById(orderId);
    if (res.success && res.order) {
      setOrder(res.order);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (orderId) loadData();
  }, [orderId]);

  const handleApprovalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingApproval(true);
    setActionError(null);

    const res = await approveSalesOrderAction({
      orderId,
      decision: approvalDecision,
      notes: approvalNotes || undefined,
    });

    setSubmittingApproval(false);
    if (!res.success) {
      setActionError(res.error || "Approval action failed.");
    } else {
      setIsApproveModalOpen(false);
      loadData();
    }
  };

  const handleAllocate = async () => {
    setAllocating(true);
    setActionError(null);

    const res = await allocateSalesOrderStockAction({
      orderId,
    });

    setAllocating(false);
    if (!res.success) {
      setActionError(res.error || "Stock allocation failed.");
    } else {
      loadData();
    }
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellationReason.trim()) {
      setActionError("Please provide a reason for cancelling this sales order.");
      return;
    }

    setSubmittingCancel(true);
    setActionError(null);

    const res = await cancelSalesOrderAction({
      orderId,
      reason: cancellationReason.trim(),
    });

    setSubmittingCancel(false);
    if (!res.success) {
      setActionError(res.error || "Order cancellation failed.");
    } else {
      setIsCancelModalOpen(false);
      loadData();
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
        <p className="text-sm text-zinc-500 mt-2">Loading sales order details...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="py-24 text-center">
        <AlertTriangle className="w-12 h-12 mx-auto text-amber-500 mb-2" />
        <h2 className="text-lg font-bold">Sales Order Not Found</h2>
        <p className="text-sm text-zinc-500 mt-1">The requested sales order does not exist or has been deleted.</p>
        <Link href="/sales/orders" className="mt-4 inline-block">
          <Button variant="outline" size="sm">
            &larr; Back to Sales Orders
          </Button>
        </Link>
      </div>
    );
  }

  const subtotal = ((order.subtotal_paisa || 0) / 100).toFixed(2);
  const discount = ((order.discount_paisa || 0) / 100).toFixed(2);
  const tax = ((order.tax_paisa || 0) / 100).toFixed(2);
  const total = ((order.total_amount_paisa || 0) / 100).toFixed(2);

  const isPendingApproval = order.status === "PENDING_APPROVAL";
  const canAllocate = ["APPROVED", "PARTIALLY_ALLOCATED"].includes(order.status);
  const canCancel = !["DISPATCHED", "PARTIALLY_DISPATCHED", "CANCELLED"].includes(order.status);

  return (
    <div className="space-y-6 pb-16 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/sales/orders">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 font-mono">
                {order.order_number}
              </h1>
              <Badge className="font-mono text-xs">{order.status}</Badge>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Booked on {new Date(order.order_date).toLocaleDateString("en-IN")} &bull; Requested Delivery: {new Date(order.requested_delivery_date).toLocaleDateString("en-IN")}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {isPendingApproval && (
            <Button
              size="sm"
              onClick={() => setIsApproveModalOpen(true)}
              className="flex items-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" />
              Manager Review
            </Button>
          )}

          {canAllocate && (
            <Button
              size="sm"
              onClick={handleAllocate}
              disabled={allocating}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700"
            >
              {allocating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  Allocating FEFO...
                </>
              ) : (
                <>
                  <Boxes className="w-4 h-4 mr-1" />
                  Allocate Stock (FEFO)
                </>
              )}
            </Button>
          )}

          {canCancel && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCancelModalOpen(true)}
              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
            >
              Cancel Order
            </Button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-600 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Customer & Branch Information Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5" />
              Customer Information
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-1.5 text-xs">
            <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
              {order.customer?.shop_name}
            </div>
            <div className="text-zinc-600">
              Owner: {order.customer?.owner_name} &bull; Mobile: {order.customer?.mobile_number}
            </div>
            <div className="text-zinc-500">
              GSTIN: {order.customer?.gstin || "Unregistered"} &bull; Terms: {order.payment_terms_days} Days Net
            </div>
            <div className="border-t pt-2 mt-2 text-zinc-600">
              <div className="font-medium text-zinc-700 dark:text-zinc-300">Delivery Address:</div>
              <div>
                {order.delivery_address?.address_line1}, {order.delivery_address?.city}, {order.delivery_address?.state} - {order.delivery_address?.pincode}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              Fulfillment &amp; Approval Status
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-500">Branch:</span>
              <span className="font-medium">{order.branch?.name} ({order.branch?.code})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Salesman:</span>
              <span className="font-medium">{order.salesman?.email || "Direct Booking"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Approval Status:</span>
              <Badge variant="outline" className="font-mono text-[10px]">
                {order.approval_status}
              </Badge>
            </div>
            {order.approval_required_reason && (
              <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded text-[11px] text-amber-800 dark:text-amber-200">
                <span className="font-semibold">Reason:</span> {order.approval_required_reason}
              </div>
            )}
            {order.approved_at && (
              <div className="flex justify-between text-emerald-600">
                <span>Approved At:</span>
                <span>{new Date(order.approved_at).toLocaleString("en-IN")}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Line Items Table */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Boxes className="w-4 h-4 text-primary" />
            Ordered Products &amp; Allocation Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-50/50 dark:bg-zinc-900/50">
                <TableHead>SKU &amp; Product Name</TableHead>
                <TableHead className="text-right">Ordered</TableHead>
                <TableHead className="text-right">Allocated</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-right">Taxable</TableHead>
                <TableHead className="text-right">Line Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(order.lines || []).map((line) => {
                const isFullyAllocated = Number(line.allocated_qty) >= Number(line.ordered_qty);
                const unitPrice = ((line.unit_price_paisa || 0) / 100).toFixed(2);
                const discountAmount = ((line.discount_amount_paisa || 0) / 100).toFixed(2);
                const taxable = ((line.taxable_amount_paisa || 0) / 100).toFixed(2);
                const lineTotal = ((line.line_total_paisa || 0) / 100).toFixed(2);

                return (
                  <TableRow key={line.id}>
                    <TableCell>
                      <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                        {line.item?.name}
                      </div>
                      <div className="text-xs text-zinc-500 font-mono">{line.sku}</div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {Number(line.ordered_qty).toLocaleString()} {line.unit?.symbol}
                    </TableCell>
                    <TableCell className="text-right font-medium font-mono">
                      <span className={isFullyAllocated ? "text-emerald-600" : "text-amber-600"}>
                        {Number(line.allocated_qty).toLocaleString()} {line.unit?.symbol}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">₹{unitPrice}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-zinc-500">
                      {Number(line.discount_percent) > 0 ? `${line.discount_percent}%` : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">₹{taxable}</TableCell>
                    <TableCell className="text-right font-mono font-semibold text-sm">
                      ₹{lineTotal}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Batch Allocations Section */}
      {(order.allocations || []).length > 0 && (
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Truck className="w-4 h-4 text-emerald-600" />
              Physical Batch Reservations (FEFO Picked)
            </CardTitle>
            <CardDescription className="text-xs">
              Batch allocations locked in warehouse for order fulfillment.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-zinc-50/50 dark:bg-zinc-900/50">
                  <TableHead>Batch #</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>MFG / EXP Date</TableHead>
                  <TableHead className="text-right">Reserved Qty</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.allocations?.map((alloc) => (
                  <TableRow key={alloc.id}>
                    <TableCell className="font-mono text-xs font-semibold">
                      {alloc.batch?.batch_number}
                    </TableCell>
                    <TableCell className="text-xs">{alloc.warehouse?.name}</TableCell>
                    <TableCell className="text-xs text-zinc-500">
                      MFG: {alloc.batch?.manufacturing_date || "-"} &bull; EXP: {alloc.batch?.expiry_date || "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium text-emerald-600">
                      {Number(alloc.allocated_qty).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {alloc.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Financial Summary Strip */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="text-xs text-zinc-500 space-y-1">
              <div>* Prices and GST tax amounts are snapshotted on order creation.</div>
              {order.notes && <div>Order Remarks: {order.notes}</div>}
              {order.cancellation_reason && (
                <div className="text-rose-600 font-medium">
                  Cancellation Reason: {order.cancellation_reason}
                </div>
              )}
            </div>

            <div className="w-full sm:w-64 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Items Subtotal:</span>
                <span className="font-mono">₹{subtotal}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Total Discounts:</span>
                <span className="font-mono text-emerald-600">-₹{discount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">GST Taxes:</span>
                <span className="font-mono">₹{tax}</span>
              </div>
              <div className="flex justify-between border-t pt-2 text-base font-bold">
                <span>Total Amount:</span>
                <span className="font-mono text-primary">₹{total}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Manager Approval Modal */}
      <Dialog open={isApproveModalOpen} onOpenChange={setIsApproveModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Manager Review &amp; Order Approval
            </DialogTitle>
            <DialogDescription>
              Review sales order flags (credit limits, pricing exceptions, high discounts).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleApprovalSubmit} className="space-y-4 pt-2">
            <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded border text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-zinc-500">Order Number:</span>
                <span className="font-mono font-semibold">{order.order_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Customer:</span>
                <span className="font-semibold">{order.customer?.shop_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Total Amount:</span>
                <span className="font-mono font-bold text-primary">₹{total}</span>
              </div>
              {order.approval_required_reason && (
                <div className="text-amber-600 pt-1 font-medium">
                  Trigger Reason: {order.approval_required_reason}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Approval Decision *</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={approvalDecision === "APPROVED" ? "default" : "outline"}
                  onClick={() => setApprovalDecision("APPROVED")}
                  className="h-8 text-xs font-semibold"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                  Approve Order
                </Button>
                <Button
                  type="button"
                  variant={approvalDecision === "REJECTED" ? "destructive" : "outline"}
                  onClick={() => setApprovalDecision("REJECTED")}
                  className="h-8 text-xs font-semibold"
                >
                  <XCircle className="w-3.5 h-3.5 mr-1" />
                  Reject Order
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="appNotes" className="text-xs">Manager Notes / Approval Remarks</Label>
              <Input
                id="appNotes"
                placeholder="e.g., Credit limit override approved by Owner."
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsApproveModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submittingApproval}>
                {submittingApproval ? "Submitting..." : "Confirm Decision"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cancellation Modal */}
      <Dialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <XCircle className="w-5 h-5" />
              Cancel Sales Order
            </DialogTitle>
            <DialogDescription>
              Cancelling this order will automatically release all FEFO stock batch reservations back to available inventory.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCancelSubmit} className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label htmlFor="cancelReason" className="text-xs">Cancellation Reason *</Label>
              <Input
                id="cancelReason"
                placeholder="e.g., Customer requested order cancellation due to festival postponement."
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsCancelModalOpen(false)}>
                Keep Order
              </Button>
              <Button type="submit" variant="destructive" size="sm" disabled={submittingCancel}>
                {submittingCancel ? "Cancelling..." : "Confirm Cancellation & Release Stock"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
