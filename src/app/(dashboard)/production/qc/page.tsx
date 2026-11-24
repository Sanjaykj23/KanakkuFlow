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
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Search,
  Filter,
  ShieldCheck,
  FlaskConical,
  Boxes,
  Loader2,
  Calendar,
  Layers,
} from "lucide-react";
import {
  getProductionOutputs,
  releaseProductionQcAction,
} from "@/modules/production/actions";
import { QcStatus } from "@/types/database";

export default function QCInspectionPage() {
  const [outputs, setOutputs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Inspection Modal State
  type DecisionType = "RELEASED" | "QUARANTINED" | "REJECTED";
  const [selectedOutput, setSelectedOutput] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [qcDecision, setQcDecision] = useState<DecisionType>("RELEASED");
  const [qcNotes, setQcNotes] = useState("");
  const [checks, setChecks] = useState({
    moisturePass: true,
    organolepticPass: true,
    sealIntegrityPass: true,
  });

  const loadData = async () => {
    setLoading(true);
    const res = await getProductionOutputs();
    if (res.success && res.outputs) {
      setOutputs(res.outputs);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const openInspection = (output: any) => {
    setSelectedOutput(output);
    const initialDecision: DecisionType =
      output.qc_status === "PENDING" ? "RELEASED" : (output.qc_status as DecisionType);
    setQcDecision(initialDecision);
    setQcNotes(output.qc_notes || "");
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleInspectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOutput) return;

    if (qcDecision === "REJECTED" && !qcNotes.trim()) {
      setModalError("Please provide an explanation for rejecting this food batch.");
      return;
    }

    setSubmitting(true);
    setModalError(null);

    const res = await releaseProductionQcAction({
      outputId: selectedOutput.id,
      qcStatus: qcDecision,
      qcNotes: qcNotes.trim() || undefined,
    });

    setSubmitting(false);

    if (!res.success) {
      setModalError(res.error || "Failed to update QC status");
    } else {
      setIsModalOpen(false);
      loadData();
    }
  };

  const pendingCount = outputs.filter((o) => o.qc_status === "PENDING").length;
  const releasedCount = outputs.filter((o) => o.qc_status === "RELEASED").length;
  const quarantinedCount = outputs.filter((o) => o.qc_status === "QUARANTINED").length;
  const rejectedCount = outputs.filter((o) => o.qc_status === "REJECTED").length;

  const filteredOutputs = outputs.filter((o) => {
    const matchesStatus = statusFilter === "ALL" || o.qc_status === statusFilter;
    const batchNum = o.batch?.batch_number || "";
    const prodName = o.production_order?.product?.name || "";
    const orderNum = o.production_order?.order_number || "";
    const matchesSearch =
      !searchQuery.trim() ||
      batchNum.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prodName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      orderNum.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: QcStatus) => {
    switch (status) {
      case "RELEASED":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 flex items-center gap-1 font-mono">
            <CheckCircle2 className="w-3 h-3" /> RELEASED
          </Badge>
        );
      case "PENDING":
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 flex items-center gap-1 font-mono animate-pulse">
            <Clock className="w-3 h-3" /> PENDING QC
          </Badge>
        );
      case "QUARANTINED":
        return (
          <Badge className="bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30 flex items-center gap-1 font-mono">
            <AlertTriangle className="w-3 h-3" /> QUARANTINED
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 flex items-center gap-1 font-mono">
            <XCircle className="w-3 h-3" /> REJECTED
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-primary" />
            Quality Control & Batch Release Hub
          </h1>
          <p className="text-sm text-zinc-500">
            Mandatory food safety inspections (moisture %, free fatty acids, seal integrity, organoleptic tests).
          </p>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Pending Inspection
            </div>
            <div className="text-2xl font-bold text-amber-600 mt-1">
              {pendingCount}
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              Locked from sales dispatch
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Released Batches
            </div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">
              {releasedCount}
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              Available for FEFO picking
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Under Quarantine
            </div>
            <div className="text-2xl font-bold text-orange-600 mt-1">
              {quarantinedCount}
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              Lab testing in-progress
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-rose-500">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Failed / Rejected
            </div>
            <div className="text-2xl font-bold text-rose-600 mt-1">
              {rejectedCount}
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              Wastage or discard logged
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardHeader className="p-4 pb-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
              <Input
                placeholder="Search by batch number, product, or work order..."
                className="pl-9 h-9 text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {(["ALL", "PENDING", "RELEASED", "QUARANTINED", "REJECTED"] as const).map(
                (status) => (
                  <Button
                    key={status}
                    variant={statusFilter === status ? "default" : "outline"}
                    size="sm"
                    className="h-8 text-xs font-medium"
                    onClick={() => setStatusFilter(status)}
                  >
                    {status}
                  </Button>
                )
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-50/50 dark:bg-zinc-900/50">
                <TableHead>Batch #</TableHead>
                <TableHead>Product / SKU</TableHead>
                <TableHead>Work Order</TableHead>
                <TableHead className="text-right">Good Qty</TableHead>
                <TableHead className="text-right">Rejected Qty</TableHead>
                <TableHead>Unit Cost</TableHead>
                <TableHead>MFG / EXP Date</TableHead>
                <TableHead>QC Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                    <p className="text-xs text-zinc-500 mt-2">Loading batch outputs...</p>
                  </TableCell>
                </TableRow>
              ) : filteredOutputs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center text-zinc-500">
                    <Boxes className="w-8 h-8 mx-auto text-zinc-400 mb-2" />
                    No production outputs found matching current filter.
                  </TableCell>
                </TableRow>
              ) : (
                filteredOutputs.map((out) => {
                  const mfg = out.batch?.manufacturing_date
                    ? new Date(out.batch.manufacturing_date).toLocaleDateString("en-IN")
                    : "-";
                  const exp = out.batch?.expiry_date
                    ? new Date(out.batch.expiry_date).toLocaleDateString("en-IN")
                    : "-";
                  const unitCost = ((out.unit_cost_paisa || 0) / 100).toFixed(2);

                  return (
                    <TableRow key={out.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                      <TableCell className="font-mono font-medium text-xs">
                        {out.batch?.batch_number || "BAT-PENDING"}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                          {out.production_order?.product?.name || "Product"}
                        </div>
                        <div className="text-xs text-zinc-500 font-mono">
                          {out.production_order?.product?.code}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {out.production_order?.order_number || "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium text-emerald-600">
                        {Number(out.produced_qty).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-medium text-rose-500">
                        {Number(out.rejected_qty) > 0 ? Number(out.rejected_qty).toLocaleString() : "-"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
                        ₹{unitCost}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-500">
                        <div>MFG: {mfg}</div>
                        <div>EXP: {exp}</div>
                      </TableCell>
                      <TableCell>{getStatusBadge(out.qc_status)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant={out.qc_status === "PENDING" ? "default" : "outline"}
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => openInspection(out)}
                        >
                          <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                          {out.qc_status === "PENDING" ? "Inspect" : "Re-Inspect"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* QC Inspection Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-primary" />
              Batch QC Inspection & Release Sign-Off
            </DialogTitle>
            <DialogDescription>
              Perform mandatory sensory, moisture, and packaging seal integrity checks before batch release.
            </DialogDescription>
          </DialogHeader>

          {modalError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-600">
              {modalError}
            </div>
          )}

          {selectedOutput && (
            <form onSubmit={handleInspectionSubmit} className="space-y-4 pt-2">
              <div className="bg-zinc-50 dark:bg-zinc-900 p-3 rounded border text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Batch Number:</span>
                  <span className="font-mono font-semibold">{selectedOutput.batch?.batch_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Product:</span>
                  <span className="font-medium">{selectedOutput.production_order?.product?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Produced Quantity:</span>
                  <span className="font-semibold text-emerald-600">{Number(selectedOutput.produced_qty).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Calculated Batch Cost:</span>
                  <span className="font-mono">₹{((selectedOutput.total_output_cost_paisa || 0) / 100).toFixed(2)}</span>
                </div>
              </div>

              {/* Food Safety Checklist */}
              <div className="space-y-2 border-t pt-3">
                <Label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Mandatory Food Safety Checks
                </Label>
                <div className="space-y-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checks.moisturePass}
                      onChange={(e) => setChecks({ ...checks, moisturePass: e.target.checked })}
                      className="rounded border-zinc-300 text-primary"
                    />
                    <span>Moisture Content Verification (&lt; 2.5% standard for fried crisps)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checks.organolepticPass}
                      onChange={(e) => setChecks({ ...checks, organolepticPass: e.target.checked })}
                      className="rounded border-zinc-300 text-primary"
                    />
                    <span>Organoleptic Test (Crispness, seasoning taste, oil smell / FFA level)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checks.sealIntegrityPass}
                      onChange={(e) => setChecks({ ...checks, sealIntegrityPass: e.target.checked })}
                      className="rounded border-zinc-300 text-primary"
                    />
                    <span>Nitrogen Flush & Seal Integrity (Leak test passed)</span>
                  </label>
                </div>
              </div>

              {/* Decision Radio */}
              <div className="space-y-2 border-t pt-3">
                <Label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Quality Decision *
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setQcDecision("RELEASED")}
                    className={`p-2.5 rounded border text-center transition-all ${
                      qcDecision === "RELEASED"
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 font-semibold"
                        : "border-zinc-200 dark:border-zinc-800 text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 mx-auto mb-1 text-emerald-600" />
                    <div className="text-xs">RELEASE</div>
                    <div className="text-[10px] text-zinc-400">Unlock for dispatch</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setQcDecision("QUARANTINED")}
                    className={`p-2.5 rounded border text-center transition-all ${
                      qcDecision === "QUARANTINED"
                        ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30 text-orange-700 font-semibold"
                        : "border-zinc-200 dark:border-zinc-800 text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 mx-auto mb-1 text-orange-500" />
                    <div className="text-xs">QUARANTINE</div>
                    <div className="text-[10px] text-zinc-400">Hold for lab re-test</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setQcDecision("REJECTED")}
                    className={`p-2.5 rounded border text-center transition-all ${
                      qcDecision === "REJECTED"
                        ? "border-rose-500 bg-rose-50 dark:bg-rose-950/30 text-rose-700 font-semibold"
                        : "border-zinc-200 dark:border-zinc-800 text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    <XCircle className="w-4 h-4 mx-auto mb-1 text-rose-500" />
                    <div className="text-xs">REJECT</div>
                    <div className="text-[10px] text-zinc-400">Lock & mark scrap</div>
                  </button>
                </div>
              </div>

              {/* Inspector Notes */}
              <div className="space-y-1">
                <Label htmlFor="qcNotes" className="text-xs">
                  Inspector Remarks / Lab Certificate Notes {qcDecision === "REJECTED" && "*"}
                </Label>
                <Input
                  id="qcNotes"
                  placeholder="e.g., Moisture 1.8%, FFA 0.3%, Seal pressure test passed."
                  value={qcNotes}
                  onChange={(e) => setQcNotes(e.target.value)}
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Saving Decision...
                    </>
                  ) : (
                    "Confirm QC Decision"
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
