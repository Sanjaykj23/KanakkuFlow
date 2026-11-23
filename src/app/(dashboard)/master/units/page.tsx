"use client";

import React, { useState, useEffect } from "react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Scale,
  Plus,
  ArrowRightLeft,
  Edit2,
  Loader2,
  CheckCircle2,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import {
  getUnits,
  saveUnit,
  getUnitConversions,
  saveUnitConversion,
  seedDefaultMasterData,
} from "@/modules/master/actions";
import { Unit, UnitConversion } from "@/types/database";

export default function UnitsMasterPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [conversions, setConversions] = useState<UnitConversion[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);

  // Unit Modal
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [unitForm, setUnitForm] = useState({
    id: undefined as string | undefined,
    code: "",
    name: "",
    symbol: "",
    isBaseUnit: false,
  });
  const [isSavingUnit, setIsSavingUnit] = useState(false);
  const [unitError, setUnitError] = useState<string | null>(null);

  // Conversion Modal
  const [isConvModalOpen, setIsConvModalOpen] = useState(false);
  const [convForm, setConvForm] = useState({
    id: undefined as string | undefined,
    fromUnitId: "",
    toUnitId: "",
    conversionRate: 1,
  });
  const [isSavingConv, setIsSavingConv] = useState(false);
  const [convError, setConvError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const [uRes, cRes] = await Promise.all([getUnits(), getUnitConversions()]);
    if (uRes.success && uRes.units) setUnits(uRes.units);
    if (cRes.success && cRes.conversions) setConversions(cRes.conversions);
    setLoading(false);
  };

  const handleSeedDefaults = async () => {
    setIsSeeding(true);
    const res = await seedDefaultMasterData();
    setIsSeeding(false);
    if (!res.success) {
      alert("Failed to seed default master data: " + res.error);
    } else {
      loadData();
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openUnitCreate = () => {
    setUnitForm({ id: undefined, code: "", name: "", symbol: "", isBaseUnit: false });
    setUnitError(null);
    setIsUnitModalOpen(true);
  };

  const openUnitEdit = (u: Unit) => {
    setUnitForm({
      id: u.id,
      code: u.code,
      name: u.name,
      symbol: u.symbol,
      isBaseUnit: u.is_base_unit,
    });
    setUnitError(null);
    setIsUnitModalOpen(true);
  };

  const handleSaveUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnitError(null);
    setIsSavingUnit(true);

    const res = await saveUnit(unitForm);
    setIsSavingUnit(false);
    if (!res.success) {
      setUnitError(res.error || "Failed to save unit");
    } else {
      setIsUnitModalOpen(false);
      loadData();
    }
  };

  const openConvCreate = () => {
    setConvForm({
      id: undefined,
      fromUnitId: units[0]?.id || "",
      toUnitId: units[1]?.id || "",
      conversionRate: 1,
    });
    setConvError(null);
    setIsConvModalOpen(true);
  };

  const handleSaveConv = async (e: React.FormEvent) => {
    e.preventDefault();
    setConvError(null);
    setIsSavingConv(true);

    const res = await saveUnitConversion(convForm);
    setIsSavingConv(false);
    if (!res.success) {
      setConvError(res.error || "Failed to save conversion");
    } else {
      setIsConvModalOpen(false);
      loadData();
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Scale className="w-6 h-6 text-primary" />
            Units of Measure & Conversions
          </h1>
          <p className="text-sm text-zinc-500">
            Standard units (KG, G, NOS, BOX) and packaging multi-tier conversion ratios.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={openConvCreate}>
            <ArrowRightLeft className="w-4 h-4 mr-1.5" />
            Add Conversion Factor
          </Button>
          <Button size="sm" onClick={openUnitCreate}>
            <Plus className="w-4 h-4 mr-1.5" />
            New Unit
          </Button>
        </div>
      </div>

      {/* Empty Units Banner */}
      {units.length === 0 && !loading && (
        <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Setup Units & Conversions for Food Manufacturing
              </div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400">
                Load standard units (KG, G, PKT, BOX, NOS) and common conversion factors (1 KG = 1000 G, 1 BOX = 24 PKT) with one click.
              </div>
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleSeedDefaults}
            disabled={isSeeding}
            className="flex-shrink-0"
          >
            {isSeeding ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                Loading Units...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-1.5" />
                Seed Standard Food Units
              </>
            )}
          </Button>
        </div>
      )}

      {/* Grid of Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Units List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <span>Units of Measure ({units.length})</span>
            </CardTitle>
            <CardDescription>
              Base and transactional physical units.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Base Unit</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-zinc-500">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : units.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-zinc-500 text-xs">
                      No units defined. Click &quot;New Unit&quot; to add.
                    </TableCell>
                  </TableRow>
                ) : (
                  units.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-mono text-xs font-bold text-primary">
                        {u.code}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                        {u.name}
                      </TableCell>
                      <TableCell className="text-xs font-mono">{u.symbol}</TableCell>
                      <TableCell>
                        {u.is_base_unit ? (
                          <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500">
                            Base
                          </Badge>
                        ) : (
                          <span className="text-xs text-zinc-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => openUnitEdit(u)}
                        >
                          <Edit2 className="w-3.5 h-3.5 text-zinc-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Conversions List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <span>Conversion Multipliers ({conversions.length})</span>
            </CardTitle>
            <CardDescription>
              e.g., 1 BOX = 24 PACKETS, 1 KG = 1000 GRAMS.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>From Unit</TableHead>
                  <TableHead className="text-center">Ratio</TableHead>
                  <TableHead>To Unit</TableHead>
                  <TableHead className="text-right">Multiplier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-zinc-500">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : conversions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-zinc-500 text-xs">
                      No conversions configured.
                    </TableCell>
                  </TableRow>
                ) : (
                  conversions.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs font-medium">
                        1 {c.from_unit?.name} ({c.from_unit?.code})
                      </TableCell>
                      <TableCell className="text-center text-zinc-400 font-mono text-xs">
                        =
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {c.to_unit?.name} ({c.to_unit?.code})
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono font-bold text-primary">
                        {c.conversion_rate}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Unit Modal */}
      <Dialog open={isUnitModalOpen} onOpenChange={setIsUnitModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-primary" />
              {unitForm.id ? "Edit Unit" : "New Unit of Measure"}
            </DialogTitle>
            <DialogDescription>
              Define unit symbol and base status for inventory costing.
            </DialogDescription>
          </DialogHeader>

          {unitError && (
            <div className="p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-600">
              {unitError}
            </div>
          )}

          <form onSubmit={handleSaveUnit} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label>Unit Code *</Label>
              <Input
                placeholder="e.g. KG, G, PKT, BOX"
                value={unitForm.code}
                onChange={(e) =>
                  setUnitForm({ ...unitForm, code: e.target.value.toUpperCase() })
                }
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Unit Name *</Label>
              <Input
                placeholder="e.g. Kilogram, Gram, Packet, Master Box"
                value={unitForm.name}
                onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Display Symbol *</Label>
              <Input
                placeholder="e.g. kg, g, pkt"
                value={unitForm.symbol}
                onChange={(e) => setUnitForm({ ...unitForm, symbol: e.target.value })}
                required
              />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="isBase"
                checked={unitForm.isBaseUnit}
                onChange={(e) =>
                  setUnitForm({ ...unitForm, isBaseUnit: e.target.checked })
                }
                className="rounded border-zinc-300 text-primary"
              />
              <Label htmlFor="isBase" className="text-xs cursor-pointer">
                Set as Primary Base Unit for this measurement dimension
              </Label>
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsUnitModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSavingUnit}>
                {isSavingUnit ? "Saving..." : "Save Unit"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Conversion Modal */}
      <Dialog open={isConvModalOpen} onOpenChange={setIsConvModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-primary" />
              New Unit Conversion Factor
            </DialogTitle>
            <DialogDescription>
              Define multi-tier conversion ratio (e.g., 1 Box = 24 Packets).
            </DialogDescription>
          </DialogHeader>

          {convError && (
            <div className="p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-600">
              {convError}
            </div>
          )}

          {units.length < 2 && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-700 dark:text-amber-400 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                At least 2 units of measure are required
              </div>
              <p>
                You need at least two units defined to create conversion factors. Click &quot;Seed Standard Food Units&quot; on the page to automatically load them.
              </p>
            </div>
          )}

          <form onSubmit={handleSaveConv} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label>Source Unit (From)</Label>
              <select
                className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                value={convForm.fromUnitId}
                onChange={(e) =>
                  setConvForm({ ...convForm, fromUnitId: e.target.value })
                }
                required
              >
                {units.length === 0 ? (
                  <option value="">No units available</option>
                ) : (
                  units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.code})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="space-y-1">
              <Label>Target Unit (To)</Label>
              <select
                className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                value={convForm.toUnitId}
                onChange={(e) =>
                  setConvForm({ ...convForm, toUnitId: e.target.value })
                }
                required
              >
                {units.length === 0 ? (
                  <option value="">No units available</option>
                ) : (
                  units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.code})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="space-y-1">
              <Label>Conversion Multiplier *</Label>
              <Input
                type="number"
                step="any"
                min="0.000001"
                placeholder="e.g. 24 or 1000"
                value={convForm.conversionRate}
                onChange={(e) =>
                  setConvForm({
                    ...convForm,
                    conversionRate: Number(e.target.value),
                  })
                }
                required
              />
              <span className="text-[10px] text-zinc-500">
                How many target units exist in 1 source unit.
              </span>
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsConvModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSavingConv}>
                {isSavingConv ? "Saving..." : "Save Factor"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
