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
  ChefHat,
  ArrowLeft,
  Plus,
  Trash2,
  AlertTriangle,
  Loader2,
  Save,
} from "lucide-react";
import { createBom } from "@/modules/production/actions";
import { getItems, getUnits } from "@/modules/master/actions";
import { Item, Unit, BomType, BomComponentType } from "@/types/database";

export default function NewRecipePage() {
  const router = useRouter();

  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  // Form Fields
  const [productId, setProductId] = useState("");
  const [bomType, setBomType] = useState<BomType>("BULK_WIP");
  const [version, setVersion] = useState("v1.0");
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split("T")[0]);
  const [expectedOutputQty, setExpectedOutputQty] = useState<number | "">(100);
  const [outputUnitId, setOutputUnitId] = useState("");
  const [expectedYieldPercent, setExpectedYieldPercent] = useState<number | "">(100);
  const [laborOverhead, setLaborOverhead] = useState<number | "">(0);
  const [notes, setNotes] = useState("");

  const [lines, setLines] = useState<
    Array<{
      componentItemId: string;
      componentType: BomComponentType;
      quantity: number;
      unitId: string;
      expectedWastagePercent: number;
      notes: string;
    }>
  >([]);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const [itemsRes, unitsRes] = await Promise.all([getItems(), getUnits()]);
      if (itemsRes.success && itemsRes.items) {
        setItems(itemsRes.items);
        if (itemsRes.items.length > 0) setProductId(itemsRes.items[0].id);
      }
      if (unitsRes.success && unitsRes.units) {
        setUnits(unitsRes.units);
        if (unitsRes.units.length > 0) setOutputUnitId(unitsRes.units[0].id);
      }
    }
    init();
  }, []);

  const handleAddLine = () => {
    if (items.length === 0 || units.length === 0) return;
    setLines([
      ...lines,
      {
        componentItemId: items[0].id,
        componentType: bomType === "PACKAGING" ? "PACKAGING" : "RAW_MATERIAL",
        quantity: 10,
        unitId: units[0].id,
        expectedWastagePercent: 0,
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
    setLines(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (lines.length === 0) {
      setErrorMessage("Please add at least one component ingredient line.");
      return;
    }

    // Circular dependency check
    const hasSelfReference = lines.some((l) => l.componentItemId === productId);
    if (hasSelfReference) {
      setErrorMessage("Circular Dependency: The output product cannot be an input ingredient in its own recipe.");
      return;
    }

    setSubmitting(true);
    const res = await createBom({
      productId,
      bomType,
      version: version.trim(),
      effectiveDate,
      status: "ACTIVE",
      expectedOutputQty: Number(expectedOutputQty) || 1,
      outputUnitId,
      expectedYieldPercent: Number(expectedYieldPercent) || 100,
      expectedWastagePercent: 0,
      laborOverheadCostPaisa: Math.round((Number(laborOverhead) || 0) * 100),
      notes: notes.trim(),
      lines: lines.map((l) => ({
        componentItemId: l.componentItemId,
        componentType: l.componentType,
        quantity: l.quantity,
        unitId: l.unitId,
        conversionRate: 1.0,
        expectedWastagePercent: l.expectedWastagePercent,
        notes: l.notes.trim(),
      })),
    });
    setSubmitting(false);

    if (!res.success) {
      setErrorMessage(res.error || "Failed to create BOM");
    } else {
      router.push("/production/recipes");
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center gap-2">
        <Link
          href="/production/recipes"
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Recipes
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <ChefHat className="w-6 h-6 text-primary" />
          Create Bill of Materials (BOM)
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Define standard material ratios, bulk formulations, and packaging bills.
        </p>
      </div>

      {errorMessage && (
        <div className="p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-md text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header Parameters */}
        <Card>
          <CardHeader className="py-4 px-6 border-b border-zinc-200 dark:border-zinc-800">
            <CardTitle className="text-base font-semibold">Formula Parameters</CardTitle>
            <CardDescription className="text-xs">
              Output product, manufacturing stage, and expected batch yield
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Output Product *</Label>
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
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
                <Label className="text-xs font-semibold">BOM Type *</Label>
                <select
                  value={bomType}
                  onChange={(e) => setBomType(e.target.value as any)}
                  className="w-full h-9 px-3 text-xs bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="BULK_WIP">Bulk WIP (Stage 1: Frying / Dough)</option>
                  <option value="PACKAGING">Packaging (Stage 2: Packets / Pouches)</option>
                  <option value="FINISHED_GOODS">Direct Finished Goods</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Recipe Version *</Label>
                <Input
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="e.g. v1.0, Summer-Formula"
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Expected Output Batch Qty *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={expectedOutputQty}
                  onChange={(e) => setExpectedOutputQty(e.target.value === "" ? "" : Number(e.target.value))}
                  className="h-9 text-xs font-mono"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Output Unit *</Label>
                <select
                  value={outputUnitId}
                  onChange={(e) => setOutputUnitId(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.symbol})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Expected Yield %</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="1"
                  value={expectedYieldPercent}
                  onChange={(e) => setExpectedYieldPercent(e.target.value === "" ? "" : Number(e.target.value))}
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Estimated Direct Labor / Overhead (₹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={laborOverhead}
                  onChange={(e) => setLaborOverhead(e.target.value === "" ? "" : Number(e.target.value))}
                  className="h-9 text-xs font-mono"
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Notes / Process Standard</Label>
                <Input
                  placeholder="e.g. Oil temperature 180°C, fry time 3.5 mins"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recipe Component Lines */}
        <Card>
          <CardHeader className="py-4 px-6 border-b border-zinc-200 dark:border-zinc-800 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Recipe Components & Proportions</CardTitle>
              <CardDescription className="text-xs">
                Ingredients or packaging materials consumed per standard output batch
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddLine}
              className="flex items-center gap-1.5 text-xs"
            >
              <Plus className="w-3.5 h-3.5" /> Add Component
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-zinc-50 dark:bg-zinc-900/50">
                    <TableHead className="text-xs font-semibold w-[35%]">Component Item *</TableHead>
                    <TableHead className="text-xs font-semibold w-[20%]">Component Type</TableHead>
                    <TableHead className="text-xs font-semibold w-[140px] text-right">Required Qty *</TableHead>
                    <TableHead className="text-xs font-semibold w-[120px]">Unit</TableHead>
                    <TableHead className="text-xs font-semibold w-[100px] text-right">Wastage %</TableHead>
                    <TableHead className="text-xs font-semibold text-right w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-xs text-zinc-500">
                        No recipe components added. Click &quot;Add Component&quot; to build the formula.
                      </TableCell>
                    </TableRow>
                  ) : (
                    lines.map((line, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <select
                            value={line.componentItemId}
                            onChange={(e) => handleLineChange(idx, "componentItemId", e.target.value)}
                            className="w-full h-8 px-2 text-xs bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                            required
                          >
                            {items
                              .filter((it) => it.id !== productId) // Filter out output product
                              .map((it) => (
                                <option key={it.id} value={it.id}>
                                  {it.name} ({it.code})
                                </option>
                              ))}
                          </select>
                        </TableCell>
                        <TableCell>
                          <select
                            value={line.componentType}
                            onChange={(e) => handleLineChange(idx, "componentType", e.target.value)}
                            className="w-full h-8 px-2 text-xs bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option value="RAW_MATERIAL">Raw Material</option>
                            <option value="PACKAGING">Packaging</option>
                            <option value="BULK_WIP">Bulk WIP</option>
                          </select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={line.quantity}
                            onChange={(e) =>
                              handleLineChange(idx, "quantity", Number(e.target.value))
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
                        <TableCell>
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
                            value={line.expectedWastagePercent}
                            onChange={(e) =>
                              handleLineChange(idx, "expectedWastagePercent", Number(e.target.value))
                            }
                            className="h-8 text-xs font-mono text-right"
                          />
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

        {/* Action Footer */}
        <div className="flex justify-end gap-3">
          <Link href="/production/recipes">
            <Button type="button" variant="outline" disabled={submitting}>
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={submitting} className="flex items-center gap-1.5">
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving Formula...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save BOM Recipe</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
