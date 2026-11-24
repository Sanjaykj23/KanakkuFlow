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
  QrCode,
  Search,
  Loader2,
  Warehouse,
  Calendar,
  Truck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Ban,
  ArrowRight,
  ExternalLink,
  Calculator,
  X,
} from "lucide-react";
import {
  getInventoryBatches,
  updateBatchStatus,
  allocateFefoStock,
} from "@/modules/inventory/actions";
import { getWarehouses, getItems } from "@/modules/master/actions";
import { InventoryBatch, BatchStatus, QcStatus, Warehouse as WarehouseType, Item } from "@/types/database";

export default function BatchesPage() {
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [selectedBatchStatus, setSelectedBatchStatus] = useState<"ALL" | BatchStatus>("ALL");
  const [selectedQcStatus, setSelectedQcStatus] = useState<"ALL" | QcStatus>("ALL");

  // Status Change Modal
  const [statusModalBatch, setStatusModalBatch] = useState<InventoryBatch | null>(null);
  const [modalBatchStatus, setModalBatchStatus] = useState<BatchStatus>("ACTIVE");
  const [modalQcStatus, setModalQcStatus] = useState<QcStatus>("RELEASED");
  const [modalReason, setModalReason] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // FEFO Test Simulator Modal
  const [isFefoModalOpen, setIsFefoModalOpen] = useState(false);
  const [fefoItemId, setFefoItemId] = useState("");
  const [fefoWarehouseId, setFefoWarehouseId] = useState("");
  const [fefoQty, setFefoQty] = useState<number | "">(10);
  const [fefoAllocations, setFefoAllocations] = useState<any[] | null>(null);
  const [fefoError, setFefoError] = useState<string | null>(null);
  const [fefoRunning, setFefoRunning] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [batchesRes, whRes, itemsRes] = await Promise.all([
      getInventoryBatches({
        warehouseId: selectedWarehouse || undefined,
        batchStatus: selectedBatchStatus === "ALL" ? undefined : selectedBatchStatus,
        qcStatus: selectedQcStatus === "ALL" ? undefined : selectedQcStatus,
        search: searchQuery || undefined,
      }),
      getWarehouses(),
      getItems(),
    ]);

    if (batchesRes.success && batchesRes.batches) {
      setBatches(batchesRes.batches);
    }
    if (whRes.success && whRes.warehouses) {
      setWarehouses(whRes.warehouses);
      if (!fefoWarehouseId && whRes.warehouses.length > 0) {
        setFefoWarehouseId(whRes.warehouses[0].id);
      }
    }
    if (itemsRes.success && itemsRes.items) {
      setItems(itemsRes.items);
      if (!fefoItemId && itemsRes.items.length > 0) {
        setFefoItemId(itemsRes.items[0].id);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [selectedWarehouse, selectedBatchStatus, selectedQcStatus]);

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusModalBatch) return;

    setUpdatingStatus(true);
    const res = await updateBatchStatus({
      batchId: statusModalBatch.id,
      batchStatus: modalBatchStatus,
      qcStatus: modalQcStatus,
      reason: modalReason.trim(),
    });
    setUpdatingStatus(false);

    if (res.success) {
      setStatusModalBatch(null);
      setModalReason("");
      loadData();
    } else {
      alert(res.error || "Failed to update batch status");
    }
  };

  const handleRunFefoSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    setFefoError(null);
    setFefoAllocations(null);

    if (!fefoWarehouseId || !fefoItemId || !fefoQty || Number(fefoQty) <= 0) {
      setFefoError("Please select warehouse, item, and positive quantity");
      return;
    }

    setFefoRunning(true);
    const res = await allocateFefoStock(fefoWarehouseId, fefoItemId, Number(fefoQty));
    setFefoRunning(false);

    if (!res.success) {
      setFefoError(res.error || "FEFO allocation failed");
    } else {
      setFefoAllocations(res.allocations || []);
    }
  };

  const getQcBadge = (status: QcStatus) => {
    switch (status) {
      case "RELEASED":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 mr-1" /> QC Released
          </Badge>
        );
      case "QUARANTINED":
        return (
          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
            <AlertTriangle className="w-3 h-3 mr-1" /> Quarantined
          </Badge>
        );
      case "REJECTED":
        return <Badge variant="destructive">QC Rejected</Badge>;
      case "PENDING":
      default:
        return (
          <Badge variant="outline" className="text-zinc-600 dark:text-zinc-400">
            <Clock className="w-3 h-3 mr-1" /> QC Pending
          </Badge>
        );
    }
  };

  const getBatchStatusBadge = (status: BatchStatus) => {
    switch (status) {
      case "ACTIVE":
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">Active</Badge>;
      case "BLOCKED":
        return (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
            <Ban className="w-3 h-3 mr-1" /> Blocked
          </Badge>
        );
      case "EXPIRED":
        return <Badge variant="destructive">Expired</Badge>;
      case "DEPLETED":
        return <Badge variant="outline" className="text-zinc-400">Depleted</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <QrCode className="w-6 h-6 text-primary" />
            Batch Traceability & FEFO Status
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Real-time physical batch tracking, quality release workflow, and First-Expired, First-Out allocation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFefoModalOpen(true)}
            className="flex items-center gap-1.5"
          >
            <Calculator className="w-4 h-4 text-primary" />
            FEFO Allocation Simulator
          </Button>

          <Link href="/goods-receipts/new">
            <Button size="sm" className="flex items-center gap-1.5">
              <Truck className="w-4 h-4" />
              Receive Inward Goods (GRN)
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                className="h-9 px-3 text-xs bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">All Warehouses</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </select>

              <select
                value={selectedQcStatus}
                onChange={(e) => setSelectedQcStatus(e.target.value as any)}
                className="h-9 px-3 text-xs bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="ALL">All QC Statuses</option>
                <option value="RELEASED">Released for Picking</option>
                <option value="PENDING">QC Pending</option>
                <option value="QUARANTINED">Quarantined</option>
                <option value="REJECTED">Rejected</option>
              </select>

              <select
                value={selectedBatchStatus}
                onChange={(e) => setSelectedBatchStatus(e.target.value as any)}
                className="h-9 px-3 text-xs bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="ALL">All Operational Statuses</option>
                <option value="ACTIVE">Active Batches</option>
                <option value="BLOCKED">Blocked</option>
                <option value="EXPIRED">Expired</option>
                <option value="DEPLETED">Depleted (0 Qty)</option>
              </select>
            </div>

            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-zinc-400" />
              <Input
                placeholder="Search batch #, item, supplier lot..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Batches Table */}
      <Card>
        <CardHeader className="py-4 px-6 border-b border-zinc-200 dark:border-zinc-800">
          <CardTitle className="text-base font-semibold">Inventory Batches Directory</CardTitle>
          <CardDescription className="text-xs">
            Showing {batches.length} tracked batches sorted by FEFO dispatch priority
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-zinc-50 dark:bg-zinc-900/50">
                  <TableHead className="font-semibold text-xs">Batch Number</TableHead>
                  <TableHead className="font-semibold text-xs">Item SKU & Name</TableHead>
                  <TableHead className="font-semibold text-xs">Warehouse</TableHead>
                  <TableHead className="font-semibold text-xs">Supplier Lot / Challan</TableHead>
                  <TableHead className="font-semibold text-xs">Expiry Date</TableHead>
                  <TableHead className="font-semibold text-xs text-right">On-Hand</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Reserved</TableHead>
                  <TableHead className="font-semibold text-xs text-right text-emerald-600 dark:text-emerald-400">Available</TableHead>
                  <TableHead className="font-semibold text-xs">QC Status</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12">
                      <div className="flex flex-col items-center justify-center gap-2 text-zinc-500">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        <span className="text-xs">Loading physical batches...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : batches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-zinc-500">
                      <QrCode className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
                      <p className="text-sm font-medium">No batches found</p>
                      <p className="text-xs text-zinc-400">Batches are created automatically upon posting a Goods Receipt Note (GRN).</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  batches.map((b) => {
                    const current = Number(b.current_qty) || 0;
                    const reserved = Number(b.reserved_qty) || 0;
                    const available = Math.max(0, current - reserved);
                    const todayStr = new Date().toISOString().split("T")[0];
                    const isExpired = b.expiry_date && b.expiry_date < todayStr;

                    return (
                      <TableRow key={b.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                        <TableCell>
                          <Link
                            href={`/inventory/batches/${b.id}`}
                            className="font-mono font-bold text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            <span>{b.batch_number}</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </Link>
                          <div className="text-[10px] text-zinc-500">{getBatchStatusBadge(b.batch_status)}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{b.item?.name}</div>
                          <div className="text-[10px] font-mono text-zinc-500">{b.item?.code}</div>
                        </TableCell>
                        <TableCell className="text-xs text-zinc-600 dark:text-zinc-400">
                          {b.warehouse?.name}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {b.supplier_batch_number || "—"}
                        </TableCell>
                        <TableCell>
                          <div className={`text-xs font-mono ${isExpired ? "text-red-600 font-bold" : "text-zinc-700 dark:text-zinc-300"}`}>
                            {b.expiry_date || "No Expiry"}
                          </div>
                          {isExpired && <Badge variant="destructive" className="text-[9px] px-1 py-0">EXPIRED</Badge>}
                        </TableCell>
                        <TableCell className="text-xs text-right font-mono font-semibold">
                          {current} {b.base_unit?.symbol}
                        </TableCell>
                        <TableCell className="text-xs text-right font-mono text-zinc-500">
                          {reserved > 0 ? `${reserved} ${b.base_unit?.symbol}` : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {available} {b.base_unit?.symbol}
                        </TableCell>
                        <TableCell>{getQcBadge(b.qc_status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setStatusModalBatch(b);
                                setModalBatchStatus(b.batch_status);
                                setModalQcStatus(b.qc_status);
                              }}
                              className="h-7 text-xs px-2 text-zinc-600 dark:text-zinc-400"
                            >
                              Status / QC
                            </Button>
                            <Link href={`/inventory/batches/${b.id}`}>
                              <Button variant="ghost" size="sm" className="h-7 text-xs px-2">
                                Details
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* QC & Status Update Modal */}
      {statusModalBatch && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-md w-full border border-zinc-200 dark:border-zinc-800 p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div>
                <span className="font-mono text-xs font-bold text-primary">{statusModalBatch.batch_number}</span>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Update QC & Operational Status
                </h3>
              </div>
              <button
                onClick={() => setStatusModalBatch(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateStatus} className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">QC Inspection Status</Label>
                <select
                  value={modalQcStatus}
                  onChange={(e) => setModalQcStatus(e.target.value as any)}
                  className="w-full h-9 px-3 text-xs bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="RELEASED">RELEASED (Approved for FEFO allocation & consumption)</option>
                  <option value="PENDING">PENDING (Awaiting laboratory test result)</option>
                  <option value="QUARANTINED">QUARANTINED (Hold for re-sampling)</option>
                  <option value="REJECTED">REJECTED (Contaminated / Failed parameters)</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Operational Batch Status</Label>
                <select
                  value={modalBatchStatus}
                  onChange={(e) => setModalBatchStatus(e.target.value as any)}
                  className="w-full h-9 px-3 text-xs bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="ACTIVE">ACTIVE (Normal operational use)</option>
                  <option value="BLOCKED">BLOCKED (Locked by supervisor/admin)</option>
                  <option value="EXPIRED">EXPIRED (Past shelf life)</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Audit Reason / Remarks</Label>
                <Input
                  placeholder="e.g. Cleared lab microbial test, moisture 4.2%"
                  value={modalReason}
                  onChange={(e) => setModalReason(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStatusModalBatch(null)}
                  disabled={updatingStatus}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updatingStatus}>
                  {updatingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Status"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FEFO Allocation Simulator Dialog */}
      {isFefoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-lg w-full border border-zinc-200 dark:border-zinc-800 p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    Live FEFO Stock Allocation Test
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Executes PostgreSQL row-locked First-Expired, First-Out allocation algorithm.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsFefoModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRunFefoSimulation} className="space-y-4">
              {fefoError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded text-xs text-red-600 dark:text-red-400 flex items-start gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{fefoError}</span>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Warehouse *</Label>
                <select
                  value={fefoWarehouseId}
                  onChange={(e) => setFefoWarehouseId(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Item SKU *</Label>
                <select
                  value={fefoItemId}
                  onChange={(e) => setFefoItemId(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Required Quantity *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={fefoQty}
                  onChange={(e) => setFefoQty(e.target.value === "" ? "" : Number(e.target.value))}
                  className="h-9 text-xs font-mono"
                  required
                />
              </div>

              <Button type="submit" disabled={fefoRunning} className="w-full">
                {fefoRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simulate Database FEFO Pick"}
              </Button>
            </form>

            {/* Results Table */}
            {fefoAllocations && (
              <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-zinc-900 dark:text-zinc-100">
                  <span>Picked Batches Order:</span>
                  <span className="text-emerald-600 font-mono">
                    Total: {fefoAllocations.reduce((acc, a) => acc + Number(a.allocated_qty), 0)} units
                  </span>
                </div>
                <div className="rounded border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-zinc-50 dark:bg-zinc-900/50">
                        <TableHead className="text-[11px]">Batch #</TableHead>
                        <TableHead className="text-[11px]">Expiry Date</TableHead>
                        <TableHead className="text-[11px] text-right">Allocated Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fefoAllocations.map((a, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs font-bold text-primary">
                            {a.batch_number}
                          </TableCell>
                          <TableCell className="text-xs font-mono">
                            {a.expiry_date || "No Expiry"}
                          </TableCell>
                          <TableCell className="text-xs text-right font-mono font-bold text-emerald-600">
                            {a.allocated_qty}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
