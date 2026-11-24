"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
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
  ArrowLeft,
  Factory,
  Layers,
  Loader2,
  Calendar,
} from "lucide-react";
import { getBomById } from "@/modules/production/actions";
import { BillOfMaterials } from "@/types/database";

export default function RecipeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const bomId = params.id as string;

  const [bom, setBom] = useState<BillOfMaterials | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const res = await getBomById(bomId);
      if (res.success && res.bom) {
        setBom(res.bom);
      }
      setLoading(false);
    }
    if (bomId) loadData();
  }, [bomId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-zinc-500 font-medium">Loading formula recipe...</p>
      </div>
    );
  }

  if (!bom) {
    return (
      <div className="p-8 text-center space-y-4">
        <h2 className="text-xl font-bold text-zinc-800">Recipe Not Found</h2>
        <Button onClick={() => router.push("/production/recipes")}>Back to Recipes</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center gap-2">
        <Link
          href="/production/recipes"
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Recipes
        </Link>
      </div>

      {/* Header Hub Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-semibold">
                  {bom.bom_number}
                </span>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {bom.product?.name}
                </h1>
                <Badge variant="outline" className="font-mono text-xs">
                  {bom.version}
                </Badge>
                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {bom.status}
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs pt-2">
                <div>
                  <span className="text-zinc-500 block">Stage / BOM Type</span>
                  <span className="font-semibold">{bom.bom_type.replace(/_/g, " ")}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Standard Output Batch</span>
                  <span className="font-bold font-mono text-primary">
                    {bom.expected_output_qty} {bom.output_unit?.symbol}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Expected Yield</span>
                  <span className="font-bold font-mono text-emerald-600">
                    {bom.expected_yield_percent}%
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Labor & Overhead</span>
                  <span className="font-bold font-mono">
                    ₹{((bom.labor_overhead_cost_paisa || 0) / 100).toFixed(2)}
                  </span>
                </div>
              </div>

              {bom.notes && (
                <p className="text-xs text-zinc-600 dark:text-zinc-400 pt-1">
                  <span className="font-semibold text-zinc-500">Process Instructions: </span>
                  {bom.notes}
                </p>
              )}
            </div>

            <Link href={`/production/runs/new?bomId=${bom.id}`}>
              <Button size="sm" className="flex items-center gap-1.5">
                <Factory className="w-4 h-4" />
                Initiate Production Order
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Recipe Formula Lines */}
      <Card>
        <CardHeader className="py-4 px-6 border-b border-zinc-200 dark:border-zinc-800">
          <CardTitle className="text-base font-semibold">Bill of Materials Formula Lines</CardTitle>
          <CardDescription className="text-xs">
            Standard input requirements to yield {bom.expected_output_qty} {bom.output_unit?.symbol}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-50 dark:bg-zinc-900/50">
                <TableHead className="text-xs font-semibold">Line #</TableHead>
                <TableHead className="text-xs font-semibold">Component Item</TableHead>
                <TableHead className="text-xs font-semibold">Component Type</TableHead>
                <TableHead className="text-xs font-semibold text-right">Required Qty</TableHead>
                <TableHead className="text-xs font-semibold">Unit</TableHead>
                <TableHead className="text-xs font-semibold text-right">Expected Wastage %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bom.lines?.map((line) => (
                <TableRow key={line.id}>
                  <TableCell className="font-mono text-xs">{line.line_number}</TableCell>
                  <TableCell>
                    <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      {line.component_item?.name}
                    </div>
                    <div className="text-[10px] font-mono text-zinc-500">
                      {line.component_item?.code}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {line.component_type.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-right font-mono font-bold">
                    {line.quantity}
                  </TableCell>
                  <TableCell className="text-xs">{line.unit?.symbol}</TableCell>
                  <TableCell className="text-xs text-right font-mono text-zinc-500">
                    {line.expected_wastage_percent}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
