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
  Receipt,
  ArrowLeft,
  Printer,
  CreditCard,
  Building2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  Plus,
} from "lucide-react";
import { getSalesInvoiceById, issueCreditNoteAction } from "@/modules/finance/actions";
import { SalesInvoice } from "@/types/database";

// Helper to convert paisa into Indian currency words
function numberToWordsINR(amountPaisa: number): string {
  const rupees = Math.floor(amountPaisa / 100);
  if (rupees === 0) return "Zero Rupees Only";

  const a = [
    "", "One ", "Two ", "Three ", "Four ", "Five ", "Six ", "Seven ", "Eight ", "Nine ",
    "Ten ", "Eleven ", "Twelve ", "Thirteen ", "Fourteen ", "Fifteen ", "Sixteen ", "Seventeen ", "Eighteen ", "Nineteen ",
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function inWords(num: number): string {
    if ((num = num.toString() as any).length > 9) return "Overflow";
    const n = ("000000000" + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return "";
    let str = "";
    str += Number(n[1]) !== 0 ? (a[Number(n[1])] || b[n[1][0] as any] + " " + a[n[1][1] as any]) + "Crore " : "";
    str += Number(n[2]) !== 0 ? (a[Number(n[2])] || b[n[2][0] as any] + " " + a[n[2][1] as any]) + "Lakh " : "";
    str += Number(n[3]) !== 0 ? (a[Number(n[3])] || b[n[3][0] as any] + " " + a[n[3][1] as any]) + "Thousand " : "";
    str += Number(n[4]) !== 0 ? (a[Number(n[4])] || b[n[4][0] as any] + " " + a[n[4][1] as any]) + "Hundred " : "";
    str += Number(n[5]) !== 0 ? ((str !== "" ? "and " : "") + (a[Number(n[5])] || b[n[5][0] as any] + " " + a[n[5][1] as any])) : "";
    return str;
  }

  return inWords(rupees) + "Rupees Only";
}

export default function InvoiceDetailsPrintPage() {
  const params = useParams();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<SalesInvoice | null>(null);
  const [loading, setLoading] = useState(true);

  // Credit Note Modal State
  const [isCnModalOpen, setIsCnModalOpen] = useState(false);
  const [cnReason, setCnReason] = useState("");
  const [cnTaxable, setCnTaxable] = useState<number | "">(100);
  const [cnGstRate, setCnGstRate] = useState<number>(5);
  const [submittingCn, setSubmittingCn] = useState(false);
  const [cnError, setCnError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const res = await getSalesInvoiceById(invoiceId);
    if (res.success && res.invoice) {
      setInvoice(res.invoice);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (invoiceId) loadData();
  }, [invoiceId]);

  const handlePrint = () => {
    window.print();
  };

  const handleIssueCreditNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cnTaxable || Number(cnTaxable) <= 0) {
      setCnError("Please enter a valid taxable amount.");
      return;
    }

    setSubmittingCn(true);
    setCnError(null);

    const res = await issueCreditNoteAction({
      invoiceId,
      reason: cnReason,
      lines: [
        {
          itemName: "Sales Return / Pricing Adjustment",
          quantity: 1,
          taxableAmount: Number(cnTaxable),
          gstRate: cnGstRate,
        },
      ],
    });

    setSubmittingCn(false);
    if (!res.success) {
      setCnError(res.error || "Failed to issue credit note.");
    } else {
      setIsCnModalOpen(false);
      loadData();
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
        <p className="text-sm text-zinc-500 mt-2">Loading GST Tax Invoice...</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="py-24 text-center">
        <AlertTriangle className="w-12 h-12 mx-auto text-amber-500 mb-2" />
        <h2 className="text-lg font-bold">Invoice Not Found</h2>
        <p className="text-sm text-zinc-500 mt-1">The requested tax invoice could not be located.</p>
        <Link href="/finance/invoices" className="mt-4 inline-block">
          <Button variant="outline" size="sm">
            &larr; Back to Invoices
          </Button>
        </Link>
      </div>
    );
  }

  const subtotal = ((invoice.subtotal_paisa || 0) / 100).toFixed(2);
  const discount = ((invoice.discount_paisa || 0) / 100).toFixed(2);
  const taxable = ((invoice.taxable_amount_paisa || 0) / 100).toFixed(2);
  const cgst = ((invoice.cgst_paisa || 0) / 100).toFixed(2);
  const sgst = ((invoice.sgst_paisa || 0) / 100).toFixed(2);
  const igst = ((invoice.igst_paisa || 0) / 100).toFixed(2);
  const grandTotal = ((invoice.total_amount_paisa || 0) / 100).toFixed(2);
  const balanceDue = ((invoice.outstanding_amount_paisa || 0) / 100).toFixed(2);
  const paid = ((invoice.paid_amount_paisa || 0) / 100).toFixed(2);
  const credited = ((invoice.credited_amount_paisa || 0) / 100).toFixed(2);

  const wordsInr = numberToWordsINR(invoice.total_amount_paisa);

  return (
    <div className="space-y-6 pb-16 max-w-4xl mx-auto">
      {/* Top Action Controls (Hidden on Print) */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/finance/invoices">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 font-mono">
                {invoice.invoice_number}
              </h1>
              <Badge className="font-mono text-xs">{invoice.status}</Badge>
            </div>
            <p className="text-xs text-zinc-500">
              Generated for {invoice.customer?.shop_name || invoice.customer_legal_name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {invoice.status !== "CANCELLED" && Number(balanceDue) > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCnTaxable(Math.min(500, Number(balanceDue)));
                setIsCnModalOpen(true);
              }}
              className="text-xs"
            >
              Issue Credit Note
            </Button>
          )}

          <Button size="sm" onClick={handlePrint} className="flex items-center gap-1.5">
            <Printer className="w-4 h-4" />
            Print / Save PDF
          </Button>
        </div>
      </div>

      {/* Tax Invoice Printable Document Card */}
      <div className="bg-white text-zinc-900 border rounded-lg p-6 sm:p-8 shadow-sm print:border-none print:shadow-none print:p-0">
        {/* Document Title Header */}
        <div className="border-b pb-4 flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <div className="text-2xl font-black tracking-tight text-zinc-900 uppercase">
              {invoice.company_legal_name || "KanakkuFlow ERP Foods Pvt Ltd"}
            </div>
            <div className="text-xs text-zinc-600 mt-1 max-w-sm">
              Branch: {invoice.branch?.name} ({invoice.branch?.code})
              <br />
              GSTIN: <span className="font-mono font-bold">{invoice.company_gstin || "33AAAAA0000A1Z5"}</span>
              <br />
              State: Tamil Nadu (Code: 33) &bull; FSSAI Lic: 12424001000123
            </div>
          </div>

          <div className="text-left sm:text-right">
            <div className="inline-block px-3 py-1 bg-zinc-100 rounded text-xs font-bold uppercase tracking-wider text-zinc-800">
              TAX INVOICE
            </div>
            <div className="text-xs text-zinc-500 mt-1 font-mono">Original for Recipient</div>
            <div className="font-mono font-bold text-lg text-primary mt-1">
              {invoice.invoice_number}
            </div>
            <div className="text-xs text-zinc-600 mt-0.5">
              Invoice Date: <span className="font-semibold">{new Date(invoice.invoice_date).toLocaleDateString("en-IN")}</span>
            </div>
            <div className="text-xs text-zinc-600">
              Due Date: <span className="font-semibold">{new Date(invoice.due_date).toLocaleDateString("en-IN")}</span>
            </div>
          </div>
        </div>

        {/* Billed To and Shipped To Information */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-4 border-b text-xs">
          <div>
            <div className="font-bold uppercase tracking-wider text-zinc-500 mb-1">
              Billed To (Customer Details)
            </div>
            <div className="font-bold text-sm text-zinc-900">{invoice.customer_legal_name}</div>
            <div className="text-zinc-600 mt-0.5">
              {invoice.billing_address?.address_line1}, {invoice.billing_address?.city}
              <br />
              {invoice.billing_address?.state} - {invoice.billing_address?.pincode}
            </div>
            <div className="mt-1">
              GSTIN: <span className="font-mono font-semibold">{invoice.customer_gstin || "Unregistered (B2C)"}</span>
            </div>
            <div>
              State / Place of Supply: <span className="font-semibold">{invoice.place_of_supply}</span>
            </div>
          </div>

          <div>
            <div className="font-bold uppercase tracking-wider text-zinc-500 mb-1">
              Order Reference &amp; Terms
            </div>
            <div className="space-y-1 text-zinc-600">
              <div>Sales Order: <span className="font-mono font-semibold text-zinc-900">{invoice.sales_order?.order_number || "Direct"}</span></div>
              <div>Payment Terms: <span className="font-semibold">{invoice.payment_terms_days} Days Net</span></div>
              <div>Reverse Charge: <span className="font-semibold">{invoice.is_reverse_charge ? "Yes" : "No"}</span></div>
              {invoice.notes && <div>Remarks: {invoice.notes}</div>}
            </div>
          </div>
        </div>

        {/* Invoice Line Items Table */}
        <div className="py-4">
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="border-b-2 border-zinc-900 bg-zinc-50/50">
                <TableHead className="w-8">#</TableHead>
                <TableHead>Description of Goods</TableHead>
                <TableHead>HSN/SAC</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Rate (₹)</TableHead>
                <TableHead className="text-right">Disc</TableHead>
                <TableHead className="text-right">Taxable (₹)</TableHead>
                <TableHead className="text-right">GST %</TableHead>
                <TableHead className="text-right">Total (₹)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(invoice.lines || []).map((line, idx) => (
                <TableRow key={line.id} className="border-b">
                  <TableCell className="font-mono text-[11px]">{idx + 1}</TableCell>
                  <TableCell>
                    <div className="font-semibold text-zinc-900">{line.item_name}</div>
                    <div className="text-[10px] text-zinc-500 font-mono">{line.sku}</div>
                  </TableCell>
                  <TableCell className="font-mono">{line.hsn_code}</TableCell>
                  <TableCell className="text-right font-medium">
                    {Number(line.quantity).toLocaleString()} {line.unit_code}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {((line.unit_price_paisa || 0) / 100).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-zinc-500">
                    {Number(line.discount_percent) > 0 ? `${line.discount_percent}%` : "-"}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {((line.taxable_value_paisa || 0) / 100).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {line.gst_rate_percent}%
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {((line.line_total_paisa || 0) / 100).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Financial Summary & Tax Breakup */}
        <div className="border-t pt-4 grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
          <div>
            <div className="font-semibold uppercase text-zinc-500 mb-1">Amount in Words:</div>
            <div className="font-medium italic text-zinc-800 bg-zinc-50 p-2.5 rounded border">
              {wordsInr}
            </div>

            {/* Bank details for NEFT/RTGS */}
            <div className="mt-4 p-2.5 bg-zinc-50 rounded border text-[11px] text-zinc-600 space-y-0.5">
              <div className="font-bold text-zinc-800 uppercase">Bank Remittance Account</div>
              <div>Bank: HDFC Bank Ltd &bull; Branch: Anna Nagar, Chennai</div>
              <div>Account Name: Sri Murugan Foods ERP Invoicing</div>
              <div>A/C Number: <span className="font-mono font-semibold">50200012345678</span></div>
              <div>IFSC Code: <span className="font-mono font-semibold">HDFC0000240</span></div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-zinc-600">Total Taxable Value:</span>
              <span className="font-mono">₹{taxable}</span>
            </div>
            {Number(cgst) > 0 && (
              <div className="flex justify-between text-zinc-600">
                <span>Central GST (CGST):</span>
                <span className="font-mono">₹{cgst}</span>
              </div>
            )}
            {Number(sgst) > 0 && (
              <div className="flex justify-between text-zinc-600">
                <span>State GST (SGST):</span>
                <span className="font-mono">₹{sgst}</span>
              </div>
            )}
            {Number(igst) > 0 && (
              <div className="flex justify-between text-zinc-600">
                <span>Integrated GST (IGST):</span>
                <span className="font-mono">₹{igst}</span>
              </div>
            )}
            <div className="flex justify-between border-t-2 border-zinc-900 pt-1.5 text-base font-black">
              <span>Invoice Grand Total:</span>
              <span className="font-mono text-primary">₹{grandTotal}</span>
            </div>
            <div className="flex justify-between text-zinc-600 pt-1">
              <span>Total Collections Received:</span>
              <span className="font-mono text-emerald-600">₹{paid}</span>
            </div>
            {Number(credited) > 0 && (
              <div className="flex justify-between text-zinc-600">
                <span>Credit Notes Applied:</span>
                <span className="font-mono text-purple-600">-₹{credited}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-1 font-bold text-sm">
              <span>Balance Outstanding:</span>
              <span className="font-mono text-amber-700">₹{balanceDue}</span>
            </div>
          </div>
        </div>

        {/* Declarations & Signatures */}
        <div className="mt-8 pt-4 border-t text-[10px] text-zinc-500 flex flex-col sm:flex-row justify-between items-end gap-6">
          <div className="space-y-1 max-w-sm">
            <div className="font-semibold text-zinc-700">Declaration:</div>
            <div>
              We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct. Goods once sold will not be taken back without prior written authorization.
            </div>
            <div className="text-amber-800 italic">
              * Statutory CA compliance notice: Formats and tax rates subject to review by company Chartered Accountant.
            </div>
          </div>

          <div className="text-center sm:text-right space-y-10">
            <div className="font-semibold text-zinc-800">
              For {invoice.company_legal_name || "KanakkuFlow ERP"}
            </div>
            <div className="border-t border-zinc-400 pt-1 font-semibold text-zinc-700">
              Authorized Signatory
            </div>
          </div>
        </div>
      </div>

      {/* Credit Note Dialog */}
      <Dialog open={isCnModalOpen} onOpenChange={setIsCnModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              Issue Credit Note
            </DialogTitle>
            <DialogDescription>
              Create an authorized credit note to reduce customer outstanding on this invoice.
            </DialogDescription>
          </DialogHeader>

          {cnError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-600">
              {cnError}
            </div>
          )}

          <form onSubmit={handleIssueCreditNote} className="space-y-4 pt-2">
            <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded border text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-zinc-500">Invoice:</span>
                <span className="font-mono font-semibold">{invoice.invoice_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Remaining Balance:</span>
                <span className="font-mono font-semibold text-amber-600">₹{balanceDue}</span>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Credit Taxable Amount (₹) *</Label>
              <Input
                type="number"
                step="0.01"
                min="1"
                max={Number(balanceDue)}
                className="h-8 text-xs font-mono"
                value={cnTaxable}
                onChange={(e) => setCnTaxable(Number(e.target.value))}
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">GST Tax Rate (%)</Label>
              <select
                className="w-full px-2.5 py-1.5 border rounded text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                value={cnGstRate}
                onChange={(e) => setCnGstRate(Number(e.target.value))}
              >
                <option value={5}>5% GST (Standard Namkeen/Murukku)</option>
                <option value={12}>12% GST</option>
                <option value={18}>18% GST</option>
                <option value={0}>0% Exempt</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Reason for Credit Note *</Label>
              <Input
                placeholder="e.g., Damaged packets credit / Agreed trade promotion rebate"
                value={cnReason}
                onChange={(e) => setCnReason(e.target.value)}
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsCnModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submittingCn}>
                {submittingCn ? "Issuing..." : "Issue Credit Note"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
