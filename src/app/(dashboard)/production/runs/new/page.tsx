"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  AlertTriangle,
  Loader2,
  Save,
  Layers,
  Calendar,
} from "lucide-react";
import { createProductionOrder, getBoms } from "@/modules/production/actions";
import { getCompanyBranches } from "@/modules/users/actions";
import { getWarehouses, getItems, getUnits } from "@/modules/master/actions";
import { getInventoryBatches } from "@/modules/inventory/actions";
import { BillOfMaterials, Warehouse, Item, Unit, ProductionStage, InventoryBatch } from "@/types/database";

export default function NewProductionOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedBomId = searchParams.get("bomId");

  const [branches, setBranches] = useState<{ id: string; code: string; name: string }[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [boms, setBoms] = useState<BillOfMaterials[]>([]);
  const [bulkBatches, setBulkBatches] = useState<InventoryBatch[]>([]);

  // Form Fields
  const [branchId, setBranchId] = useState("");
  const [orderType, setOrderType] = useState<ProductionStage>("BULK_PRODUCTION");
  const [productId, setProductId] = useState("");
  const [bomId, setBomId] = useState("");
  const [plannedQty, setPlannedQty] = useState<number | "">(100);
  const [unitId, setUnitId] = useState("");
  const [productionWarehouseId, setProductionWarehouseId] = useState("");
  const [finishedWarehouseId, setFinishedWarehouseId] = useState("");
  const [sourceBulkBatchId, setSourceBulkBatchId] = useState("");
  const [plannedStartDate, setPlannedStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [plannedCompletionDate, setPlannedCompletionDate] = useState(
    new Date(Date.now() + 86400000).toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const [branchList, whRes, itemsRes, unitsRes, bomsRes, batchesRes] = await Promise.all([
        getCompanyBranches(),
        getWarehouses(),
        getItems(),
        getUnits(),
        getBoms(),
        getInventoryBatches({ batchStatus: "ACTIVE", qcStatus: "RELEASED" }),
      ]);

      setBranches(branchList);
      if (branchList.length > 0) setBranchId(branchList[0].id);

      if (whRes.success && whRes.warehouses) {
        setWarehouses(whRes.warehouses);
        if (whRes.warehouses.length > 0) {
          setProductionWarehouseId(whRes.warehouses[0].id);
          setFinishedWarehouseId(whRes.warehouses[whRes.warehouses.length > 1 ? 1 : 0].id);
        }
      }

      if (itemsRes.success && itemsRes.items) {
        setItems(itemsRes.items);
        if (itemsRes.items.length > 0) setProductId(itemsRes.items[0].id);
      }

      if (unitsRes.success && unitsRes.units) {
        setUnits(unitsRes.units);
        if (unitsRes.units.length > 0) setUnitId(unitsRes.units[0].id);
      }

      if (bomsRes.success && bomsRes.boms) {
        setBoms(bomsRes.boms);
        if (preselectedBomId) {
          const match = bomsRes.boms.find((b) => b.id === preselectedBomId);
          if (match) {
            setBomId(match.id);
            setProductId(match.product_id);
            if (match.output_unit_id) setUnitId(match.output_unit_id);
            if (match.bom_type === "PACKAGING") setOrderType("PACKAGING_PRODUCTION");
          }
        } else if (bomsRes.boms.length > 0) {
          setBomId(bomsRes.boms[0].id);
          setProductId(bomsRes.boms[0].product_id);
        }
      }

      if (batchesRes.success && batchesRes.batches) {
        // Filter for bulk WIP batches
        setBulkBatches(batchesRes.batches.filter((b) => b.batch_type === "BULK_WIP" || b.batch_type === "RAW_MATERIAL"));
      }
    }
    init();
  }, [preselectedBomId]);

  // When product or order type changes, update eligible BOMs
  const eligibleBoms = boms.filter((b) => {
    if (productId && b.product_id !== productId) return false;
    return true;
  });

  const selectedBom = boms.find((b) => b.id === bomId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!branchId || !productId || !bomId || !productionWarehouseId || !finishedWarehouseId) {
      setErrorMessage("Please complete all required fields.");
      return;
    }

    if (!plannedQty || Number(plannedQty) <= 0) {
      setErrorMessage("Planned production quantity must be greater than zero.");
      return;
    }

    setSubmitting(true);
    const res = await createProductionOrder({
      branchId,
      productId,
      bomId,
      orderType,
      plannedQty: Number(plannedQty),
      unitId,
      productionWarehouseId,
      finishedWarehouseId,
      plannedStartDate,
      plannedCompletionDate,
      sourceBulkBatchId: orderType === "PACKAGING_PRODUCTION" ? sourceBulkBatchId || null : null,
      notes: notes.trim(),
    });
    setSubmitting(false);

    if (!res.success) {
      setErrorMessage(res.error || "Failed to create production order.");
    } else {
      router.push(`/production/runs/${res.orderId}`);
    }
  };

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

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Factory className="w-6 h-6 text-primary" />
          Create Production Order
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Issue a shop floor manufacturing work order linked to an approved BOM recipe.
        </p>
      </div>

      {errorMessage && (
        <div className="p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-md text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Order Setup Card */}
        <Card>
          <CardHeader className="py-4 px-6 border-b border-zinc-200 dark:border-zinc-800">
            <CardTitle className="text-base font-semibold">Production Order Routing</CardTitle>
            <CardDescription className="text-xs">
              Select manufacturing facility, product stage, and destination warehouse
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Manufacturing Plant / Branch *</Label>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Manufacturing Stage *</Label>
                <select
                  value={orderType}
                  onChange={(e) => setOrderType(e.target.value as any)}
                  className="w-full h-9 px-3 text-xs bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="BULK_PRODUCTION">Stage 1: Bulk Frying / Mixing (WIP)</option>
                  <option value="PACKAGING_PRODUCTION">Stage 2: Packaging into Retail Packs</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Target Output Product *</Label>
                <select
                  value={productId}
                  onChange={(e) => {
                    setProductId(e.target.value);
                    const match = boms.find((b) => b.product_id === e.target.value);
                    if (match) setBomId(match.id);
                  }}
                  className="w-full h-9 px-3 text-xs bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                >
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">BOM Recipe Version *</Label>
                <select
                  value={bomId}
                  onChange={(e) => setBomId(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                >
                  <option value="">Select Recipe</option>
                  {eligibleBoms.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bom_number} ({b.version}) - Std: {b.expected_output_qty} {b.output_unit?.symbol}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Planned Production Quantity *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={plannedQty}
                  onChange={(e) => setPlannedQty(e.target.value === "" ? "" : Number(e.target.value))}
                  className="h-9 text-xs font-mono"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Output Unit</Label>
                <select
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.symbol}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Ingredient Source Warehouse *</Label>
                <select
                  value={productionWarehouseId}
                  onChange={(e) => setProductionWarehouseId(e.target.value)}
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
                <Label className="text-xs font-semibold">Output Destination Warehouse *</Label>
                <select
                  value={finishedWarehouseId}
                  onChange={(e) => setFinishedWarehouseId(e.target.value)}
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
            </div>

            {/* Packaging Stage: Source Bulk WIP Batch Selector */}
            {orderType === "PACKAGING_PRODUCTION" && (
              <div className="p-3 bg-blue-50/50 dark:bg-blue-950/30 rounded border border-blue-200 dark:border-blue-900/50 space-y-1">
                <Label className="text-xs font-bold text-blue-900 dark:text-blue-300">
                  Source Bulk WIP Batch (Stage 1 Murukku Input)
                </Label>
                <select
                  value={sourceBulkBatchId}
                  onChange={(e) => setSourceBulkBatchId(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Select Bulk WIP Batch</option>
                  {bulkBatches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.batch_number} - {b.item?.name} (Available: {b.current_qty} {b.base_unit?.symbol})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-zinc-500">
                  Links this packaging run to the bulk batch for complete traceability and manufacturing cost allocation.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Planned Start Date</Label>
                <Input
                  type="date"
                  value={plannedStartDate}
                  onChange={(e) => setPlannedStartDate(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Planned Completion Date</Label>
                <Input
                  type="date"
                  value={plannedCompletionDate}
                  onChange={(e) => setPlannedCompletionDate(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Proportional Material Requirement Live Preview */}
        {selectedBom && selectedBom.lines && (
          <Card>
            <CardHeader className="py-4 px-6 border-b border-zinc-200 dark:border-zinc-800">
              <CardTitle className="text-base font-semibold">
                Estimated Material Requirements ({plannedQty} units planned)
              </CardTitle>
              <CardDescription className="text-xs">
                Calculated proportionally from recipe formula including expected wastage
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-zinc-50 dark:bg-zinc-900/50">
                    <TableHead className="text-xs font-semibold">Ingredient / Packaging Component</TableHead>
                    <TableHead className="text-xs font-semibold">Component Type</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Estimated Required Qty</TableHead>
                    <TableHead className="text-xs font-semibold">Unit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedBom.lines.map((l, idx) => {
                    const reqQty = Number(
                      (
                        ((Number(plannedQty) || 0) / selectedBom.expected_output_qty) *
                        l.quantity *
                        (1 + (l.expected_wastage_percent || 0) / 100)
                      ).toFixed(4)
                    );
                    return (
                      <TableRow key={idx}>
                        <TableCell className="text-xs font-semibold">
                          {l.component_item?.name || "Component"}
                        </TableCell>
                        <TableCell>
                          <span className="text-[10px] font-mono">{l.component_type}</span>
                        </TableCell>
                        <TableCell className="text-xs text-right font-mono font-bold text-primary">
                          {reqQty}
                        </TableCell>
                        <TableCell className="text-xs">{l.unit?.symbol}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Footer Actions */}
        <div className="flex justify-end gap-3">
          <Link href="/production/runs">
            <Button type="button" variant="outline" disabled={submitting}>
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={submitting} className="flex items-center gap-1.5">
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating Order...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Issue Production Work Order</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
