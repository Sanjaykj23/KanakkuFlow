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
  TrendingUp,
  ArrowLeft,
  DollarSign,
  Loader2,
  FileSpreadsheet,
  Info,
} from "lucide-react";
import { getValuationReport } from "@/modules/inventory/actions";

export default function StockValuationPage() {
  const [valuationData, setValuationData] = useState<any[]>([]);
  const [totalValuationPaisa, setTotalValuationPaisa] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const res = await getValuationReport();
      if (res.success && res.valuation) {
        setValuationData(res.valuation);
        setTotalValuationPaisa(res.totalCompanyValuationPaisa || 0);
      }
      setLoading(false);
    }
    loadData();
  }, []);

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center gap-2">
        <Link
          href="/inventory"
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Inventory Dashboard
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" />
            Perpetual Weighted-Average Stock Valuation
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Financial asset inventory valuation calculated after every eligible goods receipt and consumption.
          </p>
        </div>
      </div>

      {/* Grand Total Asset Card */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                Total Company Inventory Valuation
              </span>
              <div className="text-3xl font-extrabold text-primary font-mono mt-1">
                ₹{((totalValuationPaisa / 100)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                Representing {valuationData.length} active inventory items across all company warehouses.
              </p>
            </div>

            <div className="p-3 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 max-w-sm text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
              <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-primary" /> Architecture Invariant:
              </div>
              <p>
                FEFO selects physical picking order; Weighted-Average Costing dictates financial value. Calculations use exact integer paisa without floating-point drift.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Valuation Table */}
      <Card>
        <CardHeader className="py-4 px-6 border-b border-zinc-200 dark:border-zinc-800">
          <CardTitle className="text-base font-semibold">Material Costing Breakdown</CardTitle>
          <CardDescription className="text-xs">
            Moving weighted-average unit cost and total balance sheet asset value
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-50 dark:bg-zinc-900/50">
                <TableHead className="text-xs font-semibold">Item SKU & Name</TableHead>
                <TableHead className="text-xs font-semibold">Category</TableHead>
                <TableHead className="text-xs font-semibold text-right">On-Hand Qty</TableHead>
                <TableHead className="text-xs font-semibold text-right">Weighted-Avg Cost (₹)</TableHead>
                <TableHead className="text-xs font-semibold text-right">Total Valuation (₹)</TableHead>
                <TableHead className="text-xs font-semibold text-center">Active Batches</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center gap-2 text-zinc-500">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <span className="text-xs">Calculating perpetual inventory valuation...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : valuationData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-zinc-500">
                    <p className="text-sm font-medium">No inventory stock available for valuation.</p>
                  </TableCell>
                </TableRow>
              ) : (
                valuationData.map((row) => (
                  <TableRow key={row.item.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                    <TableCell>
                      <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{row.item.name}</div>
                      <div className="text-[10px] font-mono text-zinc-500">{row.item.code}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {row.item.category || "GENERAL"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-right font-mono font-bold">
                      {row.totalQty} {row.unitSymbol}
                    </TableCell>
                    <TableCell className="text-xs text-right font-mono text-zinc-600 dark:text-zinc-400">
                      ₹{((row.weightedAvgCostPaisa / 100)).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-xs text-right font-mono font-bold text-primary">
                      ₹{((row.totalValuationPaisa / 100)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-xs text-center font-mono">
                      {row.batchesCount}
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
