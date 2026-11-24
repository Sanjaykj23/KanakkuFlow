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
  TrendingUp,
  Search,
  Clock,
  AlertTriangle,
  IndianRupee,
  Loader2,
  Boxes,
  CreditCard,
  FileText,
  Sliders,
} from "lucide-react";
import {
  getCustomerOutstandingAging,
  getCustomerReceivablesLedger,
  updateCustomerCreditLimitAction,
  AgingBucketSummary,
} from "@/modules/finance/actions";
import { CustomerReceivablesLedgerEntry } from "@/types/database";

export default function CustomerOutstandingAgingPage() {
  const [agingList, setAgingList] = useState<AgingBucketSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Ledger Drawer/Modal State
  const [selectedCustomer, setSelectedCustomer] = useState<AgingBucketSummary | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<CustomerReceivablesLedgerEntry[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);

  // Credit Limit Edit Modal
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<AgingBucketSummary | null>(null);
  const [newCreditLimit, setNewCreditLimit] = useState<number | "">("");
  const [paymentTermsDays, setPaymentTermsDays] = useState<number | "">(7);
  const [creditReason, setCreditReason] = useState("");
  const [savingCredit, setSavingCredit] = useState(false);
  const [creditError, setCreditError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const res = await getCustomerOutstandingAging();
    if (res.success && res.aging) {
      setAgingList(res.aging);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCustomerLedger = async (cust: AgingBucketSummary) => {
    setSelectedCustomer(cust);
    setIsLedgerOpen(true);
    setLoadingLedger(true);

    const res = await getCustomerReceivablesLedger(cust.customerId);
    if (res.success && res.ledger) {
      setLedgerEntries(res.ledger);
    }
    setLoadingLedger(false);
  };

  const openCreditEdit = (cust: AgingBucketSummary) => {
    setEditingCustomer(cust);
    setNewCreditLimit(cust.creditLimitPaisa / 100);
    setPaymentTermsDays(7);
    setCreditReason("");
    setCreditError(null);
    setIsCreditModalOpen(true);
  };

  const handleSaveCreditLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer || newCreditLimit === "" || paymentTermsDays === "") return;

    setSavingCredit(true);
    setCreditError(null);

    const res = await updateCustomerCreditLimitAction({
      customerId: editingCustomer.customerId,
      newCreditLimit: Number(newCreditLimit),
      paymentTermsDays: Number(paymentTermsDays),
      reason: creditReason,
    });

    setSavingCredit(false);
    if (!res.success) {
      setCreditError(res.error || "Failed to update credit limit");
    } else {
      setIsCreditModalOpen(false);
      loadData();
    }
  };

  // Aggregated totals
  const totalOutstanding = agingList.reduce((acc, a) => acc + a.totalOutstandingPaisa, 0);
  const totalNotDue = agingList.reduce((acc, a) => acc + a.notYetDuePaisa, 0);
  const total1To30 = agingList.reduce((acc, a) => acc + a.days1To30Paisa, 0);
  const total31To60 = agingList.reduce((acc, a) => acc + a.days31To60Paisa, 0);
  const total61To90 = agingList.reduce((acc, a) => acc + a.days61To90Paisa, 0);
  const totalOver90 = agingList.reduce((acc, a) => acc + a.daysOver90Paisa, 0);

  const filteredAging = agingList.filter(
    (a) =>
      a.shopName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.customerCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-16 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" />
            Customer Receivables &amp; Aging Analysis
          </h1>
          <p className="text-sm text-zinc-500">
            Authoritative outstanding ledger and aging buckets (Current, 1–30, 31–60, 61–90, 90+ days).
          </p>
        </div>
      </div>

      {/* KPI Aging Strip */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-3">
            <div className="text-[11px] font-medium text-zinc-500 uppercase">Total Outstanding</div>
            <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-1 font-mono">
              ₹{(totalOutstanding / 100).toLocaleString("en-IN")}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-3">
            <div className="text-[11px] font-medium text-zinc-500 uppercase">Not Yet Due</div>
            <div className="text-lg font-bold text-emerald-600 mt-1 font-mono">
              ₹{(totalNotDue / 100).toLocaleString("en-IN")}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-3">
            <div className="text-[11px] font-medium text-zinc-500 uppercase">1–30 Days</div>
            <div className="text-lg font-bold text-blue-600 mt-1 font-mono">
              ₹{(total1To30 / 100).toLocaleString("en-IN")}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-3">
            <div className="text-[11px] font-medium text-zinc-500 uppercase">31–60 Days</div>
            <div className="text-lg font-bold text-amber-600 mt-1 font-mono">
              ₹{(total31To60 / 100).toLocaleString("en-IN")}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-3">
            <div className="text-[11px] font-medium text-zinc-500 uppercase">61–90 Days</div>
            <div className="text-lg font-bold text-orange-600 mt-1 font-mono">
              ₹{(total61To90 / 100).toLocaleString("en-IN")}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-rose-500">
          <CardContent className="p-3">
            <div className="text-[11px] font-medium text-zinc-500 uppercase">90+ Days</div>
            <div className="text-lg font-bold text-rose-600 mt-1 font-mono">
              ₹{(totalOver90 / 100).toLocaleString("en-IN")}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Aging Analysis Table */}
      <Card>
        <CardHeader className="p-4 pb-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
            <Input
              placeholder="Search customer account by shop name or code..."
              className="pl-9 h-9 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-50/50 dark:bg-zinc-900/50 text-xs">
                <TableHead>Customer Account</TableHead>
                <TableHead className="text-right">Credit Limit</TableHead>
                <TableHead className="text-right">Total Due (₹)</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">1–30 D</TableHead>
                <TableHead className="text-right">31–60 D</TableHead>
                <TableHead className="text-right">61–90 D</TableHead>
                <TableHead className="text-right">90+ D</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                    <p className="text-xs text-zinc-500 mt-2">Calculating aging analysis...</p>
                  </TableCell>
                </TableRow>
              ) : filteredAging.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center text-zinc-500">
                    <Boxes className="w-8 h-8 mx-auto text-zinc-400 mb-2" />
                    No customer accounts currently have outstanding balances.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAging.map((cust) => {
                  const limit = (cust.creditLimitPaisa / 100).toFixed(2);
                  const total = (cust.totalOutstandingPaisa / 100).toFixed(2);
                  const current = (cust.notYetDuePaisa / 100).toFixed(2);
                  const d30 = (cust.days1To30Paisa / 100).toFixed(2);
                  const d60 = (cust.days31To60Paisa / 100).toFixed(2);
                  const d90 = (cust.days61To90Paisa / 100).toFixed(2);
                  const dover = (cust.daysOver90Paisa / 100).toFixed(2);

                  return (
                    <TableRow key={cust.customerId} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 text-xs">
                      <TableCell>
                        <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                          {cust.shopName}
                        </div>
                        <div className="text-[11px] text-zinc-500 font-mono">
                          {cust.customerCode} &bull; {cust.ownerName}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-zinc-600">
                        ₹{Number(limit).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-sm text-zinc-900 dark:text-zinc-100">
                        ₹{Number(total).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="text-right font-mono text-emerald-600">
                        {Number(current) > 0 ? `₹${Number(current).toLocaleString("en-IN")}` : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-blue-600">
                        {Number(d30) > 0 ? `₹${Number(d30).toLocaleString("en-IN")}` : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-amber-600">
                        {Number(d60) > 0 ? `₹${Number(d60).toLocaleString("en-IN")}` : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-orange-600">
                        {Number(d90) > 0 ? `₹${Number(d90).toLocaleString("en-IN")}` : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-rose-600">
                        {Number(dover) > 0 ? `₹${Number(dover).toLocaleString("en-IN")}` : "-"}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => openCustomerLedger(cust)}
                        >
                          <FileText className="w-3.5 h-3.5 mr-1" />
                          Ledger
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => openCreditEdit(cust)}
                        >
                          <Sliders className="w-3.5 h-3.5" />
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

      {/* Customer Receivables Ledger Modal (Append-Only) */}
      <Dialog open={isLedgerOpen} onOpenChange={setIsLedgerOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Customer Receivables Ledger (Authoritative Trail)
            </DialogTitle>
            <DialogDescription>
              {selectedCustomer?.shopName} ({selectedCustomer?.customerCode}) &bull; Append-only audit record
            </DialogDescription>
          </DialogHeader>

          {loadingLedger ? (
            <div className="py-12 text-center text-zinc-500 text-xs">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
              Loading ledger entries...
            </div>
          ) : ledgerEntries.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-xs">
              No financial transactions posted for this customer yet.
            </div>
          ) : (
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="bg-zinc-50 dark:bg-zinc-900">
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Ref #</TableHead>
                  <TableHead className="text-right">Debit (+)</TableHead>
                  <TableHead className="text-right">Credit (-)</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgerEntries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-zinc-600">
                      {new Date(e.transaction_date).toLocaleDateString("en-IN")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {e.entry_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono font-semibold">{e.reference_number}</TableCell>
                    <TableCell className="text-right font-mono font-semibold text-rose-600">
                      {Number(e.debit_paisa) > 0 ? `₹${((e.debit_paisa || 0) / 100).toFixed(2)}` : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold text-emerald-600">
                      {Number(e.credit_paisa) > 0 ? `₹${((e.credit_paisa || 0) / 100).toFixed(2)}` : "-"}
                    </TableCell>
                    <TableCell className="text-zinc-500 max-w-xs truncate">{e.notes || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <DialogFooter className="pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsLedgerOpen(false)}>
              Close Ledger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credit Limit Management Modal */}
      <Dialog open={isCreditModalOpen} onOpenChange={setIsCreditModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-primary" />
              Adjust Customer Credit Limit &amp; Terms
            </DialogTitle>
            <DialogDescription>
              {editingCustomer?.shopName} &bull; Requires Owner or Admin authority
            </DialogDescription>
          </DialogHeader>

          {creditError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-600">
              {creditError}
            </div>
          )}

          <form onSubmit={handleSaveCreditLimit} className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">New Credit Limit (₹) *</Label>
              <Input
                type="number"
                step="1000"
                min="0"
                className="h-8 text-xs font-mono font-bold"
                value={newCreditLimit}
                onChange={(e) => setNewCreditLimit(Number(e.target.value))}
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Payment Terms (Days Net) *</Label>
              <Input
                type="number"
                min="0"
                className="h-8 text-xs"
                value={paymentTermsDays}
                onChange={(e) => setPaymentTermsDays(Number(e.target.value))}
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Audit Justification Reason *</Label>
              <Input
                placeholder="e.g., Credit limit enhanced based on reliable 6-month repayment track record."
                className="h-8 text-xs"
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsCreditModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={savingCredit}>
                {savingCredit ? "Saving..." : "Save Credit Terms"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
