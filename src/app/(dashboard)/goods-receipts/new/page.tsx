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
  Loader2,
  AlertTriangle,
  Building,
  Warehouse as WarehouseIcon,
  CheckCircle2,
  Calendar,
  ShieldCheck,
} from "lucide-react";
import { getPurchaseOrders, getPurchaseOrderById } from "@/modules/purchases/actions";
import { createGoodsReceipt, postGoodsReceipt } from "@/modules/procurement/grn-actions";
import { PurchaseOrder } from "@/types/database";

interface GrnLineState {
  poLineId: string;
  itemId: string;
  itemName: string;
  itemCode: string;
  orderedQty: number;
  pendingQty: number;
  receivedQty: number;
  acceptedQty: number;
  rejectedQty: number;
  damagedQty: number;
  unitId: string;
  unitSymbol: string;
  conversionRate: number;
  supplierBatchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  qcStatus: "PENDING" | "RELEASED" | "REJECTED" | "QUARANTINED";
  rejectionReason: string;
}

export default function NewGoodsReceiptPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedPoId = searchParams?.get("poId");

  const [approvedOrders, setApprovedOrders] = useState<PurchaseOrder[]>([]);
  const [selectedPoId, setSelectedPoId] = useState(preselectedPoId || "");
  const [selectedPo, setSelectedPo] = useState<PurchaseOrder | null>(null);
  const [loadingOrders, setLoadingOrders] = useState(true);

  // Form State
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split("T")[0]);
  const [supplierDeliveryChallan, setSupplierDeliveryChallan] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<GrnLineState[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load Approved / Partially Received POs
  useEffect(() => {
    async function loadOrders() {
      setLoadingOrders(true);
      const [appRes, partRes] = await Promise.all([
        getPurchaseOrders("APPROVED"),
        getPurchaseOrders("PARTIALLY_RECEIVED"),
      ]);

      const combined = [
        ...(appRes.purchaseOrders || []),
        ...(partRes.purchaseOrders || []),
      ];
      setApprovedOrders(combined);
      setLoadingOrders(false);
    }
    loadOrders();
  }, []);

  // When PO is selected, load its lines
  useEffect(() => {
    async function loadPoDetails() {
      if (!selectedPoId) {
        setSelectedPo(null);
        setLines([]);
        return;
      }

      const res = await getPurchaseOrderById(selectedPoId);
      if (res.success && res.purchaseOrder) {
        const po = res.purchaseOrder;
        setSelectedPo(po);

        // Populate lines based on pending quantities
        const grnLines: GrnLineState[] = (po.lines || [])
          .filter((l) => l.pending_qty > 0)
          .map((l) => ({
            poLineId: l.id,
            itemId: l.item_id,
            itemName: l.item?.name || "Item",
            itemCode: l.item?.code || "",
            orderedQty: l.ordered_qty,
            pendingQty: l.pending_qty,
            receivedQty: l.pending_qty,
            acceptedQty: l.pending_qty,
            rejectedQty: 0,
            damagedQty: 0,
            unitId: l.unit_id,
            unitSymbol: l.unit?.symbol || "unit",
            conversionRate: l.conversion_rate || 1.0,
            supplierBatchNumber: "",
            manufacturingDate: "",
            expiryDate: "",
            qcStatus: "RELEASED",
            rejectionReason: "",
          }));

        setLines(grnLines);
      }
    }
    loadPoDetails();
  }, [selectedPoId]);

  const updateLine = (index: number, field: keyof GrnLineState, value: any) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-adjust accepted qty when received changes
    if (field === "receivedQty") {
      const rec = Number(value);
      const rej = updated[index].rejectedQty || 0;
      const dam = updated[index].damagedQty || 0;
      updated[index].acceptedQty = Math.max(0, rec - rej - dam);
    }

    setLines(updated);
  };

  const handleSubmit = async (postDirectly: boolean) => {
    setErrorMessage(null);

    if (!selectedPo) {
      setErrorMessage("Please select an approved Purchase Order.");
      return;
    }
    if (!supplierDeliveryChallan.trim()) {
      setErrorMessage("Please enter the Supplier Delivery Challan / DC Number.");
      return;
    }
    if (lines.length === 0) {
      setErrorMessage("This purchase order has no pending quantities left to receive.");
      return;
    }

    // Validate quantities balance
    for (const l of lines) {
      if (l.receivedQty <= 0) {
        setErrorMessage(`Received quantity for "${l.itemName}" must be greater than zero.`);
        return;
      }
      if (Math.abs(l.receivedQty - (l.acceptedQty + l.rejectedQty + l.damagedQty)) > 0.001) {
        setErrorMessage(
          `Balance Error on "${l.itemName}": Received (${l.receivedQty}) does not equal Accepted (${l.acceptedQty}) + Rejected (${l.rejectedQty}) + Damaged (${l.damagedQty}).`
        );
        return;
      }
      if (l.receivedQty > l.pendingQty) {
        setErrorMessage(
          `Over-receipt Violation on "${l.itemName}": Received quantity (${l.receivedQty}) exceeds remaining order quantity (${l.pendingQty}).`
        );
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const res = await createGoodsReceipt({
        purchaseOrderId: selectedPo.id,
        supplierId: selectedPo.supplier_id,
        branchId: selectedPo.branch_id,
        warehouseId: selectedPo.delivery_warehouse_id,
        receiptDate,
        supplierDeliveryChallan: supplierDeliveryChallan.trim(),
        notes,
        lines: lines.map((l) => ({
          poLineId: l.poLineId,
          itemId: l.itemId,
          receivedQty: Number(l.receivedQty),
          acceptedQty: Number(l.acceptedQty),
          rejectedQty: Number(l.rejectedQty),
          damagedQty: Number(l.damagedQty),
          unitId: l.unitId,
          conversionRate: Number(l.conversionRate),
          supplierBatchNumber: l.supplierBatchNumber || undefined,
          manufacturingDate: l.manufacturingDate || undefined,
          expiryDate: l.expiryDate || undefined,
          qcStatus: l.qcStatus,
          rejectionReason: l.rejectionReason || undefined,
        })),
      });

      if (!res.success || !res.grnId) {
        setErrorMessage(res.error || "Failed to create goods receipt note.");
        setIsSubmitting(false);
        return;
      }

      if (postDirectly) {
        const postRes = await postGoodsReceipt(res.grnId);
        if (!postRes.success) {
          alert("GRN created as DRAFT, but posting failed: " + postRes.error);
          router.push(`/goods-receipts/${res.grnId}`);
          return;
        }
      }

      router.push(`/goods-receipts/${res.grnId}`);
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-16 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/goods-receipts">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Truck className="w-6 h-6 text-primary" />
              Inward Goods Receipt Note (GRN)
            </h1>
            <p className="text-sm text-zinc-500">
              Receive raw materials, record supplier batch numbers, inspect quality, and intake into warehouse inventory.
            </p>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-600 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* PO Selector & Receipt Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Receipt Logistics & Order Matching</CardTitle>
          <CardDescription>
            Select the approved purchase order being delivered by the supplier.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="poSelect">Approved Purchase Order *</Label>
              <select
                id="poSelect"
                className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                value={selectedPoId}
                onChange={(e) => setSelectedPoId(e.target.value)}
                required
              >
                <option value="">Select Approved Order</option>
                {approvedOrders.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.po_number} — {p.supplier?.name} ({p.status})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dcNumber">Supplier Delivery Challan / DC Number *</Label>
              <Input
                id="dcNumber"
                placeholder="e.g. DC-2026-9921"
                required
                value={supplierDeliveryChallan}
                onChange={(e) => setSupplierDeliveryChallan(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="receiptDate">Physical Receipt Date *</Label>
              <Input
                id="receiptDate"
                type="date"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Receiving Gate Notes</Label>
              <Input
                id="notes"
                placeholder="e.g. Vehicle TN-59-AB-1234, unloading completed at Bay 1"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {selectedPo && (
            <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded border text-xs grid grid-cols-3 gap-2">
              <div>
                <span className="text-zinc-500">Supplier:</span>{" "}
                <span className="font-semibold">{selectedPo.supplier?.name}</span>
              </div>
              <div>
                <span className="text-zinc-500">Operating Branch:</span>{" "}
                <span>{selectedPo.branch?.name}</span>
              </div>
              <div>
                <span className="text-zinc-500">Intake Warehouse:</span>{" "}
                <span className="font-semibold text-primary">{selectedPo.delivery_warehouse?.name}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Item Receiving Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Delivered Line Items & QC Batch Verification</CardTitle>
          <CardDescription>
            Specify physical count, supplier batch, and quality inspection acceptance. Only ACCEPTED items enter inventory.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[20%]">Item Description</TableHead>
                  <TableHead className="w-[10%] text-right">Pending Qty</TableHead>
                  <TableHead className="w-[12%] text-right">Received</TableHead>
                  <TableHead className="w-[12%] text-right">Accepted</TableHead>
                  <TableHead className="w-[10%] text-right">Rejected</TableHead>
                  <TableHead className="w-[18%]">Supplier Batch / Lot</TableHead>
                  <TableHead className="w-[18%]">Expiry Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-zinc-500">
                      {selectedPoId
                        ? "No pending line items left to receive on this purchase order."
                        : "Please select an approved Purchase Order above to load items."}
                    </TableCell>
                  </TableRow>
                ) : (
                  lines.map((line, idx) => (
                    <TableRow key={line.poLineId}>
                      <TableCell>
                        <div className="font-medium text-xs text-zinc-900 dark:text-zinc-100">
                          {line.itemName}
                        </div>
                        <div className="text-[10px] text-zinc-400 font-mono">
                          {line.itemCode}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono font-medium text-zinc-500">
                        {line.pendingQty} {line.unitSymbol}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="any"
                          min="0.001"
                          max={line.pendingQty}
                          className="h-8 text-xs font-mono text-right"
                          value={line.receivedQty}
                          onChange={(e) => updateLine(idx, "receivedQty", Number(e.target.value))}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          max={line.receivedQty}
                          className="h-8 text-xs font-mono text-right font-bold text-emerald-600"
                          value={line.acceptedQty}
                          onChange={(e) => updateLine(idx, "acceptedQty", Number(e.target.value))}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          max={line.receivedQty}
                          className="h-8 text-xs font-mono text-right text-red-500"
                          value={line.rejectedQty}
                          onChange={(e) => updateLine(idx, "rejectedQty", Number(e.target.value))}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="e.g. LOT-26-881"
                          className="h-8 text-xs font-mono"
                          value={line.supplierBatchNumber}
                          onChange={(e) => updateLine(idx, "supplierBatchNumber", e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          className="h-8 text-xs"
                          value={line.expiryDate}
                          onChange={(e) => updateLine(idx, "expiryDate", e.target.value)}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Buttons */}
      <div className="flex justify-end gap-3 pt-4">
        <Link href="/goods-receipts">
          <Button variant="outline" type="button">
            Cancel
          </Button>
        </Link>
        <Button
          type="button"
          variant="secondary"
          onClick={() => handleSubmit(false)}
          disabled={isSubmitting || lines.length === 0}
        >
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
          Save Draft GRN
        </Button>
        <Button
          type="button"
          onClick={() => handleSubmit(true)}
          disabled={isSubmitting || lines.length === 0}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin mr-1" />
          ) : (
            <CheckCircle2 className="w-4 h-4 mr-1" />
          )}
          Post Immediately to Inventory
        </Button>
      </div>
    </div>
  );
}
