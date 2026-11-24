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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Truck,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Printer,
  Loader2,
  AlertTriangle,
  QrCode,
  Boxes,
  FileSpreadsheet,
} from "lucide-react";
import { getGoodsReceiptById, postGoodsReceipt } from "@/modules/procurement/grn-actions";
import { GoodsReceiptNote, InventoryBatch, StockMovement } from "@/types/database";

export default function GoodsReceiptDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [grn, setGrn] = useState<GoodsReceiptNote | null>(null);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const res = await getGoodsReceiptById(id);
    if (res.success && res.goodsReceipt) {
      setGrn(res.goodsReceipt);
      setBatches(res.batches || []);
      setMovements(res.stockMovements || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const handlePost = async () => {
    if (!grn) return;
    setIsPosting(true);
    setPostError(null);

    const res = await postGoodsReceipt(grn.id);
    setIsPosting(false);

    if (!res.success) {
      setPostError(res.error || "Failed to post goods receipt to inventory.");
    } else {
      loadData();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
        <p className="text-sm">Loading Goods Receipt details...</p>
      </div>
    );
  }

  if (!grn) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-bold">Goods Receipt Note Not Found</h2>
        <Link href="/goods-receipts">
          <Button variant="outline" className="mt-4">
            Back to Goods Receipts
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16 max-w-5xl mx-auto">
      {/* Header & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/goods-receipts">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1" />
              All Receipts
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                {grn.grn_number}
              </h1>
              {grn.status === "DRAFT" && (
                <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-500/10">
                  <Clock className="w-3 h-3 mr-1" />
                  Draft (Unposted)
                </Badge>
              )}
              {grn.status === "POSTED" && (
                <Badge variant="outline" className="border-emerald-500 text-emerald-600 bg-emerald-500/10">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Posted to Stock
                </Badge>
              )}
              {grn.status === "CANCELLED" && (
                <Badge variant="secondary" className="text-zinc-400">
                  Cancelled
                </Badge>
              )}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              DC Challan: <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">{grn.supplier_delivery_challan}</span> | Received: {new Date(grn.receipt_date).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-1.5" />
            Print GRN
          </Button>
          {grn.status === "DRAFT" && (
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handlePost}
              disabled={isPosting}
            >
              {isPosting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
              Post to Inventory & Ledger
            </Button>
          )}
        </div>
      </div>

      {postError && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-600 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{postError}</span>
        </div>
      )}

      {/* Info Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-zinc-500">
              Supplier & Contract
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-1">
            <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
              {grn.supplier?.name}
            </div>
            <div>Code: {grn.supplier?.code}</div>
            <div>GST: {grn.supplier?.gstin || "—"}</div>
            <div className="pt-1">
              <span className="text-zinc-500">Purchase Order:</span>{" "}
              <Link href={`/purchases/${grn.purchase_order_id}`} className="font-mono text-primary font-bold hover:underline">
                {grn.purchase_order?.po_number}
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-zinc-500">
              Storage Destination
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-1">
            <div>
              <span className="text-zinc-500">Operating Branch:</span>{" "}
              <span className="font-medium">{grn.branch?.name} ({grn.branch?.code})</span>
            </div>
            <div>
              <span className="text-zinc-500">Warehouse:</span>{" "}
              <span className="font-bold text-primary">{grn.warehouse?.name}</span>
            </div>
            <div>
              <span className="text-zinc-500">Receiving Staff:</span>{" "}
              <span>{grn.receiving_employee?.full_name || "Warehouse Gate"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-zinc-500">
              Receipt Audit
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-1">
            <div>
              <span className="text-zinc-500">Receipt Date:</span>{" "}
              <span>{new Date(grn.receipt_date).toLocaleDateString()}</span>
            </div>
            {grn.posted_at && (
              <div>
                <span className="text-zinc-500">Posted At:</span>{" "}
                <span className="text-emerald-600 font-semibold">{new Date(grn.posted_at).toLocaleString()}</span>
              </div>
            )}
            {grn.posted_by_profile && (
              <div>
                <span className="text-zinc-500">Posted By:</span>{" "}
                <span>{grn.posted_by_profile.full_name}</span>
              </div>
            )}
            {grn.notes && (
              <div className="text-zinc-500 italic pt-1">
                &ldquo;{grn.notes}&rdquo;
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Received Lines Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Delivered Line Items</CardTitle>
          <CardDescription>
            Comparison of received count versus accepted, damaged, and rejected items.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Accepted</TableHead>
                  <TableHead className="text-right">Rejected</TableHead>
                  <TableHead className="text-right">Damaged</TableHead>
                  <TableHead>Supplier Batch</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead>QC Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grn.lines && grn.lines.length > 0 ? (
                  grn.lines.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                          {l.item?.name}
                        </div>
                        <div className="text-xs text-zinc-500">{l.item?.code}</div>
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono font-medium">
                        {l.received_qty} {l.unit?.symbol}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono font-bold text-emerald-600">
                        {l.accepted_qty} {l.unit?.symbol}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono text-red-500">
                        {l.rejected_qty}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono text-amber-500">
                        {l.damaged_qty}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {l.supplier_batch_number || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-500">
                        {l.expiry_date ? new Date(l.expiry_date).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {l.qc_status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-6 text-zinc-500">
                      No lines found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Batches Created (When Posted) */}
      {batches.length > 0 && (
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <QrCode className="w-5 h-5 text-emerald-600" />
              Generated Physical Batches ({batches.length})
            </CardTitle>
            <CardDescription>
              FEFO-tracked batch records created in warehouse storage.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch #</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Initial Qty</TableHead>
                  <TableHead>Current Qty</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead>QC Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
                      {b.batch_number}
                    </TableCell>
                    <TableCell className="text-xs font-medium">{b.item?.name}</TableCell>
                    <TableCell className="text-xs font-mono">{b.initial_qty} {b.base_unit?.symbol}</TableCell>
                    <TableCell className="text-xs font-mono font-bold">{b.current_qty} {b.base_unit?.symbol}</TableCell>
                    <TableCell className="text-xs text-zinc-500">
                      {b.expiry_date ? new Date(b.expiry_date).toLocaleDateString() : "N/A"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500">
                        {b.qc_status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Stock Movement Ledger Entries */}
      {movements.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Boxes className="w-5 h-5 text-primary" />
              Immutable Stock Movement Ledger Entries
            </CardTitle>
            <CardDescription>
              Append-only audit trail recording the physical intake into inventory.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Movement Type</TableHead>
                  <TableHead className="text-right">Quantity Inwards</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs text-zinc-500">
                      {new Date(m.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs font-medium">{m.item?.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500">
                        {m.movement_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono font-bold text-emerald-600">
                      +{m.quantity} {m.base_unit?.symbol}
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono">
                      ₹{(m.unit_cost_paisa / 100).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
