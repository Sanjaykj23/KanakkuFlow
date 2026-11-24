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
  ArrowLeftRight,
  ArrowLeft,
  Truck,
  CheckCircle2,
  Clock,
  Loader2,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import {
  getStockTransferById,
  dispatchStockTransfer,
  receiveStockTransfer,
} from "@/modules/inventory/actions";
import { StockTransfer } from "@/types/database";

export default function StockTransferDetailPage() {
  const params = useParams();
  const router = useRouter();
  const transferId = params.id as string;

  const [transfer, setTransfer] = useState<StockTransfer | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const res = await getStockTransferById(transferId);
    if (res.success && res.transfer) {
      setTransfer(res.transfer);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (transferId) loadData();
  }, [transferId]);

  const handleDispatch = async () => {
    if (!confirm("Confirm dispatch: This will deduct stock from the source warehouse and place materials in transit.")) {
      return;
    }

    setProcessing(true);
    setErrorMessage(null);
    const res = await dispatchStockTransfer(transferId);
    setProcessing(false);

    if (!res.success) {
      setErrorMessage(res.error || "Failed to dispatch transfer");
    } else {
      loadData();
    }
  };

  const handleReceive = async () => {
    if (!confirm("Confirm receipt: This will credit stock to the destination warehouse preserving the original batch identity.")) {
      return;
    }

    setProcessing(true);
    setErrorMessage(null);
    const res = await receiveStockTransfer(transferId);
    setProcessing(false);

    if (!res.success) {
      setErrorMessage(res.error || "Failed to confirm receipt");
    } else {
      loadData();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-zinc-500 font-medium">Loading transfer details...</p>
      </div>
    );
  }

  if (!transfer) {
    return (
      <div className="p-8 text-center space-y-4">
        <h2 className="text-xl font-bold text-zinc-800">Transfer Not Found</h2>
        <Button onClick={() => router.push("/inventory/transfers")}>Back to Transfers</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      {/* Top Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link
          href="/inventory/transfers"
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Transfers
        </Link>
      </div>

      {errorMessage && (
        <div className="p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-md text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Header Hub */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-semibold">
                  {transfer.transfer_number}
                </span>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  Inter-Warehouse Transfer
                </h1>
                <Badge
                  className={
                    transfer.status === "RECEIVED"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : transfer.status === "IN_TRANSIT"
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  }
                >
                  {transfer.status.replace("_", " ")}
                </Badge>
              </div>

              {/* Routing Route Preview */}
              <div className="flex items-center gap-3 pt-2 text-xs">
                <div className="p-2 rounded bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800">
                  <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Source</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">
                    {transfer.source_warehouse?.name}
                  </span>
                  <span className="text-[10px] text-zinc-400 block">({transfer.source_branch?.name})</span>
                </div>

                <ArrowRight className="w-5 h-5 text-zinc-400 shrink-0" />

                <div className="p-2 rounded bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800">
                  <span className="text-[10px] text-primary uppercase block font-semibold">Destination</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">
                    {transfer.destination_warehouse?.name}
                  </span>
                  <span className="text-[10px] text-zinc-400 block">({transfer.destination_branch?.name})</span>
                </div>
              </div>

              {transfer.notes && (
                <p className="text-xs text-zinc-600 dark:text-zinc-400 pt-1">
                  <span className="font-semibold text-zinc-500">Remarks: </span>
                  {transfer.notes}
                </p>
              )}
            </div>

            {/* Actions Block */}
            <div className="flex flex-col gap-2 shrink-0">
              {["SUBMITTED", "APPROVED"].includes(transfer.status) && (
                <Button
                  onClick={handleDispatch}
                  disabled={processing}
                  className="flex items-center gap-2"
                >
                  {processing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Truck className="w-4 h-4" />
                  )}
                  <span>Dispatch from Source</span>
                </Button>
              )}

              {transfer.status === "IN_TRANSIT" && (
                <Button
                  onClick={handleReceive}
                  disabled={processing}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2"
                >
                  {processing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Confirm Receipt at Destination</span>
                </Button>
              )}

              {transfer.status === "RECEIVED" && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 rounded text-xs text-emerald-800 dark:text-emerald-300 text-right">
                  <div className="font-bold">Transfer Complete</div>
                  <div className="text-[10px]">Stock successfully credited at destination.</div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line Items Table */}
      <Card>
        <CardHeader className="py-4 px-6 border-b border-zinc-200 dark:border-zinc-800">
          <CardTitle className="text-base font-semibold">Transfer Materials & Batches</CardTitle>
          <CardDescription className="text-xs">
            Physical batches selected for inter-warehouse movement
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-50 dark:bg-zinc-900/50">
                <TableHead className="text-xs font-semibold">Line #</TableHead>
                <TableHead className="text-xs font-semibold">Material / Item</TableHead>
                <TableHead className="text-xs font-semibold">Source Batch Number</TableHead>
                <TableHead className="text-xs font-semibold text-right">Requested</TableHead>
                <TableHead className="text-xs font-semibold text-right">Dispatched</TableHead>
                <TableHead className="text-xs font-semibold text-right">Received</TableHead>
                <TableHead className="text-xs font-semibold">Unit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfer.lines?.map((line) => (
                <TableRow key={line.id}>
                  <TableCell className="text-xs font-mono">{line.line_number}</TableCell>
                  <TableCell>
                    <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{line.item?.name}</div>
                    <div className="text-[10px] font-mono text-zinc-500">{line.item?.code}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-primary">
                    {line.batch?.batch_number}
                  </TableCell>
                  <TableCell className="text-xs text-right font-mono font-bold">
                    {line.requested_qty}
                  </TableCell>
                  <TableCell className="text-xs text-right font-mono text-blue-600">
                    {line.dispatched_qty}
                  </TableCell>
                  <TableCell className="text-xs text-right font-mono text-emerald-600 font-bold">
                    {line.received_qty}
                  </TableCell>
                  <TableCell className="text-xs">{line.unit?.symbol}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
