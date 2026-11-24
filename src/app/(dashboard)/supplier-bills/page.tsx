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
  ReceiptText,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  FileText,
  ExternalLink,
  DollarSign,
  Building2,
  HelpCircle,
  X,
} from "lucide-react";
import { getSupplierBills, createSupplierBill } from "@/modules/procurement/bills-actions";
import { getSuppliers } from "@/modules/master/actions";
import { getCompanyBranches } from "@/modules/users/actions";
import { getPurchaseOrders } from "@/modules/purchases/actions";
import { getGoodsReceipts } from "@/modules/procurement/grn-actions";
import { SupplierBill, SupplierBillStatus, Supplier, PurchaseOrder, GoodsReceiptNote } from "@/types/database";

export default function SupplierBillsPage() {
  const [bills, setBills] = useState<SupplierBill[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [branches, setBranches] = useState<{ id: string; code: string; name: string }[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [goodsReceipts, setGoodsReceipts] = useState<GoodsReceiptNote[]>([]);

  const [selectedStatus, setSelectedStatus] = useState<"ALL" | SupplierBillStatus>("ALL");
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form State
  const [formSupplierId, setFormSupplierId] = useState("");
  const [formBranchId, setFormBranchId] = useState("");
  const [formInvoiceNumber, setFormInvoiceNumber] = useState("");
  const [formInvoiceDate, setFormInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [formDueDate, setFormDueDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]
  );
  const [formPurchaseOrderId, setFormPurchaseOrderId] = useState("");
  const [formGrnId, setFormGrnId] = useState("");
  const [formTaxableAmount, setFormTaxableAmount] = useState<number | "">("");
  const [formTaxAmount, setFormTaxAmount] = useState<number | "">("");
  const [formFreight, setFormFreight] = useState<number | "">("");
  const [formDiscount, setFormDiscount] = useState<number | "">("");
  const [formNotes, setFormNotes] = useState("");

  // Detail View State
  const [selectedBillForView, setSelectedBillForView] = useState<SupplierBill | null>(null);

  const loadData = async () => {
    setLoading(true);
    const [billsRes, suppRes, branchList, poRes, grnRes] = await Promise.all([
      getSupplierBills(
        selectedStatus === "ALL" ? undefined : selectedStatus,
        selectedSupplier || undefined
      ),
      getSuppliers(),
      getCompanyBranches(),
      getPurchaseOrders(),
      getGoodsReceipts(),
    ]);

    if (billsRes.success && billsRes.bills) {
      setBills(billsRes.bills);
    }
    if (suppRes.success && suppRes.suppliers) {
      setSuppliers(suppRes.suppliers);
    }
    setBranches(branchList);
    if (poRes.success && poRes.purchaseOrders) {
      setPurchaseOrders(poRes.purchaseOrders);
    }
    if (grnRes.success && grnRes.goodsReceipts) {
      setGoodsReceipts(grnRes.goodsReceipts);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [selectedStatus, selectedSupplier]);

  // Derived Filtered Bills
  const filteredBills = bills.filter((b) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      b.bill_number.toLowerCase().includes(q) ||
      b.supplier_invoice_number.toLowerCase().includes(q) ||
      b.supplier?.name.toLowerCase().includes(q)
    );
  });

  // Financial Metrics
  const totalBillsCount = bills.length;
  const totalBilledPaisa = bills.reduce((acc, b) => acc + (b.total_amount_paisa || 0), 0);
  const discrepancyBillsCount = bills.filter((b) => b.status === "DISCREPANCY_FLAGGED").length;
  const postedBillsCount = bills.filter((b) => b.status === "POSTED").length;

  const calculatedTotal =
    (Number(formTaxableAmount) || 0) +
    (Number(formTaxAmount) || 0) +
    (Number(formFreight) || 0) -
    (Number(formDiscount) || 0);

  const handleRecordBill = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formSupplierId) {
      setFormError("Please select a supplier");
      return;
    }
    if (!formBranchId) {
      setFormError("Please select a branch");
      return;
    }
    if (!formInvoiceNumber.trim()) {
      setFormError("Supplier invoice number is required");
      return;
    }
    if (calculatedTotal < 0) {
      setFormError("Total bill amount cannot be negative");
      return;
    }

    setSubmitting(true);
    const res = await createSupplierBill({
      supplierId: formSupplierId,
      branchId: formBranchId,
      supplierInvoiceNumber: formInvoiceNumber.trim(),
      invoiceDate: formInvoiceDate,
      dueDate: formDueDate,
      purchaseOrderId: formPurchaseOrderId || null,
      grnId: formGrnId || null,
      taxableAmount: Number(formTaxableAmount) || 0,
      taxAmount: Number(formTaxAmount) || 0,
      freightCharges: Number(formFreight) || 0,
      discount: Number(formDiscount) || 0,
      notes: formNotes.trim(),
    });

    setSubmitting(false);

    if (!res.success) {
      setFormError(res.error || "Failed to record bill");
      return;
    }

    // Reset and reload
    setIsModalOpen(false);
    setFormInvoiceNumber("");
    setFormTaxableAmount("");
    setFormTaxAmount("");
    setFormFreight("");
    setFormDiscount("");
    setFormNotes("");
    setFormPurchaseOrderId("");
    setFormGrnId("");
    loadData();
  };

  const getStatusBadge = (status: SupplierBillStatus) => {
    switch (status) {
      case "POSTED":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Posted / Matched
          </Badge>
        );
      case "DISCREPANCY_FLAGGED":
        return (
          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-400">
            <AlertTriangle className="w-3 h-3 mr-1" /> Discrepancy Flagged
          </Badge>
        );
      case "PAID":
        return (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300">
            Paid
          </Badge>
        );
      case "CANCELLED":
        return <Badge variant="destructive">Cancelled</Badge>;
      case "DRAFT":
      default:
        return (
          <Badge variant="outline" className="text-zinc-600 dark:text-zinc-400">
            <Clock className="w-3 h-3 mr-1" /> Draft
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
            <ReceiptText className="w-6 h-6 text-primary" />
            Supplier Bills & 3-Way Matching
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Record supplier vendor invoices, match against Purchase Orders and Goods Receipts, and catch billing discrepancies.
          </p>
        </div>

        <Button
          onClick={() => {
            if (branches.length > 0 && !formBranchId) setFormBranchId(branches[0].id);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Record Supplier Bill
        </Button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="py-3 px-4 pb-1">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Total Invoices
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 py-2">
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {totalBillsCount}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">Logged vendor bills</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3 px-4 pb-1">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Total Billed Spend
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 py-2">
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              ₹{(totalBilledPaisa / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">Cumulative invoiced value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3 px-4 pb-1">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Discrepancies Flagged
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 py-2">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {discrepancyBillsCount}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">PO / GRN mismatch detected</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3 px-4 pb-1">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              3-Way Matched
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 py-2">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {postedBillsCount}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">Ready for payment release</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            {/* Status Pills */}
            <div className="flex flex-wrap gap-1.5">
              {(["ALL", "DRAFT", "POSTED", "DISCREPANCY_FLAGGED", "PAID", "CANCELLED"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setSelectedStatus(st)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    selectedStatus === st
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                  }`}
                >
                  {st === "ALL" ? "All Bills" : st.replace("_", " ")}
                </button>
              ))}
            </div>

            {/* Controls: Supplier Filter & Search */}
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="h-9 px-3 text-xs bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">All Suppliers</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} - {s.name}
                  </option>
                ))}
              </select>

              <div className="relative min-w-[220px]">
                <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-zinc-400" />
                <Input
                  type="text"
                  placeholder="Search bill or invoice #..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9 text-xs"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bills Table */}
      <Card>
        <CardHeader className="py-4 px-6 border-b border-zinc-200 dark:border-zinc-800">
          <CardTitle className="text-base font-semibold">Vendor Bills Directory</CardTitle>
          <CardDescription className="text-xs">
            Showing {filteredBills.length} recorded supplier invoices
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-zinc-50 dark:bg-zinc-900/50">
                  <TableHead className="font-semibold text-xs">Bill #</TableHead>
                  <TableHead className="font-semibold text-xs">Supplier</TableHead>
                  <TableHead className="font-semibold text-xs">Supplier Inv #</TableHead>
                  <TableHead className="font-semibold text-xs">Linked PO / GRN</TableHead>
                  <TableHead className="font-semibold text-xs">Invoice Date</TableHead>
                  <TableHead className="font-semibold text-xs">Due Date</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Taxable</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Total Amount</TableHead>
                  <TableHead className="font-semibold text-xs">Status</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-10">
                      <div className="flex flex-col items-center justify-center gap-2 text-zinc-500">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        <span className="text-xs">Loading supplier bills...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredBills.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12">
                      <div className="flex flex-col items-center justify-center gap-2 text-zinc-500">
                        <ReceiptText className="w-8 h-8 text-zinc-300 dark:text-zinc-700" />
                        <p className="text-sm font-medium">No supplier bills found</p>
                        <p className="text-xs text-zinc-400">
                          Record incoming vendor bills against approved POs and GRNs.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBills.map((bill) => (
                    <TableRow key={bill.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                      <TableCell className="font-mono font-bold text-xs text-primary">
                        {bill.bill_number}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                          {bill.supplier?.name || "Unknown Supplier"}
                        </div>
                        <div className="text-[10px] text-zinc-500">
                          {bill.supplier?.code}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {bill.supplier_invoice_number}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          {bill.purchase_order ? (
                            <Link
                              href={`/purchases/${bill.purchase_order_id}`}
                              className="text-xs font-mono text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <span>{bill.purchase_order.po_number}</span>
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          ) : (
                            <span className="text-xs text-zinc-400">—</span>
                          )}
                          {bill.grn && (
                            <Link
                              href={`/goods-receipts/${bill.grn_id}`}
                              className="text-[10px] font-mono text-zinc-500 hover:underline flex items-center gap-1"
                            >
                              <span>{bill.grn.grn_number}</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </Link>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-zinc-600 dark:text-zinc-400">
                        {bill.invoice_date}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-600 dark:text-zinc-400">
                        {bill.due_date}
                      </TableCell>
                      <TableCell className="text-xs text-right font-mono">
                        ₹{(bill.taxable_amount_paisa / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-xs text-right font-mono font-bold text-zinc-900 dark:text-zinc-100">
                        ₹{(bill.total_amount_paisa / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>{getStatusBadge(bill.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedBillForView(bill)}
                          className="h-7 px-2 text-xs"
                        >
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Record Supplier Bill Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-2xl w-full border border-zinc-200 dark:border-zinc-800 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <ReceiptText className="w-5 h-5 text-primary" />
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Record Inward Supplier Bill
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordBill} className="flex-1 overflow-y-auto p-4 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-md text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Supplier *</Label>
                  <select
                    value={formSupplierId}
                    onChange={(e) => setFormSupplierId(e.target.value)}
                    required
                    className="w-full h-9 px-3 text-xs bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Branch / Plant *</Label>
                  <select
                    value={formBranchId}
                    onChange={(e) => setFormBranchId(e.target.value)}
                    required
                    className="w-full h-9 px-3 text-xs bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Select Branch</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Supplier Invoice # *</Label>
                  <Input
                    placeholder="e.g. INV-2026-904"
                    value={formInvoiceNumber}
                    onChange={(e) => setFormInvoiceNumber(e.target.value)}
                    required
                    className="h-9 text-xs"
                  />
                  <p className="text-[10px] text-zinc-500">
                    Guarded against duplicate entry per vendor.
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Related Purchase Order (Optional)</Label>
                  <select
                    value={formPurchaseOrderId}
                    onChange={(e) => setFormPurchaseOrderId(e.target.value)}
                    className="w-full h-9 px-3 text-xs bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">None / Direct Bill</option>
                    {purchaseOrders
                      .filter((p) => !formSupplierId || p.supplier_id === formSupplierId)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.po_number} ({p.status}) - ₹{(p.total_paisa / 100).toFixed(2)}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Linked GRN (Optional)</Label>
                  <select
                    value={formGrnId}
                    onChange={(e) => setFormGrnId(e.target.value)}
                    className="w-full h-9 px-3 text-xs bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">None / Pre-receipt Bill</option>
                    {goodsReceipts
                      .filter((g) => !formSupplierId || g.supplier_id === formSupplierId)
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.grn_number} ({g.status})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Invoice Date *</Label>
                    <Input
                      type="date"
                      value={formInvoiceDate}
                      onChange={(e) => setFormInvoiceDate(e.target.value)}
                      required
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Due Date *</Label>
                    <Input
                      type="date"
                      value={formDueDate}
                      onChange={(e) => setFormDueDate(e.target.value)}
                      required
                      className="h-9 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Financial Breakup */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 rounded-md space-y-3">
                <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                  Financial Amounts (₹)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold">Taxable Amount *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={formTaxableAmount}
                      onChange={(e) => setFormTaxableAmount(e.target.value === "" ? "" : Number(e.target.value))}
                      required
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold">Tax (GST)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={formTaxAmount}
                      onChange={(e) => setFormTaxAmount(e.target.value === "" ? "" : Number(e.target.value))}
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold">Freight / Inward</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={formFreight}
                      onChange={(e) => setFormFreight(e.target.value === "" ? "" : Number(e.target.value))}
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold">Discount</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={formDiscount}
                      onChange={(e) => setFormDiscount(e.target.value === "" ? "" : Number(e.target.value))}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-zinc-200 dark:border-zinc-700">
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Net Total Bill Amount:
                  </span>
                  <span className="text-sm font-mono font-bold text-primary">
                    ₹{calculatedTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Notes / Remarks</Label>
                <Input
                  placeholder="Optional internal remarks..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className="flex items-center gap-1.5">
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Validating & Recording...</span>
                    </>
                  ) : (
                    <span>Record Bill & Check 3-Way Match</span>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bill Details Drawer / View Modal */}
      {selectedBillForView && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-lg w-full border border-zinc-200 dark:border-zinc-800 p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-primary">
                  {selectedBillForView.bill_number}
                </span>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  {selectedBillForView.supplier?.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedBillForView(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-500">Supplier Invoice Number:</span>
                <span className="font-mono font-semibold">{selectedBillForView.supplier_invoice_number}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-500">Invoice Date:</span>
                <span>{selectedBillForView.invoice_date}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-500">Due Date:</span>
                <span>{selectedBillForView.due_date}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-500">Taxable Amount:</span>
                <span className="font-mono">₹{(selectedBillForView.taxable_amount_paisa / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-500">Tax (GST):</span>
                <span className="font-mono">₹{(selectedBillForView.tax_amount_paisa / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-500">Freight:</span>
                <span className="font-mono">₹{(selectedBillForView.freight_charges_paisa / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-500">Discount:</span>
                <span className="font-mono">₹{(selectedBillForView.discount_paisa / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2 border-t border-zinc-200 dark:border-zinc-700 font-bold">
                <span>Total Amount:</span>
                <span className="text-primary font-mono">
                  ₹{(selectedBillForView.total_amount_paisa / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-zinc-500">Matching Status:</span>
                <span>{getStatusBadge(selectedBillForView.status)}</span>
              </div>
              {selectedBillForView.discrepancy_notes && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 rounded text-amber-800 dark:text-amber-300">
                  <div className="font-semibold mb-1 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> 3-Way Matching Notice:
                  </div>
                  <div>{selectedBillForView.discrepancy_notes}</div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <Button onClick={() => setSelectedBillForView(null)} size="sm">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
