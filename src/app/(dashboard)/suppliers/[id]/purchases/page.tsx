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
  ArrowLeft,
  Building2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CreditCard,
  FileText,
  Truck,
  ReceiptText,
  TrendingUp,
  Loader2,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { getSupplierById } from "@/modules/master/actions";
import { getSupplierPurchaseHistory } from "@/modules/procurement/bills-actions";
import { Supplier } from "@/types/database";

export default function SupplierPurchasesHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const supplierId = params.id as string;

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [history, setHistory] = useState<{
    purchaseOrders: any[];
    goodsReceipts: any[];
    supplierBills: any[];
    metrics: {
      totalOrders: number;
      totalSpendPaisa: number;
      pendingOrders: number;
    };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"pos" | "grns" | "bills" | "prices">("pos");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const [suppRes, histRes] = await Promise.all([
        getSupplierById(supplierId),
        getSupplierPurchaseHistory(supplierId),
      ]);

      if (suppRes.success && suppRes.supplier) {
        setSupplier(suppRes.supplier);
      }
      if (histRes.success && histRes.history) {
        setHistory(histRes.history);
      }
      setLoading(false);
    }

    if (supplierId) {
      loadData();
    }
  }, [supplierId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-zinc-500 font-medium">
          Loading Supplier 360° Procurement Record...
        </p>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="p-8 text-center space-y-4">
        <h2 className="text-xl font-bold text-zinc-800">Supplier Not Found</h2>
        <p className="text-sm text-zinc-500">
          The requested vendor ID does not exist or you do not have permission to view it.
        </p>
        <Button onClick={() => router.push("/master/suppliers")}>Back to Suppliers</Button>
      </div>
    );
  }

  // Extract recent purchase price comparisons across line items
  const priceHistoryMap: Record<
    string,
    { itemName: string; unitSymbol: string; entries: { date: string; poNumber: string; rate: number }[] }
  > = {};

  history?.purchaseOrders.forEach((po) => {
    po.lines?.forEach((l: any) => {
      const key = l.item?.name || "Unknown Item";
      if (!priceHistoryMap[key]) {
        priceHistoryMap[key] = {
          itemName: key,
          unitSymbol: l.unit?.symbol || "unit",
          entries: [],
        };
      }
      priceHistoryMap[key].entries.push({
        date: po.order_date,
        poNumber: po.po_number,
        rate: (l.unit_price_paisa || 0) / 100,
      });
    });
  });

  const priceHistoryList = Object.values(priceHistoryMap);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Navigation */}
      <div className="flex items-center gap-2">
        <Link
          href="/master/suppliers"
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Suppliers Master
        </Link>
      </div>

      {/* Supplier Profile Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-semibold">
                  {supplier.code}
                </span>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {supplier.name}
                </h1>
                {supplier.trade_name && (
                  <span className="text-sm text-zinc-500 font-normal">
                    ({supplier.trade_name})
                  </span>
                )}
                <Badge
                  className={
                    supplier.is_active
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-zinc-200 text-zinc-700"
                  }
                >
                  {supplier.is_active ? "Active Vendor" : "Inactive"}
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2 text-xs text-zinc-600 dark:text-zinc-400 pt-2">
                {supplier.gstin && (
                  <div>
                    <span className="font-semibold text-zinc-500">GSTIN: </span>
                    <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">
                      {supplier.gstin}
                    </span>
                  </div>
                )}
                {supplier.pan && (
                  <div>
                    <span className="font-semibold text-zinc-500">PAN: </span>
                    <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">
                      {supplier.pan}
                    </span>
                  </div>
                )}
                {supplier.contact_person && (
                  <div>
                    <span className="font-semibold text-zinc-500">Contact: </span>
                    <span>{supplier.contact_person}</span>
                  </div>
                )}
                {supplier.mobile && (
                  <div className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{supplier.mobile}</span>
                  </div>
                )}
                {supplier.email && (
                  <div className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{supplier.email}</span>
                  </div>
                )}
                <div>
                  <span className="font-semibold text-zinc-500">Credit Terms: </span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {supplier.payment_terms_days} Days
                  </span>
                </div>
                {supplier.address_line1 && (
                  <div className="sm:col-span-2 flex items-start gap-1">
                    <MapPin className="w-3.5 h-3.5 text-zinc-400 mt-0.5 shrink-0" />
                    <span>
                      {supplier.address_line1}, {supplier.city}, {supplier.state} - {supplier.pincode}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 shrink-0">
              <Link href={`/purchases/new?supplierId=${supplier.id}`}>
                <Button size="sm" className="w-full sm:w-auto flex items-center gap-1.5">
                  <FileText className="w-4 h-4" /> Create Purchase Order
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Procurement Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="py-3 px-4 pb-1">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Total Purchase Orders
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 py-2">
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {history?.metrics.totalOrders || 0}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">Orders issued to date</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3 px-4 pb-1">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-primary">
              Total Billed Spend
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 py-2">
            <div className="text-2xl font-bold text-primary">
              ₹{(((history?.metrics.totalSpendPaisa || 0) / 100)).toLocaleString("en-IN", {
                minimumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">Matched & recorded vendor invoices</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3 px-4 pb-1">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Open / In-Flight Orders
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 py-2">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {history?.metrics.pendingOrders || 0}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">Awaiting complete goods receipt</p>
          </CardContent>
        </Card>
      </div>

      {/* 360 Tabs */}
      <Card>
        <div className="border-b border-zinc-200 dark:border-zinc-800 px-6 pt-4 flex gap-6">
          <button
            onClick={() => setActiveTab("pos")}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === "pos"
                ? "border-primary text-primary"
                : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            <FileText className="w-4 h-4" />
            Purchase Orders ({history?.purchaseOrders.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("grns")}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === "grns"
                ? "border-primary text-primary"
                : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            <Truck className="w-4 h-4" />
            Goods Receipts ({history?.goodsReceipts.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("bills")}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === "bills"
                ? "border-primary text-primary"
                : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            <ReceiptText className="w-4 h-4" />
            Vendor Bills ({history?.supplierBills.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("prices")}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === "prices"
                ? "border-primary text-primary"
                : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Purchase Price History
          </button>
        </div>

        <CardContent className="p-0">
          {/* TAB 1: PURCHASE ORDERS */}
          {activeTab === "pos" && (
            <Table>
              <TableHeader>
                <TableRow className="bg-zinc-50 dark:bg-zinc-900/50">
                  <TableHead className="text-xs font-semibold">PO Number</TableHead>
                  <TableHead className="text-xs font-semibold">Order Date</TableHead>
                  <TableHead className="text-xs font-semibold">Line Items</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Order Value (₹)</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history?.purchaseOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-xs text-zinc-500">
                      No purchase orders recorded for this vendor.
                    </TableCell>
                  </TableRow>
                ) : (
                  history?.purchaseOrders.map((po) => (
                    <TableRow key={po.id}>
                      <TableCell className="font-mono font-bold text-xs text-primary">
                        {po.po_number}
                      </TableCell>
                      <TableCell className="text-xs">{po.order_date}</TableCell>
                      <TableCell className="text-xs text-zinc-600 dark:text-zinc-400">
                        {po.lines?.map((l: any) => l.item?.name).filter(Boolean).join(", ") ||
                          "—"}
                      </TableCell>
                      <TableCell className="text-xs font-mono font-bold text-right">
                        ₹{(po.total_paisa / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-mono">
                          {po.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/purchases/${po.id}`}>
                          <Button variant="ghost" size="sm" className="h-7 text-xs flex items-center gap-1">
                            <span>View</span>
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}

          {/* TAB 2: GOODS RECEIPTS */}
          {activeTab === "grns" && (
            <Table>
              <TableHeader>
                <TableRow className="bg-zinc-50 dark:bg-zinc-900/50">
                  <TableHead className="text-xs font-semibold">GRN #</TableHead>
                  <TableHead className="text-xs font-semibold">Receipt Date</TableHead>
                  <TableHead className="text-xs font-semibold">Delivery Challan</TableHead>
                  <TableHead className="text-xs font-semibold">Received Materials</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history?.goodsReceipts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-xs text-zinc-500">
                      No inward goods receipts logged for this vendor.
                    </TableCell>
                  </TableRow>
                ) : (
                  history?.goodsReceipts.map((grn) => (
                    <TableRow key={grn.id}>
                      <TableCell className="font-mono font-bold text-xs text-primary">
                        {grn.grn_number}
                      </TableCell>
                      <TableCell className="text-xs">{grn.receipt_date}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {grn.supplier_delivery_challan || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-600 dark:text-zinc-400">
                        {grn.lines
                          ?.map((l: any) => `${l.item?.name} (${l.accepted_qty} ${l.unit?.symbol})`)
                          .join(", ") || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-mono">
                          {grn.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/goods-receipts/${grn.id}`}>
                          <Button variant="ghost" size="sm" className="h-7 text-xs flex items-center gap-1">
                            <span>View</span>
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}

          {/* TAB 3: VENDOR BILLS */}
          {activeTab === "bills" && (
            <Table>
              <TableHeader>
                <TableRow className="bg-zinc-50 dark:bg-zinc-900/50">
                  <TableHead className="text-xs font-semibold">Bill #</TableHead>
                  <TableHead className="text-xs font-semibold">Vendor Inv #</TableHead>
                  <TableHead className="text-xs font-semibold">Invoice Date</TableHead>
                  <TableHead className="text-xs font-semibold">Due Date</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Bill Value (₹)</TableHead>
                  <TableHead className="text-xs font-semibold">Match Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history?.supplierBills.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-xs text-zinc-500">
                      No invoices recorded for this vendor yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  history?.supplierBills.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-mono font-bold text-xs text-primary">
                        {b.bill_number}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{b.supplier_invoice_number}</TableCell>
                      <TableCell className="text-xs">{b.invoice_date}</TableCell>
                      <TableCell className="text-xs">{b.due_date}</TableCell>
                      <TableCell className="text-xs font-mono font-bold text-right">
                        ₹{(b.total_amount_paisa / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        {b.status === "POSTED" && (
                          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            Matched
                          </Badge>
                        )}
                        {b.status === "DISCREPANCY_FLAGGED" && (
                          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            Discrepancy
                          </Badge>
                        )}
                        {b.status === "DRAFT" && <Badge variant="outline">Draft</Badge>}
                        {b.status === "PAID" && <Badge className="bg-blue-100 text-blue-800">Paid</Badge>}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}

          {/* TAB 4: RECENT PURCHASE PRICE COMPARISONS */}
          {activeTab === "prices" && (
            <div className="p-6 space-y-6">
              <div className="text-xs text-zinc-500">
                Tracking historical purchase rates allows procurement managers to detect material price spikes and negotiate future contracts.
              </div>

              {priceHistoryList.length === 0 ? (
                <div className="text-center py-10 text-xs text-zinc-500">
                  No purchase line item history available for price trend analysis.
                </div>
              ) : (
                <div className="space-y-4">
                  {priceHistoryList.map((item) => (
                    <Card key={item.itemName} className="border border-zinc-200 dark:border-zinc-800">
                      <CardHeader className="py-3 px-4 bg-zinc-50 dark:bg-zinc-900/40">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                            {item.itemName}
                          </CardTitle>
                          <Badge variant="outline" className="text-xs">
                            Base: Per {item.unitSymbol}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">PO Number</TableHead>
                              <TableHead className="text-xs">Order Date</TableHead>
                              <TableHead className="text-xs text-right">Contracted Rate (₹)</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {item.entries.map((entry, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="font-mono text-xs text-primary">
                                  {entry.poNumber}
                                </TableCell>
                                <TableCell className="text-xs">{entry.date}</TableCell>
                                <TableCell className="text-xs font-mono font-bold text-right">
                                  ₹{entry.rate.toFixed(2)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
