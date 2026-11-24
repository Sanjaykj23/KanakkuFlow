"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Receipt,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Boxes,
  Loader2,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  Printer,
} from "lucide-react";
import {
  getSalesInvoices,
  createInvoiceFromOrderAction,
} from "@/modules/finance/actions";
import { getSalesOrders } from "@/modules/sales/actions";
import { SalesInvoice, SalesOrder, InvoiceStatus } from "@/types/database";

export default function InvoicesRegisterPage() {
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [eligibleOrders, setEligibleOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Create Invoice Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const [invRes, ordRes] = await Promise.all([
      getSalesInvoices(),
      getSalesOrders(),
    ]);

    if (invRes.success && invRes.invoices) setInvoices(invRes.invoices);
    if (ordRes.success && ordRes.orders) {
      setEligibleOrders(
        ordRes.orders.filter((o) =>
          ["READY_FOR_DISPATCH", "ALLOCATED", "APPROVED"].includes(o.status)
        )
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setSelectedOrderId(eligibleOrders[0]?.id || "");
    setInvoiceNotes("");
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId) {
      setModalError("Please select a sales order to invoice.");
      return;
    }

    setSubmitting(true);
    setModalError(null);

    const res = await createInvoiceFromOrderAction({
      orderId: selectedOrderId,
      notes: invoiceNotes || undefined,
    });

    setSubmitting(false);

    if (!res.success) {
      setModalError(res.error || "Failed to post invoice.");
    } else {
      setIsModalOpen(false);
      loadData();
    }
  };

  const getStatusBadge = (status: InvoiceStatus) => {
    switch (status) {
      case "PAID":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-mono text-[11px] flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> PAID
          </Badge>
        );
      case "PARTIALLY_PAID":
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 font-mono text-[11px] flex items-center gap-1">
            <Clock className="w-3 h-3" /> PARTIAL
          </Badge>
        );
      case "POSTED":
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 font-mono text-[11px] flex items-center gap-1">
            <Clock className="w-3 h-3" /> POSTED
          </Badge>
        );
      case "OVERDUE":
        return (
          <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 font-mono text-[11px] flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> OVERDUE
          </Badge>
        );
      case "CREDITED":
      case "CANCELLED":
        return (
          <Badge variant="outline" className="font-mono text-[11px]">
            {status}
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    const matchesStatus = statusFilter === "ALL" || inv.status === statusFilter;
    const invNum = inv.invoice_number || "";
    const custName = inv.customer?.shop_name || inv.customer_legal_name || "";
    const gstin = inv.customer_gstin || "";
    const matchesSearch =
      !searchQuery.trim() ||
      invNum.toLowerCase().includes(searchQuery.toLowerCase()) ||
      custName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      gstin.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6 pb-16 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Receipt className="w-6 h-6 text-primary" />
            GST Tax Invoices Register
          </h1>
          <p className="text-sm text-zinc-500">
            Generate, post, and print tax invoices. Historical pricing and tax snapshots are permanently preserved.
          </p>
        </div>
        <Button size="sm" onClick={openCreateModal} className="flex items-center gap-1.5">
          <Plus className="w-4 h-4" />
          Generate Invoice
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardHeader className="p-4 pb-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
              <Input
                placeholder="Search by invoice #, customer name, or GSTIN..."
                className="pl-9 h-9 text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {(["ALL", "POSTED", "PARTIALLY_PAID", "PAID", "CANCELLED"] as const).map(
                (status) => (
                  <Button
                    key={status}
                    variant={statusFilter === status ? "default" : "outline"}
                    size="sm"
                    className="h-8 text-xs font-medium"
                    onClick={() => setStatusFilter(status)}
                  >
                    {status.replace(/_/g, " ")}
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
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer / Shop</TableHead>
                <TableHead>Date / Due</TableHead>
                <TableHead className="text-right">Taxable</TableHead>
                <TableHead className="text-right">GST Total</TableHead>
                <TableHead className="text-right">Grand Total</TableHead>
                <TableHead className="text-right">Balance Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                    <p className="text-xs text-zinc-500 mt-2">Loading invoices...</p>
                  </TableCell>
                </TableRow>
              ) : filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center text-zinc-500">
                    <Boxes className="w-8 h-8 mx-auto text-zinc-400 mb-2" />
                    No sales invoices found matching current filter.
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices.map((inv) => {
                  const taxable = ((inv.taxable_amount_paisa || 0) / 100).toFixed(2);
                  const tax = ((inv.total_tax_paisa || 0) / 100).toFixed(2);
                  const total = ((inv.total_amount_paisa || 0) / 100).toFixed(2);
                  const balance = ((inv.outstanding_amount_paisa || 0) / 100).toFixed(2);

                  return (
                    <TableRow key={inv.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                      <TableCell className="font-mono font-semibold text-xs">
                        <Link
                          href={`/finance/invoices/${inv.id}`}
                          className="text-primary hover:underline"
                        >
                          {inv.invoice_number}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                          {inv.customer?.shop_name || inv.customer_legal_name}
                        </div>
                        <div className="text-xs text-zinc-500 font-mono">
                          GSTIN: {inv.customer_gstin || "Unregistered"}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-zinc-500">
                        <div>Inv: {new Date(inv.invoice_date).toLocaleDateString("en-IN")}</div>
                        <div>Due: {new Date(inv.due_date).toLocaleDateString("en-IN")}</div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">₹{taxable}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-zinc-600">
                        ₹{tax}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-sm text-zinc-900 dark:text-zinc-100">
                        ₹{Number(total).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-xs">
                        <span className={Number(balance) > 0 ? "text-amber-600" : "text-emerald-600"}>
                          ₹{Number(balance).toLocaleString("en-IN")}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(inv.status)}</TableCell>
                      <TableCell className="text-right">
                        <Link href={`/finance/invoices/${inv.id}`}>
                          <Button variant="outline" size="sm" className="h-7 text-xs">
                            View / Print &rarr;
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Generate Invoice Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              Generate GST Tax Invoice from Order
            </DialogTitle>
            <DialogDescription>
              Select an approved or dispatched sales order to create and post an immutable GST invoice.
            </DialogDescription>
          </DialogHeader>

          {modalError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-600">
              {modalError}
            </div>
          )}

          <form onSubmit={handleCreateInvoice} className="space-y-4 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Sales Order *</label>
              {eligibleOrders.length === 0 ? (
                <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded text-xs text-zinc-500">
                  No orders currently eligible for invoicing (Orders must be in APPROVED, ALLOCATED, or READY_FOR_DISPATCH status).
                </div>
              ) : (
                <select
                  className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                  value={selectedOrderId}
                  onChange={(e) => setSelectedOrderId(e.target.value)}
                  required
                >
                  {eligibleOrders.map((ord) => (
                    <option key={ord.id} value={ord.id}>
                      {ord.order_number} - {ord.customer?.shop_name} (₹{((ord.total_amount_paisa || 0) / 100).toFixed(2)}) [{ord.status}]
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="invNotes" className="text-xs font-medium text-slate-700">Invoice Notes (Optional)</label>
              <Input
                id="invNotes"
                placeholder="e.g., E-way Bill # / Transport vehicle LR details"
                value={invoiceNotes}
                onChange={(e) => setInvoiceNotes(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submitting || eligibleOrders.length === 0}>
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Posting Invoice...
                  </>
                ) : (
                  "Post Tax Invoice"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
