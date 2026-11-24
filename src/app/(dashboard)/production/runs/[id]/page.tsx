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
  Factory,
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  DollarSign,
  Package,
  Layers,
  Flame,
  Plus,
  X,
  ExternalLink,
} from "lucide-react";
import {
  getProductionOrderById,
  reserveProductionMaterialsAction,
  recordProductionConsumptionAction,
  postProductionOutputAction,
} from "@/modules/production/actions";
import { getInventoryBatches } from "@/modules/inventory/actions";
import { ProductionOrder, InventoryBatch } from "@/types/database";

export default function ProductionRunExecutionPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<ProductionOrder | null>(null);
  const [materialRequirements, setMaterialRequirements] = useState<any[]>([]);
  const [consumptions, setConsumptions] = useState<any[]>([]);
  const [outputs, setOutputs] = useState<any[]>([]);
  const [availableBatches, setAvailableBatches] = useState<InventoryBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Consume Modal State
  const [isConsumeOpen, setIsConsumeOpen] = useState(false);
  const [consumeItemId, setConsumeItemId] = useState("");
  const [consumeBatchId, setConsumeBatchId] = useState("");
  const [consumeQty, setConsumeQty] = useState<number | "">(10);
  const [consumeWastage, setConsumeWastage] = useState<number | "">(0);
  const [consumeReason, setConsumeReason] = useState("");

  // Output Modal State
  const [isOutputOpen, setIsOutputOpen] = useState(false);
  const [outputProducedQty, setOutputProducedQty] = useState<number | "">(50);
  const [outputRejectedQty, setOutputRejectedQty] = useState<number | "">(0);
  const [outputMfgDate, setOutputMfgDate] = useState(new Date().toISOString().split("T")[0]);
  const [outputExpDate, setOutputExpDate] = useState(
    new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0]
  );
  const [outputOverhead, setOutputOverhead] = useState<number | "">(0);

  const loadData = async () => {
    setLoading(true);
    const res = await getProductionOrderById(orderId);
    if (res.success && res.order) {
      setOrder(res.order);
      setMaterialRequirements(res.materialRequirements || []);
      setConsumptions(res.consumptions || []);
      setOutputs(res.outputs || []);

      // Load eligible batches for ingredient warehouse
      if (res.order.production_warehouse_id) {
        const batchRes = await getInventoryBatches({
          warehouseId: res.order.production_warehouse_id,
          batchStatus: "ACTIVE",
          qcStatus: "RELEASED",
        });
        if (batchRes.success && batchRes.batches) {
          setAvailableBatches(batchRes.batches);
          if (batchRes.batches.length > 0) {
            setConsumeBatchId(batchRes.batches[0].id);
            setConsumeItemId(batchRes.batches[0].item_id);
          }
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (orderId) loadData();
  }, [orderId]);

  // Material Reservation Trigger
  const handleReserveMaterials = async () => {
    setProcessing(true);
    setErrorMessage(null);
    const res = await reserveProductionMaterialsAction(orderId);
    setProcessing(false);

    if (!res.success) {
      setErrorMessage(res.error || "Failed to reserve materials");
    } else {
      loadData();
    }
  };

  // Record Consumption Submit
  const handleRecordConsumption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !consumeBatchId || !consumeQty || Number(consumeQty) <= 0) {
      setErrorMessage("Please select a batch and enter positive consumed quantity.");
      return;
    }

    const b = availableBatches.find((x) => x.id === consumeBatchId);
    if (!b) return;

    setProcessing(true);
    setErrorMessage(null);
    const res = await recordProductionConsumptionAction({
      orderId,
      itemId: b.item_id,
      batchId: consumeBatchId,
      warehouseId: order.production_warehouse_id,
      consumedQty: Number(consumeQty),
      wastageQty: Number(consumeWastage) || 0,
      unitId: b.base_unit_id,
      reason: consumeReason.trim(),
    });
    setProcessing(false);

    if (!res.success) {
      setErrorMessage(res.error || "Failed to record consumption");
    } else {
      setIsConsumeOpen(false);
      setConsumeReason("");
      loadData();
    }
  };

  // Post Output Submit
  const handlePostOutput = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !outputProducedQty || Number(outputProducedQty) <= 0) {
      setErrorMessage("Produced quantity must be greater than zero.");
      return;
    }

    setProcessing(true);
    setErrorMessage(null);
    const res = await postProductionOutputAction({
      orderId,
      producedQty: Number(outputProducedQty),
      rejectedQty: Number(outputRejectedQty) || 0,
      manufacturingDate: outputMfgDate,
      expiryDate: outputExpDate,
      additionalCostsPaisa: Math.round((Number(outputOverhead) || 0) * 100),
    });
    setProcessing(false);

    if (!res.success) {
      setErrorMessage(res.error || "Failed to post output");
    } else {
      setIsOutputOpen(false);
      loadData();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-zinc-500 font-medium">Loading production work order...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-8 text-center space-y-4">
        <h2 className="text-xl font-bold text-zinc-800">Production Order Not Found</h2>
        <Button onClick={() => router.push("/production/runs")}>Back to Runs</Button>
      </div>
    );
  }

  const isBulk = order.order_type === "BULK_PRODUCTION";

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center gap-2">
        <Link
          href="/production/runs"
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Production Runs
        </Link>
      </div>

      {errorMessage && (
        <div className="p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-md text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Order Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-semibold">
                  {order.order_number}
                </span>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {order.product?.name}
                </h1>
                <Badge variant="outline" className="text-xs font-mono">
                  {isBulk ? "Stage 1: Bulk WIP" : "Stage 2: Packaging"}
                </Badge>
                <Badge
                  className={
                    order.status === "COMPLETED"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                  }
                >
                  {order.status.replace(/_/g, " ")}
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs pt-1">
                <div>
                  <span className="text-zinc-500 block">Plant / Branch</span>
                  <span className="font-semibold">{order.branch?.name}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Recipe BOM</span>
                  <span className="font-semibold font-mono">{order.bom?.bom_number} ({order.bom?.version})</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Planned vs Produced</span>
                  <span className="font-bold font-mono text-zinc-900 dark:text-zinc-100">
                    {order.produced_qty} / {order.planned_qty} {order.unit?.symbol}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Finished Destination</span>
                  <span className="font-semibold">{order.finished_warehouse?.name}</span>
                </div>
              </div>

              {order.source_bulk_batch && (
                <div className="p-2.5 bg-blue-50/50 dark:bg-blue-950/30 rounded border border-blue-200 dark:border-blue-900/50 text-xs text-blue-900 dark:text-blue-300 flex items-center justify-between">
                  <span>Linked Bulk Batch: <strong>{order.source_bulk_batch.batch_number}</strong></span>
                  <span className="font-mono">Unit Cost: ₹{((order.source_bulk_batch.unit_cost_paisa || 0) / 100).toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Shop Floor Action Buttons */}
            <div className="flex flex-col gap-2 shrink-0">
              {["SUBMITTED", "APPROVED"].includes(order.status) && (
                <Button
                  onClick={handleReserveMaterials}
                  disabled={processing}
                  className="flex items-center gap-1.5"
                >
                  {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                  <span>Reserve Raw Materials (FEFO)</span>
                </Button>
              )}

              {["MATERIAL_RESERVED", "IN_PROGRESS", "PARTIALLY_COMPLETED"].includes(order.status) && (
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => setIsConsumeOpen(true)}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1.5 text-xs"
                  >
                    <Flame className="w-3.5 h-3.5 text-amber-600" />
                    Record Ingredient Consumption
                  </Button>

                  <Button
                    onClick={() => setIsOutputOpen(true)}
                    size="sm"
                    className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Package className="w-3.5 h-3.5" />
                    Record Production Output ({isBulk ? "Bulk WIP" : "Finished Goods"})
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Costing Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Consumed Materials</span>
              <span className="text-base font-mono font-bold text-zinc-800 dark:text-zinc-200">
                ₹{((order.total_material_cost_paisa || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Overhead & Labor</span>
              <span className="text-base font-mono font-bold text-zinc-800 dark:text-zinc-200">
                ₹{((order.additional_costs_paisa || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Total Work Cost</span>
              <span className="text-base font-mono font-bold text-primary">
                ₹{((order.total_production_cost_paisa || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 uppercase block font-semibold">Unit Manufacturing Cost</span>
              <span className="text-base font-mono font-bold text-emerald-600 dark:text-emerald-400">
                ₹{((order.unit_cost_paisa || 0) / 100).toFixed(2)} / {order.unit?.symbol}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Two Detail Cards: Consumptions & Outputs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Consumptions Table */}
        <Card>
          <CardHeader className="py-4 px-6 border-b border-zinc-200 dark:border-zinc-800 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Material Consumptions</CardTitle>
              <CardDescription className="text-xs">
                Actual raw materials & packaging drawn from inventory
              </CardDescription>
            </div>
            {["MATERIAL_RESERVED", "IN_PROGRESS", "PARTIALLY_COMPLETED"].includes(order.status) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsConsumeOpen(true)}
                className="h-7 text-xs text-primary"
              >
                + Add
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-zinc-50 dark:bg-zinc-900/50">
                  <TableHead className="text-xs font-semibold">Material & Batch</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Consumed</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Wastage</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Cost (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consumptions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-xs text-zinc-500">
                      No materials consumed yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  consumptions.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{c.item?.name}</div>
                        <div className="text-[10px] font-mono text-primary">Batch: {c.batch?.batch_number}</div>
                      </TableCell>
                      <TableCell className="text-xs text-right font-mono font-bold">
                        {c.consumed_qty} {c.unit?.symbol}
                      </TableCell>
                      <TableCell className="text-xs text-right font-mono text-amber-600">
                        {c.wastage_qty > 0 ? `${c.wastage_qty} ${c.unit?.symbol}` : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-right font-mono">
                        ₹{(c.total_cost_paisa / 100).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Outputs Table */}
        <Card>
          <CardHeader className="py-4 px-6 border-b border-zinc-200 dark:border-zinc-800 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Production Outputs (Batches)</CardTitle>
              <CardDescription className="text-xs">
                Produced {isBulk ? "bulk WIP" : "finished packaged"} batches with QC status
              </CardDescription>
            </div>
            {["MATERIAL_RESERVED", "IN_PROGRESS", "PARTIALLY_COMPLETED"].includes(order.status) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOutputOpen(true)}
                className="h-7 text-xs text-primary"
              >
                + Add Output
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-zinc-50 dark:bg-zinc-900/50">
                  <TableHead className="text-xs font-semibold">Batch #</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Produced Qty</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Unit Cost (₹)</TableHead>
                  <TableHead className="text-xs font-semibold">QC Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outputs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-xs text-zinc-500">
                      No output recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  outputs.map((out) => (
                    <TableRow key={out.id}>
                      <TableCell>
                        <Link
                          href={`/inventory/batches/${out.output_batch_id}`}
                          className="font-mono font-bold text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <span>{out.output_batch?.batch_number}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs text-right font-mono font-bold text-emerald-600">
                        {out.produced_qty} {out.unit?.symbol}
                      </TableCell>
                      <TableCell className="text-xs text-right font-mono">
                        ₹{(out.unit_cost_paisa / 100).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            out.qc_status === "RELEASED"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          }
                        >
                          {out.qc_status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Record Consumption Modal */}
      {isConsumeOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-md w-full border border-zinc-200 dark:border-zinc-800 p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Record Material Consumption
                </h3>
                <p className="text-xs text-zinc-500">Deduct raw materials or packaging from warehouse stock.</p>
              </div>
              <button
                onClick={() => setIsConsumeOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordConsumption} className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Select Material Batch *</Label>
                <select
                  value={consumeBatchId}
                  onChange={(e) => setConsumeBatchId(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                >
                  {availableBatches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.item?.name} ({b.batch_number}) - Avail: {b.current_qty} {b.base_unit?.symbol}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Consumed Quantity *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={consumeQty}
                    onChange={(e) => setConsumeQty(e.target.value === "" ? "" : Number(e.target.value))}
                    className="h-9 text-xs font-mono"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Wastage / Scrap Qty</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={consumeWastage}
                    onChange={(e) => setConsumeWastage(e.target.value === "" ? "" : Number(e.target.value))}
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Reason / Shop Floor Remarks</Label>
                <Input
                  placeholder="e.g. Standard batch mixture draw"
                  value={consumeReason}
                  onChange={(e) => setConsumeReason(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsConsumeOpen(false)}
                  disabled={processing}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={processing}>
                  {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Deduct & Record"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Output Modal */}
      {isOutputOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-md w-full border border-zinc-200 dark:border-zinc-800 p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Record Production Output
                </h3>
                <p className="text-xs text-zinc-500">
                  Generates {isBulk ? "BULK_WIP" : "FINISHED_GOODS"} physical batch in QC_PENDING.
                </p>
              </div>
              <button
                onClick={() => setIsOutputOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePostOutput} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Actual Produced Qty *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={outputProducedQty}
                    onChange={(e) => setOutputProducedQty(e.target.value === "" ? "" : Number(e.target.value))}
                    className="h-9 text-xs font-mono"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Rejected Qty</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={outputRejectedQty}
                    onChange={(e) => setOutputRejectedQty(e.target.value === "" ? "" : Number(e.target.value))}
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Manufacturing Date *</Label>
                  <Input
                    type="date"
                    value={outputMfgDate}
                    onChange={(e) => setOutputMfgDate(e.target.value)}
                    className="h-9 text-xs"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Expiry Date *</Label>
                  <Input
                    type="date"
                    value={outputExpDate}
                    onChange={(e) => setOutputExpDate(e.target.value)}
                    className="h-9 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Direct Labor & Overhead (₹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={outputOverhead}
                  onChange={(e) => setOutputOverhead(e.target.value === "" ? "" : Number(e.target.value))}
                  className="h-9 text-xs font-mono"
                  placeholder="0.00"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOutputOpen(false)}
                  disabled={processing}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={processing}>
                  {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Post Output Batch"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
