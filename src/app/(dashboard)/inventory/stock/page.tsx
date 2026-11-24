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
import { Boxes, Loader2, ArrowUpRight, ArrowDownLeft, Truck } from "lucide-react";
import { getStockMovements } from "@/modules/procurement/grn-actions";
import { StockMovement } from "@/types/database";

export default function StockLedgerPage() {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMovements = async () => {
    setLoading(true);
    const res = await getStockMovements();
    if (res.success && res.movements) {
      setMovements(res.movements);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadMovements();
  }, []);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Boxes className="w-6 h-6 text-primary" />
            Stock Ledger & Movements
          </h1>
          <p className="text-sm text-zinc-500">
            Immutable append-only inventory movement ledger tracking all receipts, issues, and adjustments.
          </p>
        </div>
        <Link href="/goods-receipts/new">
          <Button size="sm">
            <Truck className="w-4 h-4 mr-1.5" />
            New Goods Receipt (GRN)
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">
            Recent Stock Movements ({movements.length})
          </CardTitle>
          <CardDescription>
            Audit log of physical inventory changes. Updates and deletions are prevented by database triggers.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Batch #</TableHead>
                  <TableHead>Movement Type</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                  <TableHead>Logged By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-zinc-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                      Loading stock ledger...
                    </TableCell>
                  </TableRow>
                ) : movements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-zinc-500">
                      No stock movements recorded yet. Post a Goods Receipt (GRN) to record inward stock.
                    </TableCell>
                  </TableRow>
                ) : (
                  movements.map((m) => {
                    const isPositive = m.quantity > 0;
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="text-xs text-zinc-500 font-mono">
                          {new Date(m.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-xs text-zinc-900 dark:text-zinc-100">
                            {m.item?.name}
                          </div>
                          <div className="text-[10px] text-zinc-400 font-mono">
                            {m.item?.code}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-zinc-600 dark:text-zinc-400">
                          {m.warehouse?.name}
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {m.batch?.batch_number || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500">
                            {m.movement_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono font-bold">
                          <span
                            className={
                              isPositive ? "text-emerald-600" : "text-red-500"
                            }
                          >
                            {isPositive ? "+" : ""}
                            {m.quantity} {m.base_unit?.symbol}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono">
                          ₹{(m.unit_cost_paisa / 100).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-xs text-zinc-500">
                          {m.creator?.full_name || "System"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
