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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeftRight,
  Plus,
  Truck,
  CheckCircle2,
  Clock,
  Loader2,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import { getStockTransfers } from "@/modules/inventory/actions";
import { StockTransfer, StockTransferStatus } from "@/types/database";

export default function StockTransfersPage() {
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<"ALL" | StockTransferStatus>("ALL");

  const loadTransfers = async () => {
    setLoading(true);
    const res = await getStockTransfers(
      selectedStatus === "ALL" ? undefined : selectedStatus
    );
    if (res.success && res.transfers) {
      setTransfers(res.transfers);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadTransfers();
  }, [selectedStatus]);

  const getStatusBadge = (status: StockTransferStatus) => {
    switch (status) {
      case "RECEIVED":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Received
          </Badge>
        );
      case "IN_TRANSIT":
        return (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300">
            <Truck className="w-3 h-3 mr-1" /> In Transit
          </Badge>
        );
      case "SUBMITTED":
      case "APPROVED":
        return (
          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
            <Clock className="w-3 h-3 mr-1" /> Ready for Dispatch
          </Badge>
        );
      case "REJECTED":
      case "CANCELLED":
        return <Badge variant="destructive">{status}</Badge>;
      case "DRAFT":
      default:
        return <Badge variant="outline">Draft</Badge>;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <ArrowLeftRight className="w-6 h-6 text-primary" />
            Inter-Warehouse Stock Transfers
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Transfer materials between warehouses and branches with batch identity preservation.
          </p>
        </div>

        <Link href="/inventory/transfers/new">
          <Button className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Stock Transfer
          </Button>
        </Link>
      </div>

      {/* Filter Tabs */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-1.5">
            {(["ALL", "SUBMITTED", "IN_TRANSIT", "RECEIVED", "CANCELLED"] as const).map((st) => (
              <button
                key={st}
                onClick={() => setSelectedStatus(st)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  selectedStatus === st
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                }`}
              >
                {st === "ALL" ? "All Transfers" : st.replace("_", " ")}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Transfers Table */}
      <Card>
        <CardHeader className="py-4 px-6 border-b border-zinc-200 dark:border-zinc-800">
          <CardTitle className="text-base font-semibold">Stock Transfers Directory</CardTitle>
          <CardDescription className="text-xs">
            Showing {transfers.length} inter-warehouse transfer records
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-50 dark:bg-zinc-900/50">
                <TableHead className="text-xs font-semibold">Transfer #</TableHead>
                <TableHead className="text-xs font-semibold">Source Warehouse</TableHead>
                <TableHead className="text-xs font-semibold">Destination Warehouse</TableHead>
                <TableHead className="text-xs font-semibold">Materials & Lines</TableHead>
                <TableHead className="text-xs font-semibold">Created Date</TableHead>
                <TableHead className="text-xs font-semibold">Status</TableHead>
                <TableHead className="text-xs font-semibold text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center gap-2 text-zinc-500">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <span className="text-xs">Loading transfer records...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : transfers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-zinc-500">
                    <ArrowLeftRight className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
                    <p className="text-sm font-medium">No stock transfers found</p>
                    <p className="text-xs text-zinc-400">Initiate a transfer to move material between facilities.</p>
                  </TableCell>
                </TableRow>
              ) : (
                transfers.map((t) => (
                  <TableRow key={t.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                    <TableCell className="font-mono font-bold text-xs text-primary">
                      {t.transfer_number}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {t.source_warehouse?.name}
                      </div>
                      <div className="text-[10px] text-zinc-500">{t.source_branch?.name}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {t.destination_warehouse?.name}
                      </div>
                      <div className="text-[10px] text-zinc-500">{t.destination_branch?.name}</div>
                    </TableCell>
                    <TableCell className="text-xs text-zinc-600 dark:text-zinc-400">
                      {t.lines?.map((l: any) => `${l.item?.name} (${l.requested_qty} ${l.unit?.symbol})`).join(", ") || "—"}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-zinc-500">
                      {new Date(t.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{getStatusBadge(t.status)}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/inventory/transfers/${t.id}`}>
                        <Button variant="ghost" size="sm" className="h-7 text-xs flex items-center gap-1">
                          <span>Details</span>
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
