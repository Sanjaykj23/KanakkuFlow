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
  ChefHat,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Loader2,
  ExternalLink,
  Layers,
} from "lucide-react";
import { getBoms } from "@/modules/production/actions";
import { BillOfMaterials } from "@/types/database";

export default function RecipesPage() {
  const [boms, setBoms] = useState<BillOfMaterials[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const res = await getBoms();
    if (res.success && res.boms) {
      setBoms(res.boms);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <ChefHat className="w-6 h-6 text-primary" />
            Bill of Materials (BOM Recipes)
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Manufacturing formulas, expected yields, packaging bills, and recipe versions.
          </p>
        </div>

        <Link href="/production/recipes/new">
          <Button className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Create New BOM
          </Button>
        </Link>
      </div>

      {/* BOM Directory Table */}
      <Card>
        <CardHeader className="py-4 px-6 border-b border-zinc-200 dark:border-zinc-800">
          <CardTitle className="text-base font-semibold">Standard Product Recipes</CardTitle>
          <CardDescription className="text-xs">
            Showing {boms.length} configured manufacturing bills of materials
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-50 dark:bg-zinc-900/50">
                <TableHead className="text-xs font-semibold">BOM #</TableHead>
                <TableHead className="text-xs font-semibold">Target Output Product</TableHead>
                <TableHead className="text-xs font-semibold">Type</TableHead>
                <TableHead className="text-xs font-semibold">Version</TableHead>
                <TableHead className="text-xs font-semibold text-right">Standard Output</TableHead>
                <TableHead className="text-xs font-semibold text-right">Expected Yield</TableHead>
                <TableHead className="text-xs font-semibold">Status</TableHead>
                <TableHead className="text-xs font-semibold text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center gap-2 text-zinc-500">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <span className="text-xs">Loading recipes...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : boms.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-zinc-500">
                    <ChefHat className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mx-auto mb-2" />
                    <p className="text-sm font-medium">No recipes created yet</p>
                    <p className="text-xs text-zinc-400">Define raw ingredient ratios for bulk murukku or packaging BOMs.</p>
                  </TableCell>
                </TableRow>
              ) : (
                boms.map((bom) => (
                  <TableRow key={bom.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                    <TableCell className="font-mono font-bold text-xs text-primary">
                      {bom.bom_number}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{bom.product?.name}</div>
                      <div className="text-[10px] font-mono text-zinc-500">{bom.product?.code}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-mono">
                        {bom.bom_type.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs font-semibold">{bom.version}</TableCell>
                    <TableCell className="text-xs text-right font-mono font-bold">
                      {bom.expected_output_qty} {bom.output_unit?.symbol}
                    </TableCell>
                    <TableCell className="text-xs text-right font-mono text-emerald-600 font-bold">
                      {bom.expected_yield_percent}%
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {bom.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/production/recipes/${bom.id}`}>
                        <Button variant="ghost" size="sm" className="h-7 text-xs flex items-center gap-1">
                          <span>View Formula</span>
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
