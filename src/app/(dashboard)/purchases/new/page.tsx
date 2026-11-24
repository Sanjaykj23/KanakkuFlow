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
  FileSpreadsheet,
  Plus,
  Trash2,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Building2,
  Truck,
  Warehouse as WarehouseIcon,
  Calendar,
} from "lucide-react";
import { createPurchaseOrder, submitPurchaseOrder } from "@/modules/purchases/actions";
import { getSuppliers, getItems, getUnits, getTaxRates, getWarehouses } from "@/modules/master/actions";
import { getCompanyBranches } from "@/modules/users/actions";
import { Supplier, Item, Unit, TaxRate, Warehouse } from "@/types/database";

interface OrderLineState {
  itemId: string;
  orderedQty: number;
  unitId: string;
  conversionRate: number;
  unitPrice: number;
  discount: number;
  taxRateId: string;
  taxRateSnapshot: number;
  notes: string;
}

export default function NewPurchaseOrderPage() {
  const router = useRouter();

  // Reference Data
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [branches, setBranches] = useState<{ id: string; code: string; name: string }[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(true);

  // Form State
  const [branchId, setBranchId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [deliveryWarehouseId, setDeliveryWarehouseId] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");

  const [lines, setLines] = useState<OrderLineState[]>([
    {
      itemId: "",
      orderedQty: 100,
      unitId: "",
      conversionRate: 1.0,
      unitPrice: 0,
      discount: 0,
      taxRateId: "",
      taxRateSnapshot: 0,
      notes: "",
    },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadAllRefs() {
      setLoadingRefs(true);
      const [supRes, itemRes, unitRes, taxRes, whRes, bList] = await Promise.all([
        getSuppliers(),
        getItems(),
        getUnits(),
        getTaxRates(),
        getWarehouses(),
        getCompanyBranches(),
      ]);

      if (supRes.success && supRes.suppliers) setSuppliers(supRes.suppliers);
      if (itemRes.success && itemRes.items) setItems(itemRes.items);
      if (unitRes.success && unitRes.units) setUnits(unitRes.units);
      if (taxRes.success && taxRes.taxRates) setTaxRates(taxRes.taxRates);
      if (whRes.success && whRes.warehouses) setWarehouses(whRes.warehouses);
      setBranches(bList);

      if (bList.length > 0) setBranchId(bList[0].id);
      if (supRes.suppliers && supRes.suppliers.length > 0) setSupplierId(supRes.suppliers[0].id);
      if (whRes.warehouses && whRes.warehouses.length > 0) setDeliveryWarehouseId(whRes.warehouses[0].id);

      setLoadingRefs(false);
    }
    loadAllRefs();
  }, []);

  const handleItemSelect = (index: number, itemId: string) => {
    const selectedItem = items.find((i) => i.id === itemId);
    if (!selectedItem) return;

    const matchedTax = taxRates.find((t) => t.id === selectedItem.default_tax_rate_id);
    const taxSnapshot = matchedTax ? matchedTax.igst_rate : 0;

    const updated = [...lines];
    updated[index] = {
      ...updated[index],
      itemId,
      unitId: selectedItem.primary_unit_id,
      conversionRate: 1.0,
      unitPrice: selectedItem.base_price || 0,
      taxRateId: selectedItem.default_tax_rate_id || "",
      taxRateSnapshot: taxSnapshot,
    };
    setLines(updated);
  };

  const handleAddLine = () => {
    setLines([
      ...lines,
      {
        itemId: "",
        orderedQty: 10,
        unitId: units[0]?.id || "",
        conversionRate: 1.0,
        unitPrice: 0,
        discount: 0,
        taxRateId: "",
        taxRateSnapshot: 0,
        notes: "",
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length === 1) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLineField = (index: number, field: keyof OrderLineState, val: any) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: val };

    if (field === "taxRateId") {
      const matchedTax = taxRates.find((t) => t.id === val);
      updated[index].taxRateSnapshot = matchedTax ? matchedTax.igst_rate : 0;
    }

    setLines(updated);
  };

  // Calculations in Paisa
  let subtotalPaisa = 0;
  let totalDiscountPaisa = 0;
  let totalTaxPaisa = 0;

  lines.forEach((l) => {
    const unitPricePaisa = Math.round((l.unitPrice || 0) * 100);
    const discPaisa = Math.round((l.discount || 0) * 100);
    const lineSubtotalPaisa = Math.round((l.orderedQty || 0) * unitPricePaisa);
    const taxablePaisa = Math.max(0, lineSubtotalPaisa - discPaisa);
    const taxPaisa = Math.round(taxablePaisa * ((l.taxRateSnapshot || 0) / 100));

    subtotalPaisa += lineSubtotalPaisa;
    totalDiscountPaisa += discPaisa;
    totalTaxPaisa += taxPaisa;
  });

  const grandTotalPaisa = Math.max(0, subtotalPaisa - totalDiscountPaisa + totalTaxPaisa);

  const handleSubmit = async (submitNow: boolean) => {
    setErrorMessage(null);

    if (!supplierId) {
      setErrorMessage("Please select a supplier.");
      return;
    }
    if (!deliveryWarehouseId) {
      setErrorMessage("Please select a delivery warehouse.");
      return;
    }
    const emptyItem = lines.find((l) => !l.itemId);
    if (emptyItem) {
      setErrorMessage("Please select an item for all lines.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await createPurchaseOrder({
        branchId,
        supplierId,
        deliveryWarehouseId,
        orderDate,
        expectedDeliveryDate,
        notes,
        lines: lines.map((l) => ({
          itemId: l.itemId,
          orderedQty: Number(l.orderedQty),
          unitId: l.unitId,
          conversionRate: Number(l.conversionRate) || 1.0,
          unitPrice: Number(l.unitPrice),
          discount: Number(l.discount) || 0,
          taxRateId: l.taxRateId || undefined,
          taxRateSnapshot: Number(l.taxRateSnapshot) || 0,
          notes: l.notes,
        })),
      });

      if (!res.success || !res.poId) {
        setErrorMessage(res.error || "Failed to create purchase order.");
        setIsSubmitting(false);
        return;
      }

      if (submitNow) {
        await submitPurchaseOrder(res.poId);
      }

      router.push(`/purchases/${res.poId}`);
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
          <Link href="/purchases">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-primary" />
              New Purchase Order
            </h1>
            <p className="text-sm text-zinc-500">
              Procure flour, oils, spices, and packaging materials from verified suppliers.
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

      {/* PO Header Configuration */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Order Logistics & Commercial Terms</CardTitle>
          <CardDescription>
            Specify supplier contract destination and scheduled receipt window.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="supplier">Supplier / Vendor *</Label>
              <select
                id="supplier"
                className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                required
              >
                {suppliers.length === 0 ? (
                  <option value="">No suppliers configured</option>
                ) : (
                  suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="branch">Operating Branch *</Label>
              <select
                id="branch"
                className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                required
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="warehouse">Delivery Receiving Warehouse *</Label>
              <select
                id="warehouse"
                className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                value={deliveryWarehouseId}
                onChange={(e) => setDeliveryWarehouseId(e.target.value)}
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="orderDate">Order Date *</Label>
              <Input
                id="orderDate"
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expectedDate">Expected Delivery Date *</Label>
              <Input
                id="expectedDate"
                type="date"
                value={expectedDeliveryDate}
                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Order Notes / Terms</Label>
              <Input
                id="notes"
                placeholder="e.g. Standard delivery to Gate 2, certificate of analysis required"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line Items Table */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-medium">Purchase Order Line Items</CardTitle>
            <CardDescription>
              Raw materials, ingredients, or packaging pouches being procured.
            </CardDescription>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={handleAddLine}>
            <Plus className="w-4 h-4 mr-1" />
            Add Item Line
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[30%]">Item Description</TableHead>
                  <TableHead className="w-[12%]">Quantity</TableHead>
                  <TableHead className="w-[12%]">Unit</TableHead>
                  <TableHead className="w-[15%]">Rate (₹)</TableHead>
                  <TableHead className="w-[12%]">Tax Slab</TableHead>
                  <TableHead className="text-right w-[15%]">Line Total (₹)</TableHead>
                  <TableHead className="w-[4%]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line, idx) => {
                  const lineUnitPricePaisa = Math.round((line.unitPrice || 0) * 100);
                  const lineDiscPaisa = Math.round((line.discount || 0) * 100);
                  const taxablePaisa = Math.max(0, Math.round((line.orderedQty || 0) * lineUnitPricePaisa - lineDiscPaisa));
                  const taxPaisa = Math.round(taxablePaisa * ((line.taxRateSnapshot || 0) / 100));
                  const lineTotalPaisa = taxablePaisa + taxPaisa;

                  return (
                    <TableRow key={idx}>
                      <TableCell>
                        <select
                          className="w-full px-2.5 py-1.5 border rounded-md text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                          value={line.itemId}
                          onChange={(e) => handleItemSelect(idx, e.target.value)}
                          required
                        >
                          <option value="">Select Item / Raw Material</option>
                          {items.map((it) => (
                            <option key={it.id} value={it.id}>
                              {it.name} ({it.code})
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="any"
                          min="0.001"
                          className="h-8 text-xs"
                          value={line.orderedQty}
                          onChange={(e) => updateLineField(idx, "orderedQty", Number(e.target.value))}
                        />
                      </TableCell>
                      <TableCell>
                        <select
                          className="w-full px-2 py-1.5 border rounded-md text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                          value={line.unitId}
                          onChange={(e) => updateLineField(idx, "unitId", e.target.value)}
                        >
                          {units.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.symbol})
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="h-8 text-xs font-mono"
                          value={line.unitPrice}
                          onChange={(e) => updateLineField(idx, "unitPrice", Number(e.target.value))}
                        />
                      </TableCell>
                      <TableCell>
                        <select
                          className="w-full px-2 py-1.5 border rounded-md text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                          value={line.taxRateId}
                          onChange={(e) => updateLineField(idx, "taxRateId", e.target.value)}
                        >
                          <option value="">0% (Nil)</option>
                          {taxRates.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} ({t.igst_rate}%)
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100">
                        ₹{(lineTotalPaisa / 100).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                          onClick={() => handleRemoveLine(idx)}
                          disabled={lines.length === 1}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Financial Summary & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-6">
        <div className="text-xs text-zinc-500 space-y-1">
          <p>• Prices are snapshotted upon submission and protected from backward recalculation.</p>
          <p>• Goods Receipt Notes (GRN) will require an APPROVED purchase order before materials can be received.</p>
        </div>

        <Card className="w-full md:w-80">
          <CardContent className="pt-4 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-500">Order Subtotal:</span>
              <span className="font-mono font-medium">₹{(subtotalPaisa / 100).toFixed(2)}</span>
            </div>
            {totalDiscountPaisa > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount:</span>
                <span className="font-mono">-₹{(totalDiscountPaisa / 100).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-zinc-500">GST Tax:</span>
              <span className="font-mono font-medium">₹{(totalTaxPaisa / 100).toFixed(2)}</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-bold text-sm text-zinc-900 dark:text-zinc-100">
              <span>Total Payable:</span>
              <span className="font-mono text-primary">₹{(grandTotalPaisa / 100).toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Link href="/purchases">
          <Button variant="outline" type="button">
            Cancel
          </Button>
        </Link>
        <Button
          type="button"
          variant="secondary"
          onClick={() => handleSubmit(false)}
          disabled={isSubmitting}
        >
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
          Save as Draft
        </Button>
        <Button
          type="button"
          onClick={() => handleSubmit(true)}
          disabled={isSubmitting}
        >
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
          Save & Submit for Approval
        </Button>
      </div>
    </div>
  );
}
