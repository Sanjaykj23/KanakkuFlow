"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  FileText,
  AlertCircle,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Plus,
  RefreshCw,
  Eye,
  IndianRupee,
} from "lucide-react";
import { formatPaisa } from "@/lib/utils";
import { getCreditNotes, issueCreditNoteAction } from "@/modules/finance/actions";
import type { CreditNote } from "@/types/database";

export default function CreditNotesPage() {
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const [isPending, startTransition] = useTransition();

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getCreditNotes();
      if (res.success && res.creditNotes) {
        setCreditNotes(res.creditNotes);
      } else {
        setError(res.error || "Failed to load credit notes");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredNotes = creditNotes.filter((cn) => {
    const matchesSearch =
      cn.credit_note_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cn.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cn.customer?.shop_name && cn.customer.shop_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (cn.original_invoice?.invoice_number && cn.original_invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === "ALL" || cn.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalCreditedPaisa = filteredNotes.reduce((acc, cn) => acc + (cn.total_amount_paisa || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Credit Notes Register</h1>
            <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20">
              Receivables Adjustments
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Authoritative sales returns, discounts, and invoice value adjustments reducing customer outstanding.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 focus:outline-none"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Link
            href="/finance/invoices"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Issue from Invoice
          </Link>
        </div>
      </div>

      {/* Statutory Disclaimer */}
      <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-lg flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <span className="font-semibold">GST Compliance Note:</span> Credit notes must be reported in GSTR-1 in the month of issue.
          Ensure corresponding original tax invoice numbers and GST breakdown are accurately recorded. Section 34 of the CGST Act mandates that credit notes for an invoice can be issued no later than 30th November following the end of the financial year.
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center bg-slate-50 p-4 rounded-lg border border-slate-200">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Credit Note #, Invoice #, Customer, or Reason..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm bg-white border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="PENDING_APPROVAL">Pending Approval</option>
              <option value="POSTED">Posted</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <div className="text-sm text-slate-600 bg-white border border-slate-200 px-3 py-2 rounded-md font-medium">
            Total Adjusted: <span className="font-bold text-slate-900">{formatPaisa(totalCreditedPaisa)}</span>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={loadData} className="underline font-medium hover:text-red-900">
            Try again
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-3">Credit Note #</th>
                <th className="px-6 py-3">Original Invoice</th>
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">Issue Date</th>
                <th className="px-6 py-3">Reason</th>
                <th className="px-6 py-3 text-right">Credit Amount</th>
                <th className="px-6 py-3 text-center">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                      <span>Loading credit notes...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredNotes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-medium text-slate-600">No credit notes found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Credit notes are issued against posted invoices from the invoice details view.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredNotes.map((cn) => (
                  <tr key={cn.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-mono font-medium text-slate-900">
                      {cn.credit_note_number}
                    </td>
                    <td className="px-6 py-4">
                      {cn.original_invoice ? (
                        <Link
                          href={`/finance/invoices/${cn.original_invoice_id}`}
                          className="font-mono text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                        >
                          {cn.original_invoice.invoice_number}
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      ) : (
                        <span className="font-mono text-slate-400">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {cn.customer?.shop_name || cn.customer?.owner_name || "—"}
                    </td>
                    <td className="px-6 py-4 text-slate-600 whitespace-nowrap">
                      {new Date(cn.credit_note_date).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-4 text-slate-700 max-w-xs truncate" title={cn.reason}>
                      {cn.reason}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-900">
                      {formatPaisa(cn.total_amount_paisa)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          cn.status === "POSTED"
                            ? "bg-green-100 text-green-800"
                            : cn.status === "DRAFT"
                            ? "bg-amber-100 text-amber-800"
                            : cn.status === "PENDING_APPROVAL"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {cn.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {cn.original_invoice_id && (
                        <Link
                          href={`/finance/invoices/${cn.original_invoice_id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View Invoice
                        </Link>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
