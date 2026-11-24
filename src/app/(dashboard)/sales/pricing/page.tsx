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
  Tag,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Calendar,
  Layers,
  Search,
  Loader2,
  Boxes,
} from "lucide-react";
import { getPriceLists, savePriceList } from "@/modules/sales/actions";
import { getItems, getUnits } from "@/modules/master/actions";
import { PriceList, Item, Unit, PriceListType } from "@/types/database";

export default function PricingPage() {
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [formHeader, setFormHeader] = useState({
    id: undefined as string | undefined,
    code: "",
    name: "",
    listType: "STANDARD" as PriceListType,
    isDefault: false,
    isActive: true,
    validFrom: new Date().toISOString().split("T")[0],
    validTo: "",
    notes: "",
  });

  const [formItems, setFormItems] = useState<
    { itemId: string; unitId: string; price: number; minSellingPrice: number }[]
  >([]);

  const loadData = async () => {
    setLoading(true);
    const [pRes, iRes, uRes] = await Promise.all([
      getPriceLists(),
      getItems(),
      getUnits(),
    ]);

    if (pRes.success && pRes.priceLists) setPriceLists(pRes.priceLists);
    if (iRes.success && iRes.items) setItems(iRes.items.filter((it) => it.is_active));
    if (uRes.success && uRes.units) setUnits(uRes.units);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setFormHeader({
      id: undefined,
      code: `PL-${Date.now().toString().slice(-4)}`,
      name: "",
      listType: "STANDARD",
      isDefault: priceLists.length === 0,
      isActive: true,
      validFrom: new Date().toISOString().split("T")[0],
      validTo: "",
      notes: "",
    });

    if (items.length > 0) {
      setFormItems(
        items.slice(0, 3).map((it) => ({
          itemId: it.id,
          unitId: it.primary_unit_id,
          price: Number(it.base_price) || 50,
          minSellingPrice: Number(it.base_price) * 0.9 || 45,
        }))
      );
    } else {
      setFormItems([]);
    }

    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (list: PriceList) => {
    setFormHeader({
      id: list.id,
      code: list.code,
      name: list.name,
      listType: list.list_type,
      isDefault: list.is_default,
      isActive: list.is_active,
      validFrom: list.valid_from,
      validTo: list.valid_to || "",
      notes: list.notes || "",
    });

    setFormItems(
      (list.items || []).map((pli) => ({
        itemId: pli.item_id,
        unitId: pli.unit_id,
        price: pli.price_paisa / 100,
        minSellingPrice: (pli.min_selling_price_paisa || 0) / 100,
      }))
    );

    setFormError(null);
    setIsModalOpen(true);
  };

  const addItemLine = () => {
    if (items.length === 0) return;
    const defaultItem = items[0];
    setFormItems([
      ...formItems,
      {
        itemId: defaultItem.id,
        unitId: defaultItem.primary_unit_id,
        price: Number(defaultItem.base_price) || 50,
        minSellingPrice: Number(defaultItem.base_price) * 0.9 || 45,
      },
    ]);
  };

  const removeItemLine = (idx: number) => {
    setFormItems(formItems.filter((_, i) => i !== idx));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formItems.length === 0) {
      setFormError("Please configure at least one item price in this list.");
      return;
    }

    setIsSaving(true);
    setFormError(null);

    const payload = {
      id: formHeader.id,
      code: formHeader.code,
      name: formHeader.name,
      listType: formHeader.listType,
      isDefault: formHeader.isDefault,
      isActive: formHeader.isActive,
      validFrom: formHeader.validFrom,
      validTo: formHeader.validTo || undefined,
      notes: formHeader.notes || undefined,
      items: formItems.map((fi) => ({
        itemId: fi.itemId,
        unitId: fi.unitId,
        price: Number(fi.price),
        minSellingPrice: Number(fi.minSellingPrice),
      })),
    };

    const res = await savePriceList(payload);
    setIsSaving(false);

    if (!res.success) {
      setFormError(res.error || "Failed to save price list.");
    } else {
      setIsModalOpen(false);
      loadData();
    }
  };

  const filteredLists = priceLists.filter(
    (pl) =>
      pl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pl.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Tag className="w-6 h-6 text-primary" />
            Price Lists &amp; Customer Slabs
          </h1>
          <p className="text-sm text-zinc-500">
            Define multi-tier selling prices, distributor margins, and seasonal FMCG rate lists.
          </p>
        </div>
        <Button size="sm" onClick={openCreateModal} className="flex items-center gap-1.5">
          <Plus className="w-4 h-4" />
          Create Price List
        </Button>
      </div>

      {/* Directory Table */}
      <Card>
        <CardHeader className="p-4 pb-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
            <Input
              placeholder="Search price lists by code or name..."
              className="pl-9 h-9 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-50/50 dark:bg-zinc-900/50">
                <TableHead>Code &amp; Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Default</TableHead>
                <TableHead className="text-right">Items Included</TableHead>
                <TableHead>Effective Dates</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                    <p className="text-xs text-zinc-500 mt-2">Loading price lists...</p>
                  </TableCell>
                </TableRow>
              ) : filteredLists.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-zinc-500">
                    <Boxes className="w-8 h-8 mx-auto text-zinc-400 mb-2" />
                    No price lists configured yet. Click &quot;Create Price List&quot; to begin.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLists.map((pl) => (
                  <TableRow key={pl.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                    <TableCell>
                      <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                        {pl.name}
                      </div>
                      <div className="text-xs font-mono text-zinc-500">{pl.code}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {pl.list_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {pl.is_default && (
                        <Badge className="bg-primary/10 text-primary border-primary/30 text-[10px]">
                          DEFAULT
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {pl.items?.length || 0} SKUs
                    </TableCell>
                    <TableCell className="text-xs text-zinc-500">
                      {pl.valid_from} &rarr; {pl.valid_to || "No expiry"}
                    </TableCell>
                    <TableCell>
                      {pl.is_active ? (
                        <span className="text-xs text-emerald-600 font-medium">Active</span>
                      ) : (
                        <span className="text-xs text-zinc-400">Inactive</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => openEditModal(pl)}
                      >
                        <Edit2 className="w-3.5 h-3.5 mr-1" />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create / Edit Price List Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-primary" />
              {formHeader.id ? "Edit Price List" : "Create New Price List"}
            </DialogTitle>
            <DialogDescription>
              Configure selling rates and minimum allowed floor prices for products.
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-600">
              {formError}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="code" className="text-xs">Price List Code *</Label>
                <Input
                  id="code"
                  value={formHeader.code}
                  onChange={(e) => setFormHeader({ ...formHeader, code: e.target.value.toUpperCase() })}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="name" className="text-xs">Price List Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Wholesaler Standard Slab (Chennai)"
                  value={formHeader.name}
                  onChange={(e) => setFormHeader({ ...formHeader, name: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">List Type</Label>
                <select
                  className="w-full px-2.5 py-1.5 border rounded text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                  value={formHeader.listType}
                  onChange={(e) =>
                    setFormHeader({ ...formHeader, listType: e.target.value as PriceListType })
                  }
                >
                  <option value="STANDARD">Standard Company</option>
                  <option value="DISTRIBUTOR">Distributor Tier</option>
                  <option value="CUSTOMER_SPECIAL">Customer Contract</option>
                  <option value="SEASONAL">Seasonal / Festival</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Valid From *</Label>
                <Input
                  type="date"
                  className="h-8 text-xs"
                  value={formHeader.validFrom}
                  onChange={(e) => setFormHeader({ ...formHeader, validFrom: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Valid To (Optional)</Label>
                <Input
                  type="date"
                  className="h-8 text-xs"
                  value={formHeader.validTo}
                  onChange={(e) => setFormHeader({ ...formHeader, validTo: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs pt-1">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formHeader.isDefault}
                  onChange={(e) => setFormHeader({ ...formHeader, isDefault: e.target.checked })}
                  className="rounded border-zinc-300 text-primary"
                />
                <span>Set as Company Default Price List</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formHeader.isActive}
                  onChange={(e) => setFormHeader({ ...formHeader, isActive: e.target.checked })}
                  className="rounded border-zinc-300 text-primary"
                />
                <span>Active Status</span>
              </label>
            </div>

            {/* Price List Items Table */}
            <div className="space-y-2 border-t pt-3">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Item Selling Rates
                </Label>
                <Button type="button" size="sm" variant="outline" onClick={addItemLine} className="h-7 text-xs">
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add SKU
                </Button>
              </div>

              <div className="space-y-2">
                {formItems.map((fi, idx) => (
                  <div key={idx} className="p-2.5 border rounded bg-zinc-50 dark:bg-zinc-900 grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5">
                      <select
                        className="w-full px-2 py-1 border rounded text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                        value={fi.itemId}
                        onChange={(e) => {
                          const updated = [...formItems];
                          const item = items.find((it) => it.id === e.target.value);
                          updated[idx].itemId = e.target.value;
                          if (item) updated[idx].unitId = item.primary_unit_id;
                          setFormItems(updated);
                        }}
                      >
                        {items.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name} ({it.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-3">
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Price (₹)"
                        className="h-7 text-xs font-mono"
                        value={fi.price}
                        onChange={(e) => {
                          const updated = [...formItems];
                          updated[idx].price = Number(e.target.value);
                          setFormItems(updated);
                        }}
                        required
                      />
                    </div>

                    <div className="col-span-3">
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Min Floor (₹)"
                        className="h-7 text-xs font-mono"
                        value={fi.minSellingPrice}
                        onChange={(e) => {
                          const updated = [...formItems];
                          updated[idx].minSellingPrice = Number(e.target.value);
                          setFormItems(updated);
                        }}
                      />
                    </div>

                    <div className="col-span-1 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-rose-500"
                        onClick={() => removeItemLine(idx)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSaving}>
                {isSaving ? "Saving Price List..." : "Save Price List"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
