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
  QrCode,
  ArrowLeft,
  Calendar,
  Warehouse,
  Truck,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Ban,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { getBatchById } from "@/modules/inventory/actions";
import { InventoryBatch, StockMovement, StockReservation } from "@/types/database";

export default function BatchDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const batchId = params.id as string;

  const [batch, setBatch] = useState<InventoryBatch | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [reservations, setReservations] = useState<StockReservation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const res = await getBatchById(batchId);
      if (res.success && res.batch) {
        setBatch(res.batch);
        setMovements(res.movements || []);
        setReservations(res.reservations || []);
      }
      setLoading(false);
    }

    if (batchId) loadData();
  }, [batchId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-zinc-500 font-medium">Loading Batch Traceability Record...</p>
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="p-8 text-center space-y-4">
        <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-200">Batch Not Found</h2>
        <p className="text-sm text-zinc-500">The requested physical batch ID does not exist.</p>
        <Button onClick={() => router.push("/inventory/batches")}>Back to Batches</Button>
      </div>
    );
  }

  const current = Number(batch.current_qty) || 0;
  const reserved = Number(batch.reserved_qty) || 0;
  const available = Math.max(0, current - reserved);
  const todayStr = new Date().toISOString().split("T")[0];
  const isExpired = batch.expiry_date && batch.expiry_date < todayStr;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link
          href="/inventory/batches"
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Batches
        </Link>
      </div>

      {/* Main Batch Profile Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm px-2.5 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-primary font-bold">
                  {batch.batch_number}
                </span>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {batch.item?.name}
                </h1>
                <Badge variant="outline" className="font-mono text-xs">
                  SKU: {batch.item?.code}
                </Badge>
                <Badge
                  className={
                    batch.qc_status === "RELEASED"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  }
                >
                  {batch.qc_status}
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2 text-xs text-zinc-600 dark:text-zinc-400 pt-2">
                <div>
                  <span className="font-semibold text-zinc-500">Warehouse: </span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {batch.warehouse?.name} ({batch.warehouse?.code})
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-zinc-500">Supplier: </span>
                  <span>{batch.supplier?.name || "Internal Plant Run"}</span>
                </div>
                <div>
                  <span className="font-semibold text-zinc-500">Supplier Lot: </span>
                  <span className="font-mono">{batch.supplier_batch_number || "—"}</span>
                </div>
                <div>
                  <span className="font-semibold text-zinc-500">Received Date: </span>
                  <span>{batch.received_date}</span>
                </div>
                <div>
                  <span className="font-semibold text-zinc-500">Mfg Date: </span>
                  <span>{batch.manufacturing_date || "—"}</span>
                </div>
                <div>
                  <span className="font-semibold text-zinc-500">Expiry Date: </span>
                  <span className={isExpired ? "text-red-600 font-bold" : "font-mono font-medium"}>
                    {batch.expiry_date || "No Expiry"}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-zinc-500">Unit Valuation: </span>
                  <span className="font-mono font-medium">
                    ₹{((batch.unit_cost_paisa || 0) / 100).toFixed(2)} / {batch.base_unit?.symbol}
                  </span>
                </div>
                {batch.blocked_reason && (
                  <div className="sm:col-span-2 text-red-600">
                    <span className="font-semibold">Block Reason: </span>
                    <span>{batch.blocked_reason}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quantity Metrics Mini-Card */}
            <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 min-w-[220px] space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Initial Inward:</span>
                <span className="font-mono font-medium">{batch.initial_qty} {batch.base_unit?.symbol}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Current On-Hand:</span>
                <span className="font-mono font-bold">{current} {batch.base_unit?.symbol}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Reserved Holds:</span>
                <span className="font-mono text-zinc-500">{reserved} {batch.base_unit?.symbol}</span>
              </div>
              <div className="flex justify-between text-xs pt-1 border-t border-zinc-200 dark:border-zinc-700 font-bold">
                <span className="text-emerald-600 dark:text-emerald-400">Available:</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">
                  {available} {batch.base_unit?.symbol}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Two Detail Cards: Movements Audit Trail & Reservations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Movements Audit Trail */}
        <Card>
          <CardHeader className="py-4 px-6 border-b border-zinc-200 dark:border-zinc-800">
            <CardTitle className="text-base font-semibold">Immutable Movement Ledger</CardTitle>
            <CardDescription className="text-xs">
              Cryptographic and trigger-guarded transaction history for this batch
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-zinc-50 dark:bg-zinc-900/50">
                  <TableHead className="text-xs">Date & Time</TableHead>
                  <TableHead className="text-xs">Movement Type</TableHead>
                  <TableHead className="text-xs text-right">Quantity</TableHead>
                  <TableHead className="text-xs">Logged By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-xs text-zinc-500">
                      No stock movements recorded for this batch.
                    </TableCell>
                  </TableRow>
                ) : (
                  movements.map((m) => {
                    const isPositive = Number(m.quantity) > 0;
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="text-xs font-mono text-zinc-600 dark:text-zinc-400">
                          {new Date(m.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs font-medium">
                          {m.movement_type.replace(/_/g, " ")}
                        </TableCell>
                        <TableCell
                          className={`text-xs text-right font-mono font-bold ${
                            isPositive ? "text-emerald-600" : "text-red-600"
                          }`}
                        >
                          {isPositive ? `+${m.quantity}` : m.quantity} {m.base_unit?.symbol}
                        </TableCell>
                        <TableCell className="text-xs text-zinc-500">
                          {m.creator?.full_name || "System"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Active Reservations */}
        <Card>
          <CardHeader className="py-4 px-6 border-b border-zinc-200 dark:border-zinc-800">
            <CardTitle className="text-base font-semibold">Active Holds & Reservations</CardTitle>
            <CardDescription className="text-xs">
              Orders and transfers holding stock against this batch
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-zinc-50 dark:bg-zinc-900/50">
                  <TableHead className="text-xs">Source Document</TableHead>
                  <TableHead className="text-xs text-right">Reserved Qty</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Held By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reservations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-xs text-zinc-500">
                      No active reservations holding stock against this batch.
                    </TableCell>
                  </TableRow>
                ) : (
                  reservations.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs font-semibold">
                        {r.source_document_type.replace(/_/g, " ")}
                      </TableCell>
                      <TableCell className="text-xs text-right font-mono font-bold">
                        {r.reserved_qty}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-mono">
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-zinc-500">
                        {r.creator?.full_name || "User"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
