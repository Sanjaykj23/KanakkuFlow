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
import {
  Truck,
  Plus,
  Search,
  Eye,
  CheckCircle2,
  Clock,
  Loader2,
  FileSpreadsheet,
  Warehouse,
} from "lucide-react";
import { getGoodsReceipts } from "@/modules/procurement/grn-actions";
import { getCompanyBranches } from "@/modules/users/actions";
import { GoodsReceiptNote, GrnStatus } from "@/types/database";

export default function GoodsReceiptsPage() {
  const [grns, setGrns] = useState<GoodsReceiptNote[]>([]);
  const [branches, setBranches] = useState<{ id: string; code: string; name: string }[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"ALL" | GrnStatus>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const [grnRes, branchList] = await Promise.all([
      getGoodsReceipts(
        selectedStatus === "ALL" ? undefined : selectedStatus,
        selectedBranch || undefined,
        searchQuery || undefined
      ),
      getCompanyBranches(),
    ]);

    if (grnRes.success && grnRes.goodsReceipts) {
      setGrns(grnRes.goodsReceipts);
    }
    setBranches(branchList);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [selectedStatus, selectedBranch]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Truck className="w-6 h-6 text-primary" />
            Goods Receipt Notes (GRN)
          </h1>
          <p className="text-sm text-zinc-500">
            Physical material receipt, supplier challan verification, quality inspection, and warehouse batch intake.
          </p>
        </div>
        <Link href="/goods-receipts/new">
          <Button size="sm" className="flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            Receive Inward Materials
          </Button>
        </Link>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex gap-2">
              {(["ALL", "DRAFT", "POSTED", "CANCELLED"] as const).map((tab) => (
                <Button
                  key={tab}
                  size="sm"
                  variant={selectedStatus === tab ? "default" : "outline"}
                  onClick={() => setSelectedStatus(tab)}
                  className="text-xs"
                >
                  {tab}
                </Button>
              ))}
            </div>

            <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full md:w-auto">
              <select
                className="px-3 py-1.5 border rounded-md text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
              >
                <option value="">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-400" />
                <Input
                  placeholder="GRN or challan #..."
                  className="pl-8 h-9 text-xs w-48"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </form>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Inward Material Receipts ({grns.length})</CardTitle>
          <CardDescription>
            Documented physical arrivals verified against approved purchase orders.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>GRN Number</TableHead>
                  <TableHead>PO Reference</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Challan / DC #</TableHead>
                  <TableHead>Receipt Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Received By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-zinc-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                      Loading goods receipts...
                    </TableCell>
                  </TableRow>
                ) : grns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-zinc-500">
                      No goods receipt notes recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  grns.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell className="font-mono text-xs font-bold text-primary">
                        <Link href={`/goods-receipts/${g.id}`} className="hover:underline">
                          {g.grn_number}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-zinc-700 dark:text-zinc-300">
                        <Link href={`/purchases/${g.purchase_order_id}`} className="hover:underline text-primary">
                          {g.purchase_order?.po_number || "PO Ref"}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                          {g.supplier?.name}
                        </div>
                        <div className="text-xs text-zinc-500">{g.supplier?.code}</div>
                      </TableCell>
                      <TableCell className="text-xs text-zinc-600 dark:text-zinc-400">
                        {g.warehouse?.name}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {g.supplier_delivery_challan}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-500">
                        {new Date(g.receipt_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {g.status === "DRAFT" && (
                          <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-500/10">
                            <Clock className="w-3 h-3 mr-1" />
                            Draft (Unposted)
                          </Badge>
                        )}
                        {g.status === "POSTED" && (
                          <Badge variant="outline" className="border-emerald-500 text-emerald-600 bg-emerald-500/10">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Posted to Stock
                          </Badge>
                        )}
                        {g.status === "CANCELLED" && (
                          <Badge variant="secondary" className="text-zinc-400">
                            Cancelled
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-500">
                        {g.receiving_employee?.full_name || "Warehouse Staff"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/goods-receipts/${g.id}`}>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                            <Eye className="w-4 h-4 text-zinc-500" />
                          </Button>
                        </Link>
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
