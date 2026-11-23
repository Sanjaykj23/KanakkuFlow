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
  Percent,
  Plus,
  FileCode,
  Edit2,
  Loader2,
  Calendar,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import {
  getHsnCodes,
  saveHsnCode,
  getTaxRates,
  saveTaxRate,
  seedDefaultMasterData,
} from "@/modules/master/actions";
import { HsnCode, TaxRate } from "@/types/database";

export default function HsnTaxMasterPage() {
  const [hsnCodes, setHsnCodes] = useState<HsnCode[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);

  // HSN Modal
  const [isHsnModalOpen, setIsHsnModalOpen] = useState(false);
  const [hsnForm, setHsnForm] = useState({
    id: undefined as string | undefined,
    code: "",
    description: "",
  });
  const [isSavingHsn, setIsSavingHsn] = useState(false);
  const [hsnError, setHsnError] = useState<string | null>(null);

  // Tax Rate Modal
  const [isTaxModalOpen, setIsTaxModalOpen] = useState(false);
  const [taxForm, setTaxForm] = useState({
    id: undefined as string | undefined,
    name: "",
    igstRate: 12,
    cgstRate: 6,
    sgstRate: 6,
    cessRate: 0,
    effectiveFrom: "2026-01-01",
    effectiveTo: "",
  });
  const [isSavingTax, setIsSavingTax] = useState(false);
  const [taxError, setTaxError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const [hRes, tRes] = await Promise.all([getHsnCodes(), getTaxRates()]);
    if (hRes.success && hRes.hsnCodes) setHsnCodes(hRes.hsnCodes);
    if (tRes.success && tRes.taxRates) setTaxRates(tRes.taxRates);
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

  const openHsnCreate = () => {
    setHsnForm({ id: undefined, code: "", description: "" });
    setHsnError(null);
    setIsHsnModalOpen(true);
  };

  const openHsnEdit = (h: HsnCode) => {
    setHsnForm({ id: h.id, code: h.code, description: h.description });
    setHsnError(null);
    setIsHsnModalOpen(true);
  };

  const handleSaveHsn = async (e: React.FormEvent) => {
    e.preventDefault();
    setHsnError(null);
    setIsSavingHsn(true);

    const res = await saveHsnCode(hsnForm);
    setIsSavingHsn(false);
    if (!res.success) {
      setHsnError(res.error || "Failed to save HSN code");
    } else {
      setIsHsnModalOpen(false);
      loadData();
    }
  };

  const openTaxCreate = () => {
    setTaxForm({
      id: undefined,
      name: "GST 12% (Food Products)",
      igstRate: 12,
      cgstRate: 6,
      sgstRate: 6,
      cessRate: 0,
      effectiveFrom: "2026-01-01",
      effectiveTo: "",
    });
    setTaxError(null);
    setIsTaxModalOpen(true);
  };

  const handleTaxSplitChange = (igst: number) => {
    const half = Number((igst / 2).toFixed(2));
    setTaxForm((prev) => ({
      ...prev,
      igstRate: igst,
      cgstRate: half,
      sgstRate: half,
    }));
  };

  const handleSaveTax = async (e: React.FormEvent) => {
    e.preventDefault();
    setTaxError(null);

    if (Math.abs(taxForm.igstRate - (taxForm.cgstRate + taxForm.sgstRate)) > 0.001) {
      setTaxError("GST Rule: IGST must equal CGST + SGST.");
      return;
    }

    setIsSavingTax(true);
    const res = await saveTaxRate({
      id: taxForm.id,
      name: taxForm.name,
      igstRate: Number(taxForm.igstRate),
      cgstRate: Number(taxForm.cgstRate),
      sgstRate: Number(taxForm.sgstRate),
      cessRate: Number(taxForm.cessRate),
      effectiveFrom: taxForm.effectiveFrom,
      effectiveTo: taxForm.effectiveTo || undefined,
    });

    setIsSavingTax(false);
    if (!res.success) {
      setTaxError(res.error || "Failed to save tax rate");
    } else {
      setIsTaxModalOpen(false);
      loadData();
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Percent className="w-6 h-6 text-primary" />
            HSN Codes & GST Tax Master
          </h1>
          <p className="text-sm text-zinc-500">
            Harmonized System of Nomenclature (HSN) and Indian GST rates (CGST, SGST, IGST).
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={openHsnCreate}>
            <FileCode className="w-4 h-4 mr-1.5" />
            Add HSN Code
          </Button>
          <Button size="sm" onClick={openTaxCreate}>
            <Plus className="w-4 h-4 mr-1.5" />
            New Tax Slab
          </Button>
        </div>
      </div>

      {/* Empty State Banner */}
      {(hsnCodes.length === 0 || taxRates.length === 0) && !loading && (
        <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Setup HSN Codes & GST Slabs for Snacks & Murukku
              </div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400">
                Load standard food HSN codes (1905, 2106, 1101, 1507) and Indian GST slabs (5%, 12%, 18%) with one click.
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
                Loading Tax Data...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-1.5" />
                Seed Standard Food HSN & GST
              </>
            )}
          </Button>
        </div>
      )}

      {/* Grid of Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tax Rates List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              GST Tax Slabs ({taxRates.length})
            </CardTitle>
            <CardDescription>
              Active GST percentage rates applied to invoices and inventory valuation.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tax Name</TableHead>
                  <TableHead>IGST</TableHead>
                  <TableHead>CGST + SGST</TableHead>
                  <TableHead>Effective Period</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-zinc-500">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : taxRates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-zinc-500 text-xs">
                      No tax slabs configured.
                    </TableCell>
                  </TableRow>
                ) : (
                  taxRates.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        {t.name}
                      </TableCell>
                      <TableCell className="text-xs font-mono font-bold text-primary">
                        {t.igst_rate}%
                      </TableCell>
                      <TableCell className="text-xs font-mono text-zinc-600 dark:text-zinc-400">
                        {t.cgst_rate}% + {t.sgst_rate}%
                      </TableCell>
                      <TableCell className="text-xs text-zinc-500">
                        From {new Date(t.effective_from).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* HSN Codes List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              HSN Codes ({hsnCodes.length})
            </CardTitle>
            <CardDescription>
              GST classification codes (e.g. 1905 for Murukku & Savoury snacks).
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>HSN Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-6 text-zinc-500">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : hsnCodes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-6 text-zinc-500 text-xs">
                      No HSN codes configured.
                    </TableCell>
                  </TableRow>
                ) : (
                  hsnCodes.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="font-mono text-xs font-bold text-primary">
                        {h.code}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-600 dark:text-zinc-300">
                        {h.description}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => openHsnEdit(h)}
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
      </div>

      {/* Tax Rate Modal */}
      <Dialog open={isTaxModalOpen} onOpenChange={setIsTaxModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Percent className="w-5 h-5 text-primary" />
              Configure GST Tax Slab
            </DialogTitle>
            <DialogDescription>
              Set interstate IGST and intrastate CGST/SGST rates.
            </DialogDescription>
          </DialogHeader>

          {taxError && (
            <div className="p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-600">
              {taxError}
            </div>
          )}

          <form onSubmit={handleSaveTax} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label>Tax Slab Name *</Label>
              <Input
                placeholder="e.g. GST 12% - Snacks"
                value={taxForm.name}
                onChange={(e) => setTaxForm({ ...taxForm, name: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label>Total IGST (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={taxForm.igstRate}
                  onChange={(e) => handleTaxSplitChange(Number(e.target.value))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>CGST (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={taxForm.cgstRate}
                  onChange={(e) =>
                    setTaxForm({ ...taxForm, cgstRate: Number(e.target.value) })
                  }
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>SGST (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={taxForm.sgstRate}
                  onChange={(e) =>
                    setTaxForm({ ...taxForm, sgstRate: Number(e.target.value) })
                  }
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <Label>Effective From *</Label>
                <Input
                  type="date"
                  value={taxForm.effectiveFrom}
                  onChange={(e) =>
                    setTaxForm({ ...taxForm, effectiveFrom: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Effective To (Optional)</Label>
                <Input
                  type="date"
                  value={taxForm.effectiveTo}
                  onChange={(e) =>
                    setTaxForm({ ...taxForm, effectiveTo: e.target.value })
                  }
                />
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsTaxModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSavingTax}>
                {isSavingTax ? "Saving..." : "Save Tax Slab"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* HSN Modal */}
      <Dialog open={isHsnModalOpen} onOpenChange={setIsHsnModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCode className="w-5 h-5 text-primary" />
              {hsnForm.id ? "Edit HSN Code" : "New HSN Code"}
            </DialogTitle>
            <DialogDescription>
              GST HSN classification code and official item description.
            </DialogDescription>
          </DialogHeader>

          {hsnError && (
            <div className="p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-600">
              {hsnError}
            </div>
          )}

          <form onSubmit={handleSaveHsn} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label>HSN Code *</Label>
              <Input
                placeholder="e.g. 1905, 2106"
                value={hsnForm.code}
                onChange={(e) => setHsnForm({ ...hsnForm, code: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>HSN Description *</Label>
              <Input
                placeholder="e.g. Bread, pastry, cakes, biscuits, murukku and other bakers' wares"
                value={hsnForm.description}
                onChange={(e) =>
                  setHsnForm({ ...hsnForm, description: e.target.value })
                }
                required
              />
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsHsnModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSavingHsn}>
                {isSavingHsn ? "Saving..." : "Save HSN"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
