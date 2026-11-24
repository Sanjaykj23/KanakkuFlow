"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  ArrowLeftRight,
  ArrowLeft,
  Plus,
  Trash2,
  AlertTriangle,
  Loader2,
  Save,
} from "lucide-react";
import { createStockTransfer, getInventoryBatches } from "@/modules/inventory/actions";
import { getCompanyBranches } from "@/modules/users/actions";
import { getWarehouses, getItems, getUnits } from "@/modules/master/actions";
import { Warehouse as WarehouseType, Item, Unit, InventoryBatch } from "@/types/database";

export default function NewStockTransferPage() {
  const router = useRouter();

  const [branches, setBranches] = useState<{ id: string; code: string; name: string }[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [availableBatches, setAvailableBatches] = useState<InventoryBatch[]>([]);

  // Form State
  const [sourceBranchId, setSourceBranchId] = useState("");
  const [sourceWarehouseId, setSourceWarehouseId] = useState("");
  const [destinationBranchId, setDestinationBranchId] = useState("");
  const [destinationWarehouseId, setDestinationWarehouseId] = useState("");
  const [notes, setNotes] = useState("");

  const [lines, setLines] = useState<
    Array<{
      itemId: string;
      batchId: string;
      requestedQty: number;
      unitId: string;
      maxAvailable: number;
      notes: string;
    }>
  >([]);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const [branchList, whRes, itemsRes, unitsRes] = await Promise.all([
        getCompanyBranches(),
        getWarehouses(),
        getItems(),
        getUnits(),
      ]);

      setBranches(branchList);
      if (whRes.success && whRes.warehouses) setWarehouses(whRes.warehouses);
      if (itemsRes.success && itemsRes.items) setItems(itemsRes.items);
      if (unitsRes.success && unitsRes.units) setUnits(unitsRes.units);

      if (branchList.length > 0) {
        setSourceBranchId(branchList[0].id);
        setDestinationBranchId(branchList[0].id);
      }
      if (whRes.success && whRes.warehouses && whRes.warehouses.length > 1) {
        setSourceWarehouseId(whRes.warehouses[0].id);
        setDestinationWarehouseId(whRes.warehouses[1].id);
      }
    }
    init();
  }, []);

  // Fetch batches when source warehouse changes
  useEffect(() => {
    async function loadBatches() {
      if (!sourceWarehouseId) return;
      const res = await getInventoryBatches({
        warehouseId: sourceWarehouseId,
        batchStatus: "ACTIVE",
        qcStatus: "RELEASED",
      });
      if (res.success && res.batches) {
        setAvailableBatches(res.batches);
      }
    }
    loadBatches();
  }, [sourceWarehouseId]);

  const handleAddLine = () => {
    if (items.length === 0 || units.length === 0) return;
    setLines([
      ...lines,
      {
        itemId: items[0].id,
        batchId: "",
        requestedQty: 1,
        unitId: units[0].id,
        maxAvailable: 0,
        notes: "",
      },
    ]);
  };

  const handleRemoveLine = (idx: number) => {
    setLines(lines.filter((_, i) => i !== idx));
  };

  const handleLineChange = (index: number, field: string, value: any) => {
    const updated = [...lines];
    (updated[index] as any)[field] = value;

    if (field === "batchId") {
      const selectedBatch = availableBatches.find((b) => b.id === value);
      if (selectedBatch) {
        const available = Math.max(0, (selectedBatch.current_qty || 0) - (selectedBatch.reserved_qty || 0));
        updated[index].maxAvailable = available;
        updated[index].itemId = selectedBatch.item_id;
        if (selectedBatch.base_unit_id) updated[index].unitId = selectedBatch.base_unit_id;
      }
    }

    setLines(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (sourceWarehouseId === destinationWarehouseId) {
      setErrorMessage("Source and destination warehouse cannot be the same.");
      return;
    }

    if (lines.length === 0) {
      setErrorMessage("Please add at least one item line to transfer.");
      return;
    }

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.batchId) {
        setErrorMessage(`Line ${i + 1}: Please select a batch.`);
        return;
      }
      if (l.requestedQty <= 0) {
        setErrorMessage(`Line ${i + 1}: Transfer quantity must be greater than zero.`);
        return;
      }
      if (l.requestedQty > l.maxAvailable) {
        setErrorMessage(
          `Line ${i + 1}: Requested quantity (${l.requestedQty}) exceeds batch available stock (${l.maxAvailable}).`
        );
        return;
      }
    }

    setSubmitting(true);
    const res = await createStockTransfer({
      sourceBranchId,
      sourceWarehouseId,
      destinationBranchId,
      destinationWarehouseId,
      notes: notes.trim(),
      lines: lines.map((l) => ({
        itemId: l.itemId,
        batchId: l.batchId,
        requestedQty: l.requestedQty,
        unitId: l.unitId,
        notes: l.notes.trim(),
      })),
    });
    setSubmitting(false);

    if (!res.success) {
      setErrorMessage(res.error || "Failed to create transfer.");
    } else {
      router.push(`/inventory/transfers/${res.transferId}`);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center gap-2">
        <Link
          href="/inventory/transfers"
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Transfers
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <ArrowLeftRight className="w-6 h-6 text-primary" />
            Create Inter-Warehouse Stock Transfer
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Reallocate raw materials, WIP, or packaging across storage warehouses.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-md text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Warehouse Route Card */}
        <Card>
          <CardHeader className="py-4 px-6 border-b border-zinc-200 dark:border-zinc-800">
            <CardTitle className="text-base font-semibold">Transfer Routing</CardTitle>
            <CardDescription className="text-xs">
              Select origin and receiving warehouse destinations
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Origin */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Origin (Source)
                </span>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Source Branch</Label>
                  <select
                    value={sourceBranchId}
                    onChange={(e) => setSourceBranchId(e.target.value)}
                    className="w-full h-9 px-3 text-xs bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Source Warehouse *</Label>
                  <select
                    value={sourceWarehouseId}
                    onChange={(e) => setSourceWarehouseId(e.target.value)}
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

              {/* Destination */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  Destination (Receiving)
                </span>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Destination Branch</Label>
                  <select
                    value={destinationBranchId}
                    onChange={(e) => setDestinationBranchId(e.target.value)}
                    className="w-full h-9 px-3 text-xs bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Destination Warehouse *</Label>
                  <select
                    value={destinationWarehouseId}
                    onChange={(e) => setDestinationWarehouseId(e.target.value)}
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
            </div>

            <div className="mt-4 space-y-1">
              <Label className="text-xs font-semibold">Transfer Instructions / Notes</Label>
              <Input
                placeholder="e.g. Replenish packaging stock for afternoon packaging run"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </CardContent>
        </Card>

        {/* Transfer Line Items Card */}
        <Card>
          <CardHeader className="py-4 px-6 border-b border-zinc-200 dark:border-zinc-800 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Transfer Items & Batches</CardTitle>
              <CardDescription className="text-xs">
                Select specific physical batches from the source warehouse
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddLine}
              className="flex items-center gap-1.5 text-xs"
            >
              <Plus className="w-3.5 h-3.5" /> Add Material Line
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-zinc-50 dark:bg-zinc-900/50">
                    <TableHead className="text-xs font-semibold w-[40%]">Source Batch & Item *</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Batch Available</TableHead>
                    <TableHead className="text-xs font-semibold w-[160px]">Transfer Qty *</TableHead>
                    <TableHead className="text-xs font-semibold w-[120px]">Unit</TableHead>
                    <TableHead className="text-xs font-semibold text-right w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-xs text-zinc-500">
                        No lines added. Click &quot;Add Material Line&quot; to select items for transfer.
                      </TableCell>
                    </TableRow>
                  ) : (
                    lines.map((line, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <select
                            value={line.batchId}
                            onChange={(e) => handleLineChange(idx, "batchId", e.target.value)}
                            className="w-full h-8 px-2 text-xs bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                            required
                          >
                            <option value="">Select Batch</option>
                            {availableBatches.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.batch_number} - {b.item?.name} (Avail: {Math.max(0, b.current_qty - b.reserved_qty)})
                              </option>
                            ))}
                          </select>
                        </TableCell>
                        <TableCell className="text-xs text-right font-mono font-bold text-emerald-600">
                          {line.maxAvailable}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            max={line.maxAvailable || undefined}
                            value={line.requestedQty}
                            onChange={(e) =>
                              handleLineChange(idx, "requestedQty", Number(e.target.value))
                            }
                            className="h-8 text-xs font-mono text-right"
                            required
                          />
                        </TableCell>
                        <TableCell>
                          <select
                            value={line.unitId}
                            onChange={(e) => handleLineChange(idx, "unitId", e.target.value)}
                            className="w-full h-8 px-2 text-xs bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            {units.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.symbol}
                              </option>
                            ))}
                          </select>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveLine(idx)}
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Footer Submit */}
        <div className="flex items-center justify-end gap-3">
          <Link href="/inventory/transfers">
            <Button type="button" variant="outline" disabled={submitting}>
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={submitting} className="flex items-center gap-1.5">
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating Transfer...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Submit Transfer Request</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
