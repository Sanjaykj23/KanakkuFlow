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
  Package,
  Plus,
  Search,
  Edit2,
  Boxes,
  Loader2,
  Calendar,
  CheckCircle2,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import {
  getItems,
  saveItem,
  getUnits,
  getHsnCodes,
  getTaxRates,
  seedDefaultMasterData,
} from "@/modules/master/actions";
import { Item, Unit, HsnCode, TaxRate, ItemType } from "@/types/database";

export default function ItemsMasterPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [hsnCodes, setHsnCodes] = useState<HsnCode[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [isSeeding, setIsSeeding] = useState(false);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    id?: string;
    code: string;
    name: string;
    itemType: ItemType;
    category: string;
    primaryUnitId: string;
    hsnCodeId: string;
    defaultTaxRateId: string;
    mrp: number;
    basePrice: number;
    reorderLevel: number;
    shelfLifeDays: number | "";
    isFefoTracked: boolean;
  }>({
    code: "",
    name: "",
    itemType: "FINISHED_GOOD",
    category: "MURUKKU",
    primaryUnitId: "",
    hsnCodeId: "",
    defaultTaxRateId: "",
    mrp: 50,
    basePrice: 38,
    reorderLevel: 100,
    shelfLifeDays: 90,
    isFefoTracked: true,
  });

  const loadData = async () => {
    setLoading(true);
    const [itemsRes, unitsRes, hsnRes, taxRes] = await Promise.all([
      getItems(),
      getUnits(),
      getHsnCodes(),
      getTaxRates(),
    ]);

    if (itemsRes.success && itemsRes.items) setItems(itemsRes.items);
    if (unitsRes.success && unitsRes.units) setUnits(unitsRes.units);
    if (hsnRes.success && hsnRes.hsnCodes) setHsnCodes(hsnRes.hsnCodes);
    if (taxRes.success && taxRes.taxRates) setTaxRates(taxRes.taxRates);
    setLoading(false);
  };

  const handleSeedDefaults = async () => {
    setIsSeeding(true);
    const res = await seedDefaultMasterData();
    setIsSeeding(false);
    if (!res.success) {
      alert("Failed to seed default master data: " + res.error);
    } else {
      const [itemsRes, unitsRes, hsnRes, taxRes] = await Promise.all([
        getItems(),
        getUnits(),
        getHsnCodes(),
        getTaxRates(),
      ]);
      if (itemsRes.success && itemsRes.items) setItems(itemsRes.items);
      if (unitsRes.success && unitsRes.units) {
        const uList = unitsRes.units;
        setUnits(uList);
        if (!formData.primaryUnitId && uList.length > 0) {
          setFormData((prev) => ({
            ...prev,
            primaryUnitId: uList[0].id,
          }));
        }
      }
      if (hsnRes.success && hsnRes.hsnCodes) {
        const hList = hsnRes.hsnCodes;
        setHsnCodes(hList);
        if (!formData.hsnCodeId && hList.length > 0) {
          setFormData((prev) => ({
            ...prev,
            hsnCodeId: hList[0].id,
          }));
        }
      }
      if (taxRes.success && taxRes.taxRates) {
        const tList = taxRes.taxRates;
        setTaxRates(tList);
        if (!formData.defaultTaxRateId && tList.length > 0) {
          setFormData((prev) => ({
            ...prev,
            defaultTaxRateId: tList[0].id,
          }));
        }
      }
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setFormData({
      code: "",
      name: "",
      itemType: "FINISHED_GOOD",
      category: "MURUKKU",
      primaryUnitId: units[0]?.id || "",
      hsnCodeId: hsnCodes[0]?.id || "",
      defaultTaxRateId: taxRates[0]?.id || "",
      mrp: 50,
      basePrice: 38,
      reorderLevel: 100,
      shelfLifeDays: 90,
      isFefoTracked: true,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: Item) => {
    setFormData({
      id: item.id,
      code: item.code,
      name: item.name,
      itemType: item.item_type,
      category: item.category,
      primaryUnitId: item.primary_unit_id,
      hsnCodeId: item.hsn_code_id || "",
      defaultTaxRateId: item.default_tax_rate_id || "",
      mrp: item.mrp,
      basePrice: item.base_price,
      reorderLevel: item.reorder_level,
      shelfLifeDays: item.shelf_life_days || "",
      isFefoTracked: item.is_fefo_tracked,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSaving(true);

    const res = await saveItem({
      id: formData.id,
      code: formData.code,
      name: formData.name,
      itemType: formData.itemType,
      category: formData.category,
      primaryUnitId: formData.primaryUnitId,
      hsnCodeId: formData.hsnCodeId || undefined,
      defaultTaxRateId: formData.defaultTaxRateId || undefined,
      mrp: Number(formData.mrp),
      basePrice: Number(formData.basePrice),
      reorderLevel: Number(formData.reorderLevel),
      shelfLifeDays: formData.shelfLifeDays ? Number(formData.shelfLifeDays) : undefined,
      isFefoTracked: formData.isFefoTracked,
    });

    setIsSaving(false);
    if (!res.success) {
      setFormError(res.error || "Failed to save item");
    } else {
      setIsModalOpen(false);
      loadData();
    }
  };

  const filteredItems = items.filter((it) => {
    const matchesType = typeFilter === "ALL" || it.item_type === typeFilter;
    const matchesSearch =
      !searchQuery.trim() ||
      it.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      it.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      it.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" />
            Items & Product Master
          </h1>
          <p className="text-sm text-zinc-500">
            Finished snacks, raw ingredients, seasonings, and nitrogen packaging materials.
          </p>
        </div>
        <Button size="sm" onClick={openCreateModal} className="flex items-center gap-1.5">
          <Plus className="w-4 h-4" />
          Add Item
        </Button>
      </div>

      {/* Empty State Banner to Seed Master Data */}
      {(units.length === 0 || hsnCodes.length === 0 || taxRates.length === 0) && !loading && (
        <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Quick Setup: Standard Food Industry Master Data Not Loaded Yet
              </div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400">
                Populate standard packaging units (KG, G, PKT, BOX), HSN codes (1905, 2106), GST slabs (5%, 12%, 18%), and Warehouses with one click.
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
                Loading Defaults...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-1.5" />
                Seed Food Industry Defaults
              </>
            )}
          </Button>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
              <Input
                placeholder="Search by code, product name, or category..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {[
                { label: "All Items", value: "ALL" },
                { label: "Finished Goods", value: "FINISHED_GOOD" },
                { label: "Raw Materials", value: "RAW_MATERIAL" },
                { label: "Packaging", value: "PACKAGING" },
              ].map((f) => (
                <Button
                  key={f.value}
                  size="sm"
                  variant={typeFilter === f.value ? "default" : "outline"}
                  onClick={() => setTypeFilter(f.value)}
                  className="text-xs"
                >
                  {f.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">
            Product Catalog ({filteredItems.length})
          </CardTitle>
          <CardDescription>
            Configured products with FEFO shelf-life tracking and GST tax slabs.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Type & Category</TableHead>
                  <TableHead>Primary Unit</TableHead>
                  <TableHead>Base Price</TableHead>
                  <TableHead>MRP</TableHead>
                  <TableHead>Shelf Life</TableHead>
                  <TableHead>FEFO</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-zinc-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                      Loading items...
                    </TableCell>
                  </TableRow>
                ) : filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-zinc-500">
                      No items found. Click &quot;Add Item&quot; to create your first SKU.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs font-bold text-primary">
                        {item.code}
                      </TableCell>
                      <TableCell className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                        {item.name}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-[10px] mr-1">
                          {item.item_type}
                        </Badge>
                        <span className="text-zinc-500">{item.category}</span>
                      </TableCell>
                      <TableCell className="text-xs text-zinc-600 dark:text-zinc-400">
                        {item.primary_unit?.name || "Unit"} ({item.primary_unit?.symbol})
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        ₹{Number(item.base_price).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-emerald-600">
                        ₹{Number(item.mrp).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-500">
                        {item.shelf_life_days ? `${item.shelf_life_days} Days` : "—"}
                      </TableCell>
                      <TableCell>
                        {item.is_fefo_tracked ? (
                          <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500">
                            Active
                          </Badge>
                        ) : (
                          <span className="text-xs text-zinc-400">No</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => openEditModal(item)}
                        >
                          <Edit2 className="w-4 h-4 text-zinc-500" />
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

      {/* Item Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              {formData.id ? "Edit Item" : "Create New Item"}
            </DialogTitle>
            <DialogDescription>
              Define item SKU, pricing, unit of measure, and shelf-life tracking parameters.
            </DialogDescription>
          </DialogHeader>

          {(units.length === 0 || hsnCodes.length === 0 || taxRates.length === 0) && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>
                  Units, HSN, and GST slabs are not loaded yet for your company.
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleSeedDefaults}
                disabled={isSeeding}
                className="h-7 text-xs border-amber-300 text-amber-900 dark:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-900/40"
              >
                {isSeeding ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 mr-1 text-primary" />
                )}
                Load FMCG Defaults
              </Button>
            </div>
          )}

          {formError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-600">
              {formError}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="code">Item Code / SKU *</Label>
                <Input
                  id="code"
                  placeholder="e.g., FG-MRK-200G"
                  required
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value.toUpperCase() })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="name">Item Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Butter Murukku 200g Packet"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="itemType">Item Type *</Label>
                <select
                  id="itemType"
                  className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                  value={formData.itemType}
                  onChange={(e) =>
                    setFormData({ ...formData, itemType: e.target.value as ItemType })
                  }
                >
                  <option value="FINISHED_GOOD">Finished Good (Packaged Snack)</option>
                  <option value="SEMI_FINISHED">Semi-Finished (Bulk Fried)</option>
                  <option value="RAW_MATERIAL">Raw Material (Flour, Oil, Spices)</option>
                  <option value="PACKAGING">Packaging (Pouches, Cartons)</option>
                  <option value="CONSUMABLE">Consumable</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  placeholder="e.g., MURUKKU, SEEDAI, MIXTURE"
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value.toUpperCase() })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="unit">Primary Unit *</Label>
                <select
                  id="unit"
                  className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                  value={formData.primaryUnitId}
                  onChange={(e) =>
                    setFormData({ ...formData, primaryUnitId: e.target.value })
                  }
                  required
                >
                  <option value="">
                    {units.length === 0 ? "No units available (Load defaults first)" : "Select Unit"}
                  </option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.symbol})
                    </option>
                  ))}
                </select>
                {units.length === 0 && (
                  <p className="text-[10px] text-amber-600">
                    No units loaded yet.
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="hsn">HSN Code</Label>
                <select
                  id="hsn"
                  className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                  value={formData.hsnCodeId}
                  onChange={(e) =>
                    setFormData({ ...formData, hsnCodeId: e.target.value })
                  }
                >
                  <option value="">
                    {hsnCodes.length === 0 ? "No HSN codes available" : "None"}
                  </option>
                  {hsnCodes.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.code} - {h.description.slice(0, 20)}
                    </option>
                  ))}
                </select>
                {hsnCodes.length === 0 && (
                  <p className="text-[10px] text-amber-600">
                    No HSN codes loaded yet.
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="taxRate">GST Tax Slab</Label>
                <select
                  id="taxRate"
                  className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                  value={formData.defaultTaxRateId}
                  onChange={(e) =>
                    setFormData({ ...formData, defaultTaxRateId: e.target.value })
                  }
                >
                  <option value="">
                    {taxRates.length === 0 ? "No Tax Slabs available" : "None"}
                  </option>
                  {taxRates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.igst_rate}%)
                    </option>
                  ))}
                </select>
                {taxRates.length === 0 && (
                  <p className="text-[10px] text-amber-600">
                    No GST slabs loaded yet.
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="basePrice">Base Price (₹)</Label>
                <Input
                  id="basePrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.basePrice}
                  onChange={(e) =>
                    setFormData({ ...formData, basePrice: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="mrp">MRP (₹)</Label>
                <Input
                  id="mrp"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.mrp}
                  onChange={(e) =>
                    setFormData({ ...formData, mrp: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="shelfLife">Shelf Life (Days)</Label>
                <Input
                  id="shelfLife"
                  type="number"
                  min="1"
                  placeholder="e.g. 90"
                  value={formData.shelfLifeDays}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      shelfLifeDays: e.target.value === "" ? "" : Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="isFefo"
                checked={formData.isFefoTracked}
                onChange={(e) =>
                  setFormData({ ...formData, isFefoTracked: e.target.checked })
                }
                className="rounded border-zinc-300 text-primary focus:ring-primary h-4 w-4"
              />
              <Label htmlFor="isFefo" className="text-xs cursor-pointer">
                Enable FEFO Batch Picking (First-Expired, First-Out physical dispatch enforcement)
              </Label>
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : formData.id ? "Update Item" : "Create Item"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
