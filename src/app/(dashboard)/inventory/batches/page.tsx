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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { QrCode, Search, Loader2, Warehouse, Calendar, Truck } from "lucide-react";
import { getInventoryBatches } from "@/modules/procurement/grn-actions";
import { InventoryBatch } from "@/types/database";

export default function BatchesPage() {
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const loadBatches = async () => {
    setLoading(true);
    const res = await getInventoryBatches();
    if (res.success && res.batches) {
      setBatches(res.batches);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadBatches();
  }, []);

  const filteredBatches = batches.filter((b) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      b.batch_number.toLowerCase().includes(q) ||
      b.item?.name?.toLowerCase().includes(q) ||
      (b.supplier_batch_number && b.supplier_batch_number.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <QrCode className="w-6 h-6 text-primary" />
            Batch Traceability & FEFO Status
          </h1>
          <p className="text-sm text-zinc-500">
            Physical material batches received via GRN or produced in plant runs with expiry dates.
          </p>
        </div>
        <Link href="/goods-receipts/new">
          <Button size="sm">
            <Truck className="w-4 h-4 mr-1.5" />
            Receive New Batch (GRN)
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
            <Input
              placeholder="Search batch #, item, supplier lot..."
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
            Active Inventory Batches ({filteredBatches.length})
          </CardTitle>
          <CardDescription>
            Live lot inventory tracked with First-Expired, First-Out (FEFO) rules.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch Number</TableHead>
                  <TableHead>Item / Raw Material</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Supplier Lot #</TableHead>
                  <TableHead className="text-right">Current Available Qty</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead>QC Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-zinc-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                      Loading batches...
                    </TableCell>
                  </TableRow>
                ) : filteredBatches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-zinc-500">
                      No active inventory batches found. Receive goods via GRN to create batches.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBatches.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-mono text-xs font-bold text-primary">
                        {b.batch_number}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                          {b.item?.name}
                        </div>
                        <div className="text-xs text-zinc-500">{b.item?.code}</div>
                      </TableCell>
                      <TableCell className="text-xs text-zinc-600 dark:text-zinc-400">
                        {b.warehouse?.name}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {b.supplier_batch_number || "Internal"}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono font-bold text-emerald-600">
                        {b.current_qty} {b.base_unit?.symbol}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono">
                        ₹{(b.unit_cost_paisa / 100).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-500">
                        {b.expiry_date ? new Date(b.expiry_date).toLocaleDateString() : "Non-perishable"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500">
                          {b.qc_status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
