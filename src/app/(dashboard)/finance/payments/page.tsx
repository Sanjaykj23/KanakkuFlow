"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
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
  CreditCard,
  Plus,
  Search,
  CheckCircle2,
  Calendar,
  IndianRupee,
  Loader2,
  Boxes,
  Building2,
  AlertTriangle,
} from "lucide-react";
import {
  getCustomerPayments,
  recordCustomerPaymentAction,
  getSalesInvoices,
} from "@/modules/finance/actions";
import { getCustomers } from "@/modules/customers/actions";
import { getCompanyBranches } from "@/modules/users/actions";
import { CustomerPayment, Customer, SalesInvoice, PaymentMethod } from "@/types/database";

export default function CustomerPaymentsPage() {
  const [payments, setPayments] = useState<CustomerPayment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [branches, setBranches] = useState<{ id: string; code: string; name: string }[]>([]);
  const [openInvoices, setOpenInvoices] = useState<SalesInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("BANK_TRANSFER");
  const [amount, setAmount] = useState<number | "">("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [allocations, setAllocations] = useState<Record<string, number>>({});

  const loadData = async () => {
    setLoading(true);
    const [pRes, cRes, bRes, iRes] = await Promise.all([
      getCustomerPayments(),
      getCustomers(),
      getCompanyBranches(),
      getSalesInvoices(),
    ]);

    if (pRes.success && pRes.payments) setPayments(pRes.payments);
    if (cRes.success && cRes.customers) setCustomers(cRes.customers.filter((c) => c.is_active));
    if (Array.isArray(bRes)) setBranches(bRes);
    if (iRes.success && iRes.invoices) {
      setOpenInvoices(
        iRes.invoices.filter(
          (inv) =>
            ["POSTED", "PARTIALLY_PAID"].includes(inv.status) &&
            Number(inv.outstanding_amount_paisa) > 0
        )
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setCustomerId(customers[0]?.id || "");
    setBranchId(branches[0]?.id || "");
    setPaymentMethod("BANK_TRANSFER");
    setAmount("");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setReferenceNumber("");
    setNotes("");
    setAllocations({});
    setModalError(null);
    setIsModalOpen(true);
  };

  const customerOpenInvoices = openInvoices.filter((inv) => inv.customer_id === customerId);

  const handleAllocationChange = (invId: string, val: number) => {
    setAllocations({
      ...allocations,
      [invId]: val,
    });
  };

  const totalAllocated = Object.values(allocations).reduce((acc, val) => acc + (val || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      setModalError("Please enter a valid payment amount.");
      return;
    }
    if (totalAllocated > Number(amount)) {
      setModalError("Total allocated to invoices cannot exceed payment amount.");
      return;
    }

    setSubmitting(true);
    setModalError(null);

    const allocPayload = Object.entries(allocations)
      .filter(([_, val]) => val > 0)
      .map(([invoiceId, val]) => ({
        invoiceId,
        amount: Number(val),
      }));

    const res = await recordCustomerPaymentAction({
      customerId,
      branchId,
      paymentMethod,
      amount: Number(amount),
      paymentDate,
      referenceNumber: referenceNumber || undefined,
      notes: notes || undefined,
      allocations: allocPayload,
    });

    setSubmitting(false);

    if (!res.success) {
      setModalError(res.error || "Failed to record payment.");
    } else {
      setIsModalOpen(false);
      loadData();
    }
  };

  const filteredPayments = payments.filter((p) => {
    const num = p.payment_number || "";
    const name = p.customer?.shop_name || "";
    const ref = p.reference_number || "";
    return (
      num.toLowerCase().includes(searchQuery.toLowerCase()) ||
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ref.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="space-y-6 pb-16 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-primary" />
            Customer Payments &amp; Collections
          </h1>
          <p className="text-sm text-zinc-500">
            Record customer remittances (NEFT, UPI, Cash) and allocate across multiple open invoices.
          </p>
        </div>
        <Button size="sm" onClick={openCreateModal} className="flex items-center gap-1.5">
          <Plus className="w-4 h-4" />
          Record Payment
        </Button>
      </div>

      {/* Search & Directory Table */}
      <Card>
        <CardHeader className="p-4 pb-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
            <Input
              placeholder="Search by payment #, customer shop, or bank reference (UTR)..."
              className="pl-9 h-9 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-50/50 dark:bg-zinc-900/50">
                <TableHead>Payment #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Method &amp; Ref</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Total Amount</TableHead>
                <TableHead className="text-right">Allocated</TableHead>
                <TableHead className="text-right">Unallocated Advance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                    <p className="text-xs text-zinc-500 mt-2">Loading payments...</p>
                  </TableCell>
                </TableRow>
              ) : filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-zinc-500">
                    <Boxes className="w-8 h-8 mx-auto text-zinc-400 mb-2" />
                    No customer payments recorded yet. Click &quot;Record Payment&quot; to begin.
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map((p) => {
                  const amount = ((p.amount_paisa || 0) / 100).toFixed(2);
                  const allocated = ((p.allocated_amount_paisa || 0) / 100).toFixed(2);
                  const unallocated = ((p.unallocated_amount_paisa || 0) / 100).toFixed(2);

                  return (
                    <TableRow key={p.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                      <TableCell className="font-mono font-semibold text-xs text-primary">
                        {p.payment_number}
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                          {p.customer?.shop_name}
                        </div>
                        <div className="text-xs text-zinc-500">{p.customer?.owner_name}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {p.payment_method}
                        </Badge>
                        {p.reference_number && (
                          <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
                            Ref: {p.reference_number}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-500">
                        {new Date(p.payment_date).toLocaleDateString("en-IN")}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-sm text-emerald-600">
                        ₹{Number(amount).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-zinc-700 dark:text-zinc-300">
                        ₹{Number(allocated).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        <span className={Number(unallocated) > 0 ? "text-amber-600 font-semibold" : "text-zinc-400"}>
                          ₹{Number(unallocated).toLocaleString("en-IN")}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                          {p.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Record Payment Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              Record Customer Remittance &amp; Settle Invoices
            </DialogTitle>
            <DialogDescription>
              Record customer payment and optionally split allocation across multiple open invoices.
            </DialogDescription>
          </DialogHeader>

          {modalError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-600">
              {modalError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Customer *</Label>
                <select
                  className="w-full px-2.5 py-1.5 border rounded text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                  value={customerId}
                  onChange={(e) => {
                    setCustomerId(e.target.value);
                    setAllocations({});
                  }}
                  required
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.shop_name} ({c.owner_name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Deposit Branch *</Label>
                <select
                  className="w-full px-2.5 py-1.5 border rounded text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  required
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Payment Method *</Label>
                <select
                  className="w-full px-2.5 py-1.5 border rounded text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                >
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                  <option value="UPI">UPI / QR Code</option>
                  <option value="CHEQUE">Cheque / Demand Draft</option>
                  <option value="CASH">Cash Collection</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Amount Received (₹) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="1"
                  placeholder="e.g., 5000"
                  className="h-8 text-xs font-mono font-bold"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Payment Date *</Label>
                <Input
                  type="date"
                  className="h-8 text-xs"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Reference # / Bank UTR / Cheque No.</Label>
                <Input
                  placeholder="e.g., UTR98234821 or CHQ-00124"
                  className="h-8 text-xs font-mono"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Deposit Notes (Optional)</Label>
                <Input
                  placeholder="e.g., Deposited into HDFC Bank"
                  className="h-8 text-xs"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            {/* Open Invoices Settlement Table */}
            <div className="border-t pt-3 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <Label className="font-semibold uppercase tracking-wider text-zinc-500">
                  Allocate Across Open Invoices (Optional)
                </Label>
                <div className="font-mono">
                  Allocated: <span className="font-bold">₹{totalAllocated.toFixed(2)}</span> / ₹{Number(amount || 0).toFixed(2)}
                </div>
              </div>

              {customerOpenInvoices.length === 0 ? (
                <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded border text-xs text-zinc-500">
                  This customer has no open outstanding invoices. The entire payment of ₹{Number(amount || 0).toFixed(2)} will be held as unallocated customer advance credit.
                </div>
              ) : (
                <div className="border rounded-md overflow-hidden text-xs">
                  <Table>
                    <TableHeader className="bg-zinc-50 dark:bg-zinc-900">
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead className="text-right">Balance Due</TableHead>
                        <TableHead className="text-right w-36">Pay Amount (₹)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customerOpenInvoices.map((inv) => {
                        const bal = Number(inv.outstanding_amount_paisa || 0) / 100;
                        return (
                          <TableRow key={inv.id}>
                            <TableCell className="font-mono font-medium">{inv.invoice_number}</TableCell>
                            <TableCell>{new Date(inv.due_date).toLocaleDateString("en-IN")}</TableCell>
                            <TableCell className="text-right font-mono font-semibold text-amber-600">
                              ₹{bal.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                max={bal}
                                placeholder="0.00"
                                className="h-7 text-xs font-mono text-right"
                                value={allocations[inv.id] || ""}
                                onChange={(e) =>
                                  handleAllocationChange(inv.id, Number(e.target.value))
                                }
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? "Posting Remittance..." : "Post Payment & Update Ledger"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
