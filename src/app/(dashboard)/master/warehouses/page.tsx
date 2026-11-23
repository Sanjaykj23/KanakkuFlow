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
import { Warehouse as WarehouseIcon, Plus, Edit2, Loader2, Building2 } from "lucide-react";
import { getWarehouses, saveWarehouse } from "@/modules/master/actions";
import { getCompanyBranches } from "@/modules/users/actions";
import { Warehouse, Branch } from "@/types/database";

export default function WarehousesMasterPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [branches, setBranches] = useState<{ id: string; code: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    id: undefined as string | undefined,
    branchId: "",
    code: "",
    name: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const [wRes, bList] = await Promise.all([getWarehouses(), getCompanyBranches()]);
    if (wRes.success && wRes.warehouses) setWarehouses(wRes.warehouses);
    setBranches(bList);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setFormData({
      id: undefined,
      branchId: branches[0]?.id || "",
      code: "",
      name: "",
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (w: Warehouse) => {
    setFormData({
      id: w.id,
      branchId: w.branch_id,
      code: w.code,
      name: w.name,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSaving(true);

    const res = await saveWarehouse(formData);
    setIsSaving(false);
    if (!res.success) {
      setFormError(res.error || "Failed to save warehouse");
    } else {
      setIsModalOpen(false);
      loadData();
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <WarehouseIcon className="w-6 h-6 text-primary" />
            Warehouse & Storage Master
          </h1>
          <p className="text-sm text-zinc-500">
            Storage locations for finished goods, bulk stock, packing materials, and staging.
          </p>
        </div>
        <Button size="sm" onClick={openCreateModal} className="flex items-center gap-1.5">
          <Plus className="w-4 h-4" />
          Add Warehouse Location
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">
            Configured Locations ({warehouses.length})
          </CardTitle>
          <CardDescription>
            Multi-branch isolated warehouse sites with batch-level FEFO picking controls.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location Code</TableHead>
                  <TableHead>Warehouse Name</TableHead>
                  <TableHead>Operating Branch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-zinc-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                      Loading warehouses...
                    </TableCell>
                  </TableRow>
                ) : warehouses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-zinc-500">
                      No warehouses configured. Click &quot;Add Warehouse Location&quot; to create one.
                    </TableCell>
                  </TableRow>
                ) : (
                  warehouses.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell className="font-mono text-xs font-bold text-primary">
                        {w.code}
                      </TableCell>
                      <TableCell className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                        {w.name}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-600 dark:text-zinc-400">
                        {w.branch?.name || "Main Branch"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500">
                          Active
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => openEditModal(w)}
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

      {/* Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <WarehouseIcon className="w-5 h-5 text-primary" />
              {formData.id ? "Edit Warehouse" : "New Warehouse Location"}
            </DialogTitle>
            <DialogDescription>
              Assign storage area to an authorized manufacturing plant or distribution hub.
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-600">
              {formError}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label>Operating Branch *</Label>
              <select
                className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                value={formData.branchId}
                onChange={(e) =>
                  setFormData({ ...formData, branchId: e.target.value })
                }
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
              <Label>Location Code *</Label>
              <Input
                placeholder="e.g. WH-FG-MDU, WH-RM-DGL"
                value={formData.code}
                onChange={(e) =>
                  setFormData({ ...formData, code: e.target.value.toUpperCase() })
                }
                required
              />
            </div>

            <div className="space-y-1">
              <Label>Warehouse Name *</Label>
              <Input
                placeholder="e.g. Finished Goods Godown #1"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSaving}>
                {isSaving ? "Saving..." : formData.id ? "Update Location" : "Create Location"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
