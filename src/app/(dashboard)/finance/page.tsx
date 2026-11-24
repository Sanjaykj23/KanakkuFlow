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
  IndianRupee,
  Receipt,
  FileSpreadsheet,
  AlertTriangle,
  ArrowRight,
  CreditCard,
  TrendingUp,
  Clock,
  Plus,
  Loader2,
  Boxes,
  ShieldCheck,
  Calendar,
} from "lucide-react";
import { getFinanceMetrics, getSalesInvoices } from "@/modules/finance/actions";
import { SalesInvoice } from "@/types/database";

export default function FinanceOverviewPage() {
  const [metrics, setMetrics] = useState<{
    totalInvoicedPaisa: number;
    totalCollectionsPaisa: number;
    totalOutstandingPaisa: number;
    overdueInvoicesCount: number;
  } | null>(null);
  const [recentInvoices, setRecentInvoices] = useState<SalesInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const [mRes, iRes] = await Promise.all([
        getFinanceMetrics(),
        getSalesInvoices(),
      ]);

      if (mRes.success && mRes.metrics) setMetrics(mRes.metrics);
      if (iRes.success && iRes.invoices) setRecentInvoices(iRes.invoices.slice(0, 5));
      setLoading(false);
    }
    loadData();
  }, []);

  const totalInvoiced = ((metrics?.totalInvoicedPaisa || 0) / 100).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });
  const totalCollections = ((metrics?.totalCollectionsPaisa || 0) / 100).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });
  const totalOutstanding = ((metrics?.totalOutstandingPaisa || 0) / 100).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });

  return (
    <div className="space-y-6 pb-16 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <IndianRupee className="w-6 h-6 text-primary" />
            Invoicing &amp; Financial Management
          </h1>
          <p className="text-sm text-zinc-500">
            GST tax invoicing, receivables ledger, customer payments, credit notes, and collection aging.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/finance/payments">
            <Button size="sm" className="flex items-center gap-1.5">
              <Plus className="w-4 h-4" />
              Record Payment
            </Button>
          </Link>
          <Link href="/finance/invoices">
            <Button variant="outline" size="sm" className="flex items-center gap-1.5">
              <Receipt className="w-4 h-4" />
              View Invoices
            </Button>
          </Link>
        </div>
      </div>

      {/* Statutory CA Review Disclaimer */}
      <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-amber-600 flex-shrink-0" />
        <span>
          <strong>Chartered Accountant Notice:</strong> GST invoice formats, tax slabs, document serial numbering, and statutory declarations must be formally reviewed and approved by the company&apos;s Chartered Accountant before production use.
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Total Invoiced
            </div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1 font-mono">
              {loading ? "-" : `₹${totalInvoiced}`}
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              Cumulative posted billing
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Total Collections
            </div>
            <div className="text-2xl font-bold text-emerald-600 mt-1 font-mono">
              {loading ? "-" : `₹${totalCollections}`}
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              Payments received &amp; posted
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Current Receivables
            </div>
            <div className="text-2xl font-bold text-amber-600 mt-1 font-mono">
              {loading ? "-" : `₹${totalOutstanding}`}
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              Customer balance outstanding
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-rose-500">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Overdue Invoices
            </div>
            <div className="text-2xl font-bold text-rose-600 mt-1 font-mono">
              {loading ? "-" : metrics?.overdueInvoicesCount || 0}
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              Past payment terms due date
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Modules */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/finance/invoices" className="group">
          <Card className="h-full border hover:border-primary/50 transition-all hover:shadow-md">
            <CardHeader>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-2 group-hover:scale-105 transition-transform">
                <Receipt className="w-5 h-5" />
              </div>
              <CardTitle className="text-base flex items-center justify-between">
                <span>GST Tax Invoices</span>
                <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-primary transition-colors" />
              </CardTitle>
              <CardDescription className="text-xs">
                Generate, post, and print GST-compliant tax invoices from approved sales orders and dispatches.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-primary font-medium flex items-center gap-1">
              Invoice Register &rarr;
            </CardContent>
          </Card>
        </Link>

        <Link href="/finance/payments" className="group">
          <Card className="h-full border hover:border-primary/50 transition-all hover:shadow-md">
            <CardHeader>
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 mb-2 group-hover:scale-105 transition-transform">
                <CreditCard className="w-5 h-5" />
              </div>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Payments &amp; Allocation</span>
                <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-primary transition-colors" />
              </CardTitle>
              <CardDescription className="text-xs">
                Record customer remittances (Bank, UPI, Cash) and allocate across multiple open invoices.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-emerald-600 font-medium flex items-center gap-1">
              Payment Register &rarr;
            </CardContent>
          </Card>
        </Link>

        <Link href="/finance/outstanding" className="group">
          <Card className="h-full border hover:border-primary/50 transition-all hover:shadow-md">
            <CardHeader>
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-600 mb-2 group-hover:scale-105 transition-transform">
                <TrendingUp className="w-5 h-5" />
              </div>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Receivables &amp; Aging</span>
                <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-primary transition-colors" />
              </CardTitle>
              <CardDescription className="text-xs">
                Authoritative customer receivables ledger and aging buckets (Current, 1–30, 31–60, 61–90, 90+ days).
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-purple-600 font-medium flex items-center gap-1">
              View Aging Buckets &rarr;
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent Invoices Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base">Recent Sales Invoices</CardTitle>
            <CardDescription className="text-xs">
              Latest posted billing documents with real-time settlement status.
            </CardDescription>
          </div>
          <Link href="/finance/invoices">
            <Button variant="ghost" size="sm" className="text-xs">
              View All Invoices &rarr;
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-zinc-500 text-xs">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary mb-2" />
              Loading invoices...
            </div>
          ) : recentInvoices.length === 0 ? (
            <div className="py-8 text-center text-zinc-500 text-xs">
              <Boxes className="w-8 h-8 mx-auto text-zinc-400 mb-2" />
              No invoices generated yet. Generate an invoice from an approved sales order.
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {recentInvoices.map((inv) => {
                const total = ((inv.total_amount_paisa || 0) / 100).toFixed(2);
                const outstanding = ((inv.outstanding_amount_paisa || 0) / 100).toFixed(2);

                return (
                  <div
                    key={inv.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/finance/invoices/${inv.id}`}
                          className="font-mono font-semibold text-xs text-primary hover:underline"
                        >
                          {inv.invoice_number}
                        </Link>
                        <Badge variant="outline" className="text-[10px] py-0 font-normal">
                          {inv.customer?.shop_name || inv.customer_legal_name}
                        </Badge>
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        Date: {new Date(inv.invoice_date).toLocaleDateString("en-IN")} &bull; Due: {new Date(inv.due_date).toLocaleDateString("en-IN")} &bull; Branch: {inv.branch?.name}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-mono font-bold text-sm text-zinc-900 dark:text-zinc-100">
                          ₹{Number(total).toLocaleString("en-IN")}
                        </div>
                        <div className="text-[10px] font-mono text-zinc-500">
                          Due: ₹{Number(outstanding).toLocaleString("en-IN")}
                        </div>
                      </div>
                      <Badge className="font-mono text-xs">{inv.status}</Badge>
                      <Link href={`/finance/invoices/${inv.id}`}>
                        <Button variant="outline" size="sm" className="h-7 text-xs">
                          View &rarr;
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
