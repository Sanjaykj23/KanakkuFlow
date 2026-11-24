"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileSpreadsheet,
  Download,
  AlertCircle,
  RefreshCw,
  Calendar,
  Filter,
  BarChart3,
  CreditCard,
  Receipt,
  Clock,
  Printer,
  ChevronDown,
} from "lucide-react";
import { formatPaisa } from "@/lib/utils";
import {
  getSalesInvoices,
  getCustomerPayments,
  getCreditNotes,
  getCustomerOutstandingAging,
  getFinanceMetrics,
} from "@/modules/finance/actions";
import type { SalesInvoice, CustomerPayment, CreditNote } from "@/types/database";

export default function FinanceReportsPage() {
  const [activeTab, setActiveTab] = useState<"gstr1" | "invoices" | "payments" | "aging">("gstr1");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [payments, setPayments] = useState<CustomerPayment[]>([]);
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [agingData, setAgingData] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [invRes, payRes, cnRes, agingRes, metRes] = await Promise.all([
        getSalesInvoices(),
        getCustomerPayments(),
        getCreditNotes(),
        getCustomerOutstandingAging(),
        getFinanceMetrics(),
      ]);

      if (invRes.success && invRes.invoices) setInvoices(invRes.invoices);
      if (payRes.success && payRes.payments) setPayments(payRes.payments);
      if (cnRes.success && cnRes.creditNotes) setCreditNotes(cnRes.creditNotes);
      if (agingRes.success && agingRes.aging) setAgingData(agingRes.aging);
      if (metRes.success && metRes.metrics) setMetrics(metRes.metrics);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load report data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Compute GSTR-1 summaries
  const b2bInvoices = invoices.filter((inv) => (inv.customer?.gstin || inv.customer_gstin) && inv.status !== "CANCELLED");
  const b2cInvoices = invoices.filter((inv) => (!inv.customer?.gstin && !inv.customer_gstin) && inv.status !== "CANCELLED");

  const totalB2bTaxable = b2bInvoices.reduce((acc, inv) => acc + (inv.subtotal_paisa || 0), 0);
  const totalB2bCgst = b2bInvoices.reduce((acc, inv) => acc + (inv.cgst_paisa ?? inv.cgst_amount_paisa ?? 0), 0);
  const totalB2bSgst = b2bInvoices.reduce((acc, inv) => acc + (inv.sgst_paisa ?? inv.sgst_amount_paisa ?? 0), 0);
  const totalB2bIgst = b2bInvoices.reduce((acc, inv) => acc + (inv.igst_paisa ?? inv.igst_amount_paisa ?? 0), 0);
  const totalB2bTotal = b2bInvoices.reduce((acc, inv) => acc + (inv.total_amount_paisa || 0), 0);

  const totalB2cTaxable = b2cInvoices.reduce((acc, inv) => acc + (inv.subtotal_paisa || 0), 0);
  const totalB2cCgst = b2cInvoices.reduce((acc, inv) => acc + (inv.cgst_paisa ?? inv.cgst_amount_paisa ?? 0), 0);
  const totalB2cSgst = b2cInvoices.reduce((acc, inv) => acc + (inv.sgst_paisa ?? inv.sgst_amount_paisa ?? 0), 0);
  const totalB2cIgst = b2cInvoices.reduce((acc, inv) => acc + (inv.igst_paisa ?? inv.igst_amount_paisa ?? 0), 0);
  const totalB2cTotal = b2cInvoices.reduce((acc, inv) => acc + (inv.total_amount_paisa || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Financial & Tax Reports</h1>
            <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
              Statutory Registers
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            GSTR-1 tax return preparation, invoice registers, payment collections, and customer aging statements.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadAllData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-800 rounded-md hover:bg-slate-900 shadow-sm print:hidden"
          >
            <Printer className="w-4 h-4" />
            Print Report
          </button>
        </div>
      </div>

      {/* Statutory Disclaimer */}
      <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-lg flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <span className="font-semibold">Chartered Accountant Verification Notice:</span> This report reflects posted ERP transactions and calculated GST splits for preparation purposes. All tax summaries, HSN summaries, and reverse-charge determinations must be audited and verified by your appointed Chartered Accountant before submitting monthly GSTR-1 and GSTR-3B filings on the GST Portal.
        </div>
      </div>

      {/* Report Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab("gstr1")}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "gstr1"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          GSTR-1 Tax Summary
        </button>
        <button
          onClick={() => setActiveTab("invoices")}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "invoices"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Receipt className="w-4 h-4" />
          Invoice Register
        </button>
        <button
          onClick={() => setActiveTab("payments")}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "payments"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Payment Register
        </button>
        <button
          onClick={() => setActiveTab("aging")}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "aging"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Clock className="w-4 h-4" />
          Receivables Aging
        </button>
      </div>

      {/* Tab 1: GSTR-1 Summary */}
      {activeTab === "gstr1" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Total Taxable Value
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {formatPaisa(totalB2bTaxable + totalB2cTaxable)}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                B2B: {formatPaisa(totalB2bTaxable)} | B2C: {formatPaisa(totalB2cTaxable)}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Total GST Liability
              </div>
              <div className="text-2xl font-bold text-indigo-600 mt-1">
                {formatPaisa(
                  totalB2bCgst + totalB2bSgst + totalB2bIgst + totalB2cCgst + totalB2cSgst + totalB2cIgst
                )}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                CGST: {formatPaisa(totalB2bCgst + totalB2cCgst)} | SGST: {formatPaisa(totalB2bSgst + totalB2cSgst)} | IGST: {formatPaisa(totalB2bIgst + totalB2cIgst)}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Gross Outward Value
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {formatPaisa(totalB2bTotal + totalB2cTotal)}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Total Invoices: {b2bInvoices.length + b2cInvoices.length} (B2B: {b2bInvoices.length}, B2C: {b2cInvoices.length})
              </div>
            </div>
          </div>

          {/* Section 4A - B2B Invoices */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Table 4A, 4B, 4C, 6B, 6C — B2B Invoices (Registered Customers)
                </h3>
                <p className="text-xs text-slate-500">Supplies to registered entities with GSTIN</p>
              </div>
              <span className="text-xs font-medium bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full">
                {b2bInvoices.length} Invoices
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider border-b">
                  <tr>
                    <th className="px-4 py-3">GSTIN of Recipient</th>
                    <th className="px-4 py-3">Customer Legal Name</th>
                    <th className="px-4 py-3">Invoice #</th>
                    <th className="px-4 py-3">Invoice Date</th>
                    <th className="px-4 py-3">Place of Supply</th>
                    <th className="px-4 py-3 text-right">Taxable Value</th>
                    <th className="px-4 py-3 text-right">CGST</th>
                    <th className="px-4 py-3 text-right">SGST</th>
                    <th className="px-4 py-3 text-right">IGST</th>
                    <th className="px-4 py-3 text-right">Invoice Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {b2bInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-slate-400 font-sans">
                        No B2B invoices found.
                      </td>
                    </tr>
                  ) : (
                    b2bInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold text-slate-900">{inv.customer_gstin}</td>
                        <td className="px-4 py-3 font-sans text-slate-900">{inv.customer_legal_name}</td>
                        <td className="px-4 py-3 text-indigo-600 font-semibold">{inv.invoice_number}</td>
                        <td className="px-4 py-3">{inv.invoice_date}</td>
                        <td className="px-4 py-3">{inv.place_of_supply}</td>
                        <td className="px-4 py-3 text-right">{formatPaisa(inv.subtotal_paisa)}</td>
                        <td className="px-4 py-3 text-right">{formatPaisa(inv.cgst_paisa ?? inv.cgst_amount_paisa ?? 0)}</td>
                        <td className="px-4 py-3 text-right">{formatPaisa(inv.sgst_paisa ?? inv.sgst_amount_paisa ?? 0)}</td>
                        <td className="px-4 py-3 text-right">{formatPaisa(inv.igst_paisa ?? inv.igst_amount_paisa ?? 0)}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">
                          {formatPaisa(inv.total_amount_paisa)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {b2bInvoices.length > 0 && (
                  <tfoot className="bg-slate-50 font-bold border-t text-slate-900 font-mono">
                    <tr>
                      <td colSpan={5} className="px-4 py-3 font-sans">Total B2B Outward</td>
                      <td className="px-4 py-3 text-right">{formatPaisa(totalB2bTaxable)}</td>
                      <td className="px-4 py-3 text-right">{formatPaisa(totalB2bCgst)}</td>
                      <td className="px-4 py-3 text-right">{formatPaisa(totalB2bSgst)}</td>
                      <td className="px-4 py-3 text-right">{formatPaisa(totalB2bIgst)}</td>
                      <td className="px-4 py-3 text-right">{formatPaisa(totalB2bTotal)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Section 7 - B2C Invoices */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Table 7 — B2C Others (Unregistered Retail Outlets & Consumers)
                </h3>
                <p className="text-xs text-slate-500">Supplies without GSTIN</p>
              </div>
              <span className="text-xs font-medium bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full">
                {b2cInvoices.length} Invoices
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider border-b">
                  <tr>
                    <th className="px-4 py-3">Customer Name</th>
                    <th className="px-4 py-3">Invoice #</th>
                    <th className="px-4 py-3">Invoice Date</th>
                    <th className="px-4 py-3">Place of Supply</th>
                    <th className="px-4 py-3 text-right">Taxable Value</th>
                    <th className="px-4 py-3 text-right">CGST</th>
                    <th className="px-4 py-3 text-right">SGST</th>
                    <th className="px-4 py-3 text-right">IGST</th>
                    <th className="px-4 py-3 text-right">Invoice Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {b2cInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-400 font-sans">
                        No B2C invoices found.
                      </td>
                    </tr>
                  ) : (
                    b2cInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-sans text-slate-900">{inv.customer_legal_name}</td>
                        <td className="px-4 py-3 text-indigo-600 font-semibold">{inv.invoice_number}</td>
                        <td className="px-4 py-3">{inv.invoice_date}</td>
                        <td className="px-4 py-3">{inv.place_of_supply}</td>
                        <td className="px-4 py-3 text-right">{formatPaisa(inv.subtotal_paisa)}</td>
                        <td className="px-4 py-3 text-right">{formatPaisa(inv.cgst_paisa ?? inv.cgst_amount_paisa ?? 0)}</td>
                        <td className="px-4 py-3 text-right">{formatPaisa(inv.sgst_paisa ?? inv.sgst_amount_paisa ?? 0)}</td>
                        <td className="px-4 py-3 text-right">{formatPaisa(inv.igst_paisa ?? inv.igst_amount_paisa ?? 0)}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">
                          {formatPaisa(inv.total_amount_paisa)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Invoice Register */}
      {activeTab === "invoices" && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
            <h3 className="text-sm font-semibold text-slate-900">Complete Invoice Register</h3>
            <span className="text-xs text-slate-500">{invoices.length} Invoices Recorded</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3 text-right">Taxable Amount</th>
                  <th className="px-4 py-3 text-right">Tax Total</th>
                  <th className="px-4 py-3 text-right">Grand Total</th>
                  <th className="px-4 py-3 text-right">Paid Amount</th>
                  <th className="px-4 py-3 text-right">Balance Due</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-indigo-600 font-semibold">
                      <Link href={`/finance/invoices/${inv.id}`} className="hover:underline">
                        {inv.invoice_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{inv.invoice_date}</td>
                    <td className="px-4 py-3 font-sans text-slate-900">{inv.customer_legal_name}</td>
                    <td className="px-4 py-3 text-right">{formatPaisa(inv.subtotal_paisa)}</td>
                    <td className="px-4 py-3 text-right">
                      {formatPaisa((inv.cgst_paisa || 0) + (inv.sgst_paisa || 0) + (inv.igst_paisa || 0))}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {formatPaisa(inv.total_amount_paisa)}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-600 font-medium">
                      {formatPaisa(inv.paid_amount_paisa)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-red-600">
                      {formatPaisa(inv.outstanding_amount_paisa)}
                    </td>
                    <td className="px-4 py-3 text-center font-sans">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[11px] font-medium ${
                          inv.status === "PAID"
                            ? "bg-green-100 text-green-800"
                            : inv.status === "PARTIALLY_PAID"
                            ? "bg-blue-100 text-blue-800"
                            : inv.status === "POSTED"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Payment Register */}
      {activeTab === "payments" && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
            <h3 className="text-sm font-semibold text-slate-900">Customer Collections & Receipts</h3>
            <span className="text-xs text-slate-500">{payments.length} Payments Recorded</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Payment #</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Reference / UTR</th>
                  <th className="px-4 py-3 text-right">Received Amount</th>
                  <th className="px-4 py-3 text-right">Allocated Amount</th>
                  <th className="px-4 py-3 text-right">Unallocated Advance</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-indigo-600 font-semibold">{p.payment_number}</td>
                    <td className="px-4 py-3">{p.payment_date}</td>
                    <td className="px-4 py-3 font-sans text-slate-900">
                      {p.customer?.shop_name || p.customer?.owner_name || "—"}
                    </td>
                    <td className="px-4 py-3 font-sans">{p.payment_method}</td>
                    <td className="px-4 py-3">{p.reference_number || "—"}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                      {formatPaisa(p.amount_paisa)}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-600">
                      {formatPaisa(p.allocated_amount_paisa)}
                    </td>
                    <td className="px-4 py-3 text-right text-amber-600">
                      {formatPaisa(p.unallocated_amount_paisa)}
                    </td>
                    <td className="px-4 py-3 text-center font-sans">
                      <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-800">
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Receivables Aging */}
      {activeTab === "aging" && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
            <h3 className="text-sm font-semibold text-slate-900">Customer Outstanding Aging Breakdown</h3>
            <span className="text-xs text-slate-500">{agingData.length} Customers with Outstanding Balance</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Customer Code</th>
                  <th className="px-4 py-3">Customer Name</th>
                  <th className="px-4 py-3 text-right">Not Yet Due</th>
                  <th className="px-4 py-3 text-right">1 – 30 Days</th>
                  <th className="px-4 py-3 text-right">31 – 60 Days</th>
                  <th className="px-4 py-3 text-right">61 – 90 Days</th>
                  <th className="px-4 py-3 text-right">90+ Days</th>
                  <th className="px-4 py-3 text-right font-bold">Total Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {agingData.map((cust) => (
                  <tr key={cust.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-900 font-semibold">{cust.code}</td>
                    <td className="px-4 py-3 font-sans text-slate-900">{cust.name}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatPaisa(cust.current_paisa)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatPaisa(cust.days_1_30_paisa)}</td>
                    <td className="px-4 py-3 text-right text-amber-700">{formatPaisa(cust.days_31_60_paisa)}</td>
                    <td className="px-4 py-3 text-right text-orange-700">{formatPaisa(cust.days_61_90_paisa)}</td>
                    <td className="px-4 py-3 text-right text-red-700 font-semibold">{formatPaisa(cust.days_90_plus_paisa)}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">
                      {formatPaisa(cust.total_outstanding_paisa)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
