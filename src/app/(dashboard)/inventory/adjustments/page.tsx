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
  Sliders,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  Warehouse,
  ArrowUpRight,
  ArrowDownRight,
  X,
} from "lucide-react";
import {
  getStockAdjustments,
  createStockAdjustment,
  getInventoryBatches,
} from "@/modules/inventory/actions";
import { getCompanyBranches } from "@/modules/users/actions";
import { getWarehouses, getItems, getUnits } from "@/modules/master/actions";
import { StockAdjustment, StockAdjustmentStatus, StockAdjustmentType, Warehouse as WarehouseType, Item, Unit, InventoryBatch } from "@/types/database";

export default function StockAdjustmentsPage() {
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [branches, setBranches] = useState<{ id: string; code: string; name: string }[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form Fields
  const [branchId, setBranchId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [adjustmentType, setAdjustmentType] = useState<StockAdjustmentType>("PHYSICAL_COUNT");
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [systemQty, setSystemQty] = useState(0);
  const [countedQty, setCountedQty] = useState<number | "">(0);
  const [unitId, setUnitId] = useState("");
  const [reason, setReason] = useState("");

  const loadData = async () => {
    setLoading(true);
    const [adjRes, branchList, whRes, unitsRes] = await Promise.all([
      getStockAdjustments(),
      getCompanyBranches(),
      getWarehouses(),
      getUnits(),
    ]);

    if (adjRes.success && adjRes.adjustments) setAdjustments(adjRes.adjustments);
    setBranches(branchList);
    if (whRes.success && whRes.warehouses) setWarehouses(whRes.warehouses);
    if (unitsRes.success && unitsRes.units) setUnits(unitsRes.units);

    if (branchList.length > 0 && !branchId) setBranchId(branchList[0].id);
    if (whRes.success && whRes.warehouses && whRes.warehouses.length > 0 && !warehouseId) {
      setWarehouseId(whRes.warehouses[0].id);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fetch batches when warehouse changes
  useEffect(() => {
    async function loadWarehouseBatches() {
      if (!warehouseId) return;
      const res = await getInventoryBatches({ warehouseId });
      if (res.success && res.batches) {
        setBatches(res.batches);
      }
    }
    loadWarehouseBatches();
  }, [warehouseId]);

  const handleBatchSelect = (batchId: string) => {
    setSelectedBatchId(batchId);
    const b = batches.find((x) => x.id === batchId);
    if (b) {
      setSystemQty(Number(b.current_qty) || 0);
      setCountedQty(Number(b.current_qty) || 0);
      if (b.base_unit_id) setUnitId(b.base_unit_id);
    }
  };

  const calculatedDifference = (Number(countedQty) || 0) - systemQty;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedBatchId) {
      setFormError("Please select a batch to adjust.");
      return;
    }
    if (reason.trim().length < 5) {
      setFormError("Adjustment reason must be at least 5 characters.");
      return;
    }

    const b = batches.find((x) => x.id === selectedBatchId);
    if (!b) return;

    setSubmitting(true);
    const res = await createStockAdjustment({
      branchId,
      warehouseId,
      adjustmentType,
      reason: reason.trim(),
      lines: [
        {
          itemId: b.item_id,
          batchId: selectedBatchId,
          systemQty,
          countedQty: Number(countedQty) || 0,
          unitId: unitId || b.base_unit_id,
        },
      ],
    });
    setSubmitting(false);

    if (!res.success) {
      setFormError(res.error || "Failed to record adjustment.");
    } else {
      setIsModalOpen(false);
      setSelectedBatchId("");
      setReason("");
      loadData();
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Sliders className="w-6 h-6 text-primary" />
            Inventory Stock Adjustments
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Controlled physical count reconciliations, damage write-offs, and batch gain/loss corrections.
          </p>
        </div>

        <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Record Stock Adjustment
        </Button>
      </div>

      {/* Adjustments Table */}
      <Card>
        <CardHeader className="py-4 px-6 border-b border-zinc-200 dark:border-zinc-800">
          <CardTitle className="text-base font-semibold">Stock Adjustments Log</CardTitle>
          <CardDescription className="text-xs">
            Showing {adjustments.length} audited stock adjustments
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-50 dark:bg-zinc-900/50">
                <TableHead className="text-xs font-semibold">Adjustment #</TableHead>
                <TableHead className="text-xs font-semibold">Warehouse</TableHead>
                <TableHead className="text-xs font-semibold">Type</TableHead>
                <TableHead className="text-xs font-semibold">Material & Variance</TableHead>
                <TableHead className="text-xs font-semibold">Reason</TableHead>
                <TableHead className="text-xs font-semibold">Approved By</TableHead>
                <TableHead className="text-xs font-semibold">Date</TableHead>
                <TableHead className="text-xs font-semibold">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center gap-2 text-zinc-500">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <span className="text-xs">Loading adjustments...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : adjustments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-zinc-500">
                    <Sliders className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
                    <p className="text-sm font-medium">No stock adjustments logged</p>
                    <p className="text-xs text-zinc-400">Click &quot;Record Stock Adjustment&quot; to reconcile physical inventory.</p>
                  </TableCell>
                </TableRow>
              ) : (
                adjustments.map((adj) => {
                  const line = adj.lines?.[0];
                  const diff = line ? Number(line.difference_qty) : 0;
                  const isPositive = diff > 0;

                  return (
                    <TableRow key={adj.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                      <TableCell className="font-mono font-bold text-xs text-primary">
                        {adj.adjustment_number}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">{adj.warehouse?.name}</div>
                        <div className="text-[10px] text-zinc-500">{adj.branch?.name}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-mono">
                          {adj.adjustment_type.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {line ? (
                          <div className="space-y-0.5">
                            <span className="font-semibold">{line.item?.name}</span>
                            <div
                              className={`font-mono font-bold flex items-center ${
                                isPositive ? "text-emerald-600" : diff < 0 ? "text-red-600" : "text-zinc-500"
                              }`}
                            >
                              {isPositive ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                              {isPositive ? `+${diff}` : diff} {line.unit?.symbol}
                            </div>
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-600 dark:text-zinc-400 max-w-[200px] truncate">
                        {adj.reason}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-500">
                        {adj.creator?.full_name || "Manager"}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-zinc-500">
                        {new Date(adj.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Posted
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Record Stock Adjustment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-lg w-full border border-zinc-200 dark:border-zinc-800 p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-primary" /> Record Stock Adjustment
                </h3>
                <p className="text-xs text-zinc-500">
                  Direct edits are prohibited. Corrections are posted as an immutable adjustment ledger entry.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded text-xs text-red-600 dark:text-red-400 flex items-start gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Warehouse *</Label>
                  <select
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                    className="w-full h-9 px-3 text-xs bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Adjustment Type *</Label>
                  <select
                    value={adjustmentType}
                    onChange={(e) => setAdjustmentType(e.target.value as any)}
                    className="w-full h-9 px-3 text-xs bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="PHYSICAL_COUNT">Physical Count Audit</option>
                    <option value="DAMAGE">Damaged Goods Write-off</option>
                    <option value="EXPIRY">Expired Stock Disposal</option>
                    <option value="FOUND">Found Stock Inward</option>
                    <option value="RECONCILIATION">System Reconciliation</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Select Physical Batch *</Label>
                <select
                  value={selectedBatchId}
                  onChange={(e) => handleBatchSelect(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                >
                  <option value="">Select a Batch</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.batch_number} - {b.item?.name} (Current Qty: {b.current_qty})
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity Reconciliation Box */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-3">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase block font-semibold">System Qty</span>
                    <span className="text-sm font-mono font-bold text-zinc-700 dark:text-zinc-300">
                      {systemQty}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Counted Qty</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={countedQty}
                      onChange={(e) => setCountedQty(e.target.value === "" ? "" : Number(e.target.value))}
                      className="h-8 text-xs font-mono text-center"
                      required
                    />
                  </div>

                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Variance</span>
                    <span
                      className={`text-sm font-mono font-bold block ${
                        calculatedDifference > 0
                          ? "text-emerald-600"
                          : calculatedDifference < 0
                          ? "text-red-600"
                          : "text-zinc-500"
                      }`}
                    >
                      {calculatedDifference > 0 ? `+${calculatedDifference}` : calculatedDifference}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Mandatory Audit Reason *</Label>
                <Input
                  placeholder="e.g. Month-end physical verification discrepancy"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Approve & Post Adjustment"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
