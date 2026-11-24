"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
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
  Truck,
  Plus,
  Search,
  Edit2,
  Phone,
  Mail,
  Loader2,
  Building,
} from "lucide-react";
import { getSuppliers, saveSupplier } from "@/modules/master/actions";
import { Supplier } from "@/types/database";

export default function SuppliersMasterPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    id: undefined as string | undefined,
    code: "",
    name: "",
    tradeName: "",
    gstin: "",
    pan: "",
    contactPerson: "",
    email: "",
    mobile: "",
    addressLine1: "",
    addressLine2: "",
    city: "Madurai",
    state: "Tamil Nadu",
    pincode: "625001",
    paymentTermsDays: 30,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const res = await getSuppliers();
    if (res.success && res.suppliers) setSuppliers(res.suppliers);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setFormData({
      id: undefined,
      code: "",
      name: "",
      tradeName: "",
      gstin: "",
      pan: "",
      contactPerson: "",
      email: "",
      mobile: "",
      addressLine1: "",
      addressLine2: "",
      city: "Madurai",
      state: "Tamil Nadu",
      pincode: "625001",
      paymentTermsDays: 30,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (s: Supplier) => {
    setFormData({
      id: s.id,
      code: s.code,
      name: s.name,
      tradeName: s.trade_name || "",
      gstin: s.gstin || "",
      pan: s.pan || "",
      contactPerson: s.contact_person || "",
      email: s.email || "",
      mobile: s.mobile,
      addressLine1: s.address_line1,
      addressLine2: s.address_line2 || "",
      city: s.city,
      state: s.state,
      pincode: s.pincode,
      paymentTermsDays: s.payment_terms_days,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSaving(true);

    const res = await saveSupplier({
      ...formData,
      paymentTermsDays: Number(formData.paymentTermsDays),
    });

    setIsSaving(false);
    if (!res.success) {
      setFormError(res.error || "Failed to save supplier");
    } else {
      setIsModalOpen(false);
      loadData();
    }
  };

  const filteredSuppliers = suppliers.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.code.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.mobile.includes(q)
    );
  });

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Truck className="w-6 h-6 text-primary" />
            Supplier Master Directory
          </h1>
          <p className="text-sm text-zinc-500">
            Raw material vendors (flour, cooking oil, spices) and packaging suppliers.
          </p>
        </div>
        <Button size="sm" onClick={openCreateModal} className="flex items-center gap-1.5">
          <Plus className="w-4 h-4" />
          Add Supplier
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative w-full max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
            <Input
              placeholder="Search vendor by name, code, or mobile..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">
            Active Vendors ({filteredSuppliers.length})
          </CardTitle>
          <CardDescription>
            Configured commercial terms and verified statutory GST registrations.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Vendor Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>GSTIN / PAN</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Payment Terms</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-zinc-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                      Loading suppliers...
                    </TableCell>
                  </TableRow>
                ) : filteredSuppliers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-zinc-500">
                      No suppliers registered yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSuppliers.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs font-bold text-primary">
                        {s.code}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                          {s.name}
                        </div>
                        {s.contact_person && (
                          <div className="text-xs text-zinc-500">
                            Attn: {s.contact_person}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-600 dark:text-zinc-400">
                        <div>{s.mobile}</div>
                        {s.email && <div className="text-[11px] text-zinc-500">{s.email}</div>}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-zinc-600 dark:text-zinc-400">
                        {s.gstin || s.pan || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-500">
                        {s.city}, {s.state}
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {s.payment_terms_days} Days
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/suppliers/${s.id}/purchases`}>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs px-2 text-zinc-600 dark:text-zinc-400 hover:text-primary"
                              title="View 360 Procurement Record"
                            >
                              360° History
                            </Button>
                          </Link>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => openEditModal(s)}
                          >
                            <Edit2 className="w-4 h-4 text-zinc-500" />
                          </Button>
                        </div>
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
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary" />
              {formData.id ? "Edit Supplier" : "Add Supplier"}
            </DialogTitle>
            <DialogDescription>
              Register vendor details, tax identifiers, and credit settlement period.
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-600">
              {formError}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Vendor Code *</Label>
                <Input
                  placeholder="e.g. SUP-FLOUR-01"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value.toUpperCase() })
                  }
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Vendor Legal Name *</Label>
                <Input
                  placeholder="e.g. Sri Venkateswara Agro Mills"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Contact Person</Label>
                <Input
                  placeholder="e.g. R. Manickam"
                  value={formData.contactPerson}
                  onChange={(e) =>
                    setFormData({ ...formData, contactPerson: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Primary Mobile *</Label>
                <Input
                  type="tel"
                  maxLength={10}
                  placeholder="9876543210"
                  value={formData.mobile}
                  onChange={(e) =>
                    setFormData({ ...formData, mobile: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>GSTIN (15 chars)</Label>
                <Input
                  maxLength={15}
                  placeholder="33AAAAA0000A1Z5"
                  value={formData.gstin}
                  onChange={(e) =>
                    setFormData({ ...formData, gstin: e.target.value.toUpperCase() })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Payment Terms (Days)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.paymentTermsDays}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      paymentTermsDays: Number(e.target.value),
                    })
                  }
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Address Line 1 *</Label>
              <Input
                placeholder="Door No, Street"
                value={formData.addressLine1}
                onChange={(e) =>
                  setFormData({ ...formData, addressLine1: e.target.value })
                }
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>City *</Label>
                <Input
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>State *</Label>
                <Input
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Pincode *</Label>
                <Input
                  maxLength={6}
                  value={formData.pincode}
                  onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                  required
                />
              </div>
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
                {isSaving ? "Saving..." : formData.id ? "Update Vendor" : "Create Vendor"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
