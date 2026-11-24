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
  FileSpreadsheet,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Truck,
  Ban,
  Clock,
  Printer,
  Loader2,
  AlertTriangle,
  Building,
  Warehouse,
  Send,
  Plus,
} from "lucide-react";
import {
  getPurchaseOrderById,
  submitPurchaseOrder,
  approvePurchaseOrder,
  rejectPurchaseOrder,
  cancelPurchaseOrder,
} from "@/modules/purchases/actions";
import { PurchaseOrder } from "@/types/database";

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Reject Modal
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  // Cancel Modal
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const loadPo = async () => {
    setLoading(true);
    const res = await getPurchaseOrderById(id);
    if (res.success && res.purchaseOrder) {
      setPo(res.purchaseOrder);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (id) loadPo();
  }, [id]);

  const handleSubmit = async () => {
    if (!po) return;
    setIsProcessing(true);
    setActionError(null);
    const res = await submitPurchaseOrder(po.id);
    setIsProcessing(false);
    if (!res.success) {
      setActionError(res.error || "Failed to submit purchase order");
    } else {
      loadPo();
    }
  };

  const handleApprove = async () => {
    if (!po) return;
    setIsProcessing(true);
    setActionError(null);
    const res = await approvePurchaseOrder(po.id);
    setIsProcessing(false);
    if (!res.success) {
      setActionError(res.error || "Approval failed.");
    } else {
      loadPo();
    }
  };

  const handleReject = async () => {
    if (!po || !rejectionReason.trim()) return;
    setIsProcessing(true);
    const res = await rejectPurchaseOrder({
      poId: po.id,
      reason: rejectionReason.trim(),
    });
    setIsProcessing(false);
    if (!res.success) {
      alert("Rejection failed: " + res.error);
    } else {
      setIsRejectOpen(false);
      setRejectionReason("");
      loadPo();
    }
  };

  const handleCancel = async () => {
    if (!po || !cancelReason.trim()) return;
    setIsProcessing(true);
    const res = await cancelPurchaseOrder({
      poId: po.id,
      reason: cancelReason.trim(),
    });
    setIsProcessing(false);
    if (!res.success) {
      alert("Cancellation failed: " + res.error);
    } else {
      setIsCancelOpen(false);
      setCancelReason("");
      loadPo();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
        <p className="text-sm">Loading purchase order details...</p>
      </div>
    );
  }

  if (!po) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-bold">Purchase Order Not Found</h2>
        <Link href="/purchases">
          <Button variant="outline" className="mt-4">
            Back to Orders
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16 max-w-5xl mx-auto">
      {/* Header & Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/purchases">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1" />
              All Orders
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                {po.po_number}
              </h1>
              {po.status === "DRAFT" && <Badge variant="outline">Draft</Badge>}
              {po.status === "SUBMITTED" && (
                <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-500/10">
                  <Clock className="w-3 h-3 mr-1" />
                  Submitted for Approval
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
                  Partially Received
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
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Created on {new Date(po.created_at).toLocaleDateString()} by {po.created_by_profile?.full_name || "Staff"}
            </p>
          </div>
        </div>

        {/* Workflow Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-1.5" />
            Print
          </Button>

          {po.status === "DRAFT" && (
            <Button size="sm" onClick={handleSubmit} disabled={isProcessing}>
              <Send className="w-4 h-4 mr-1.5" />
              Submit Order
            </Button>
          )}

          {po.status === "SUBMITTED" && (
            <>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsRejectOpen(true)}
                disabled={isProcessing}
              >
                Reject
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleApprove}
                disabled={isProcessing}
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                Approve Purchase Order
              </Button>
            </>
          )}

          {["APPROVED", "PARTIALLY_RECEIVED"].includes(po.status) && (
            <Link href={`/goods-receipts/new?poId=${po.id}`}>
              <Button size="sm" className="bg-primary hover:bg-primary/90">
                <Truck className="w-4 h-4 mr-1.5" />
                Receive Goods (GRN)
              </Button>
            </Link>
          )}

          {["DRAFT", "SUBMITTED", "APPROVED"].includes(po.status) && (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-600"
              onClick={() => setIsCancelOpen(true)}
              disabled={isProcessing}
            >
              Cancel Order
            </Button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-600 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Supplier Profile */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-zinc-500">
              Supplier Details
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-1">
            <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
              {po.supplier?.name}
            </div>
            <div className="text-zinc-500">Code: {po.supplier?.code}</div>
            {po.supplier?.contact_person && (
              <div>Attn: {po.supplier?.contact_person}</div>
            )}
            <div>Mobile: {po.supplier?.mobile}</div>
            {po.supplier?.gstin && (
              <div className="font-mono text-zinc-500">GST: {po.supplier?.gstin}</div>
            )}
            <Link href={`/suppliers/${po.supplier_id}/purchases`} className="text-primary hover:underline text-[11px] block pt-1">
              View Supplier 360° History &rarr;
            </Link>
          </CardContent>
        </Card>

        {/* Delivery Logistics */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-zinc-500">
              Delivery Logistics
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-1">
            <div>
              <span className="text-zinc-500">Operating Branch:</span>{" "}
              <span className="font-medium">{po.branch?.name} ({po.branch?.code})</span>
            </div>
            <div>
              <span className="text-zinc-500">Target Warehouse:</span>{" "}
              <span className="font-medium">{po.delivery_warehouse?.name}</span>
            </div>
            <div>
              <span className="text-zinc-500">Order Date:</span>{" "}
              <span>{new Date(po.order_date).toLocaleDateString()}</span>
            </div>
            <div>
              <span className="text-zinc-500">Expected Delivery:</span>{" "}
              <span className="font-bold text-emerald-600">
                {new Date(po.expected_delivery_date).toLocaleDateString()}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Approval & Audit Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-zinc-500">
              Approval & Audit Trail
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-1">
            <div>
              <span className="text-zinc-500">Created By:</span>{" "}
              <span>{po.created_by_profile?.full_name || "—"}</span>
            </div>
            {po.approved_by && (
              <div>
                <span className="text-zinc-500">Approved By:</span>{" "}
                <span className="font-semibold text-emerald-600">{po.approved_by_profile?.full_name}</span>
              </div>
            )}
            {po.approved_at && (
              <div>
                <span className="text-zinc-500">Approved At:</span>{" "}
                <span>{new Date(po.approved_at).toLocaleString()}</span>
              </div>
            )}
            {po.rejection_reason && (
              <div className="text-red-500">
                <strong>Rejection Reason:</strong> {po.rejection_reason}
              </div>
            )}
            {po.notes && (
              <div className="text-zinc-500 italic pt-1">
                &ldquo;{po.notes}&rdquo;
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Order Line Items & Fulfilment */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Order Line Items & Receiving Progress</CardTitle>
          <CardDescription>
            Ordered quantities, unit prices, GST rates, and received inventory units.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Item / Raw Material</TableHead>
                  <TableHead className="text-right">Ordered</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">GST</TableHead>
                  <TableHead className="text-right">Line Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {po.lines && po.lines.length > 0 ? (
                  po.lines.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs font-mono text-zinc-400">
                        {l.line_number}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                          {l.item?.name}
                        </div>
                        <div className="text-xs text-zinc-500">
                          Code: {l.item?.code}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono font-medium">
                        {l.ordered_qty} {l.unit?.symbol}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono font-bold text-emerald-600">
                        {l.received_qty} {l.unit?.symbol}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono text-zinc-600 dark:text-zinc-400">
                        {l.pending_qty} {l.unit?.symbol}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono">
                        ₹{(l.unit_price_paisa / 100).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono text-zinc-500">
                        {l.tax_rate_snapshot}%
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono font-bold text-zinc-900 dark:text-zinc-100">
                        ₹{(l.total_paisa / 100).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-6 text-zinc-500">
                      No lines recorded.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Financial Summary */}
      <div className="flex justify-end">
        <Card className="w-80">
          <CardContent className="pt-4 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-500">Subtotal:</span>
              <span className="font-mono font-medium">₹{(po.subtotal_paisa / 100).toFixed(2)}</span>
            </div>
            {po.discount_paisa > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount:</span>
                <span className="font-mono">-₹{(po.discount_paisa / 100).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-zinc-500">GST Tax:</span>
              <span className="font-mono font-medium">₹{(po.tax_paisa / 100).toFixed(2)}</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-bold text-sm text-zinc-900 dark:text-zinc-100">
              <span>Order Total:</span>
              <span className="font-mono text-primary">₹{(po.total_paisa / 100).toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rejection Dialog */}
      <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <XCircle className="w-5 h-5" />
              Reject Purchase Order
            </DialogTitle>
            <DialogDescription>
              State the reason why this procurement order cannot be approved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="rejectionReason">Reason *</Label>
            <Input
              id="rejectionReason"
              placeholder="e.g. Budget exceeded, incorrect purchase rate"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isProcessing || !rejectionReason.trim()}
              onClick={handleReject}
            >
              {isProcessing ? "Rejecting..." : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancellation Dialog */}
      <Dialog open={isCancelOpen} onOpenChange={setIsCancelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Ban className="w-5 h-5" />
              Cancel Purchase Order
            </DialogTitle>
            <DialogDescription>
              Orders can only be cancelled before any goods have been received.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="cancelReason">Cancellation Reason *</Label>
            <Input
              id="cancelReason"
              placeholder="e.g. Vendor unable to supply on time, order cancelled by management"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCancelOpen(false)}>
              Back
            </Button>
            <Button
              variant="destructive"
              disabled={isProcessing || !cancelReason.trim()}
              onClick={handleCancel}
            >
              {isProcessing ? "Cancelling..." : "Confirm Cancellation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
