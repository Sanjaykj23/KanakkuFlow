"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingCart,
  ArrowLeft,
  Plus,
  Trash2,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  CreditCard,
  Truck,
  CheckCircle2,
  Tag,
  Search,
} from "lucide-react";
import { getCustomers } from "@/modules/customers/actions";
import { getCompanyBranches } from "@/modules/users/actions";
import { getItems, getUnits } from "@/modules/master/actions";
import {
  getPriceLists,
  resolveItemPrice,
  checkCustomerCredit,
  createSalesOrder,
} from "@/modules/sales/actions";
import { Customer, Item, Unit, PriceList } from "@/types/database";

interface OrderLineState {
  itemId: string;
  sku: string;
  orderedQty: number;
  unitId: string;
  conversionRate: number;
  unitPrice: number;
  discountPercent: number;
  taxRateId: string;
  taxRatePercent: number;
  lineTotal: number;
  priceSource: string;
}

export default function NewSalesOrderPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Master Data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [branches, setBranches] = useState<{ id: string; code: string; name: string }[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);

  // Form Header State
  const [customerId, setCustomerId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [deliveryAddressId, setDeliveryAddressId] = useState("");
  const [priceListId, setPriceListId] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState(
    new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [paymentTermsDays, setPaymentTermsDays] = useState(7);
  const [notes, setNotes] = useState("");

  // Customer Credit State
  const [creditInfo, setCreditInfo] = useState<{
    creditLimitPaisa: number;
    availableCreditPaisa: number;
    pendingExposurePaisa: number;
  } | null>(null);
  const [checkingCredit, setCheckingCredit] = useState(false);

  // Form Lines State
  const [lines, setLines] = useState<OrderLineState[]>([]);

  useEffect(() => {
    async function loadMasterData() {
      setLoading(true);
      const [cRes, bRes, iRes, uRes, pRes] = await Promise.all([
        getCustomers(),
        getCompanyBranches(),
        getItems(),
        getUnits(),
        getPriceLists(),
      ]);

      if (cRes.success && cRes.customers) setCustomers(cRes.customers.filter((c) => c.is_active));
      if (Array.isArray(bRes) && bRes.length > 0) {
        setBranches(bRes);
        setBranchId(bRes[0].id);
      }
      if (iRes.success && iRes.items) setItems(iRes.items.filter((it) => it.is_active));
      if (uRes.success && uRes.units) setUnits(uRes.units);
      if (pRes.success && pRes.priceLists) setPriceLists(pRes.priceLists.filter((p) => p.is_active));

      setLoading(false);
    }
    loadMasterData();
  }, []);

  // When customer changes, load address and check credit
  useEffect(() => {
    if (!customerId) {
      setCreditInfo(null);
      setDeliveryAddressId("");
      return;
    }

    const selectedCust = customers.find((c) => c.id === customerId);
    if (selectedCust) {
      if (selectedCust.branch_id) {
        setBranchId(selectedCust.branch_id);
      }
      setPaymentTermsDays(selectedCust.payment_terms_days || 7);

      const addresses = selectedCust.addresses || [];
      const primary = addresses.find((a) => a.is_primary) || addresses[0];
      if (primary) setDeliveryAddressId(primary.id);
    }

    async function checkCredit() {
      setCheckingCredit(true);
      const res = await checkCustomerCredit(customerId);
      if (res.success && res.creditLimitPaisa !== undefined) {
        setCreditInfo({
          creditLimitPaisa: res.creditLimitPaisa,
          availableCreditPaisa: res.availableCreditPaisa || 0,
          pendingExposurePaisa: res.pendingExposurePaisa || 0,
        });
      }
      setCheckingCredit(false);
    }
    checkCredit();
  }, [customerId, customers]);

  const addLine = () => {
    if (items.length === 0 || units.length === 0) return;
    const defaultItem = items[0];
    const defaultUnit = units.find((u) => u.id === defaultItem.primary_unit_id) || units[0];

    setLines([
      ...lines,
      {
        itemId: defaultItem.id,
        sku: defaultItem.code,
        orderedQty: 10,
        unitId: defaultUnit.id,
        conversionRate: 1,
        unitPrice: Number(defaultItem.base_price) || 50,
        discountPercent: 0,
        taxRateId: defaultItem.default_tax_rate_id || "",
        taxRatePercent: 5,
        lineTotal: 500,
        priceSource: "BASE_PRICE",
      },
    ]);
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleItemChange = async (index: number, newItemId: string) => {
    const selectedItem = items.find((i) => i.id === newItemId);
    if (!selectedItem) return;

    const unit = units.find((u) => u.id === selectedItem.primary_unit_id) || units[0];
    let price = Number(selectedItem.base_price) || 50;
    let source = "ITEM_BASE_PRICE";

    if (customerId) {
      const priceRes = await resolveItemPrice(
        customerId,
        selectedItem.id,
        unit.id,
        priceListId || undefined
      );
      if (priceRes.success && priceRes.pricePaisa) {
        price = priceRes.pricePaisa / 100;
        source = priceRes.source || "PRICE_LIST";
      }
    }

    const updated = [...lines];
    updated[index] = {
      ...updated[index],
      itemId: selectedItem.id,
      sku: selectedItem.code,
      unitId: unit.id,
      unitPrice: price,
      priceSource: source,
      taxRateId: selectedItem.default_tax_rate_id || "",
    };
    recalculateLine(updated, index);
  };

  const handleQtyChange = (index: number, qty: number) => {
    const updated = [...lines];
    updated[index].orderedQty = qty;
    recalculateLine(updated, index);
  };

  const handlePriceChange = (index: number, price: number) => {
    const updated = [...lines];
    updated[index].unitPrice = price;
    recalculateLine(updated, index);
  };

  const handleDiscountChange = (index: number, disc: number) => {
    const updated = [...lines];
    updated[index].discountPercent = disc;
    recalculateLine(updated, index);
  };

  const recalculateLine = (currentLines: OrderLineState[], index: number) => {
    const l = currentLines[index];
    const gross = (l.orderedQty || 0) * (l.unitPrice || 0);
    const discAmount = (gross * (l.discountPercent || 0)) / 100;
    const taxable = Math.max(0, gross - discAmount);
    const taxAmount = (taxable * (l.taxRatePercent || 0)) / 100;
    l.lineTotal = taxable + taxAmount;
    setLines(currentLines);
  };

  // Financial Calculations
  const subtotal = lines.reduce((acc, l) => acc + (l.orderedQty || 0) * (l.unitPrice || 0), 0);
  const totalDiscount = lines.reduce(
    (acc, l) => acc + ((l.orderedQty || 0) * (l.unitPrice || 0) * (l.discountPercent || 0)) / 100,
    0
  );
  const taxableSubtotal = Math.max(0, subtotal - totalDiscount);
  const totalTax = lines.reduce((acc, l) => {
    const gross = (l.orderedQty || 0) * (l.unitPrice || 0);
    const disc = (gross * (l.discountPercent || 0)) / 100;
    const taxable = Math.max(0, gross - disc);
    return acc + (taxable * (l.taxRatePercent || 0)) / 100;
  }, 0);
  const orderTotal = taxableSubtotal + totalTax;

  const orderTotalPaisa = Math.round(orderTotal * 100);
  const availableCreditPaisa = creditInfo?.availableCreditPaisa || 0;
  const isCreditExceeded = creditInfo && orderTotalPaisa > availableCreditPaisa;
  const isBenchmarkExceeded = orderTotal > 7875;
  const hasHighDiscount = lines.some((l) => l.discountPercent > 5);

  const approvalRequired = isCreditExceeded || isBenchmarkExceeded || hasHighDiscount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!customerId) {
      setFormError("Please select an approved customer.");
      return;
    }
    if (!branchId) {
      setFormError("Please select a manufacturing / sales branch.");
      return;
    }
    if (!deliveryAddressId) {
      setFormError("Please select or add a delivery address for the customer.");
      return;
    }
    if (lines.length === 0) {
      setFormError("Please add at least one line item to book an order.");
      return;
    }

    setSubmitting(true);

    const payload = {
      branchId,
      customerId,
      deliveryAddressId,
      orderDate,
      requestedDeliveryDate,
      paymentTermsDays,
      priceListId: priceListId || undefined,
      notes,
      submitForApproval: true,
      lines: lines.map((l) => ({
        itemId: l.itemId,
        sku: l.sku,
        orderedQty: Number(l.orderedQty),
        unitId: l.unitId,
        conversionRate: 1.0,
        unitPrice: Number(l.unitPrice),
        discountPercent: Number(l.discountPercent),
        taxRateId: l.taxRateId || undefined,
      })),
    };

    const res = await createSalesOrder(payload);
    setSubmitting(false);

    if (!res.success) {
      setFormError(res.error || "Failed to create sales order.");
    } else {
      router.push(`/sales/orders/${res.orderId}`);
    }
  };

  const selectedCust = customers.find((c) => c.id === customerId);

  return (
    <div className="space-y-6 pb-16 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/sales/orders">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-primary" />
            Field Sales Booking Form
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500">
            Mobile-optimized order booking with live pricing tiers, GST tax estimates, and credit limits.
          </p>
        </div>
      </div>

      {formError && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-600 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer & Branch Card */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" />
              1. Customer &amp; Territory Selection
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="customer" className="text-xs">
                  Select Customer / Retail Shop *
                </Label>
                <select
                  id="customer"
                  className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  required
                >
                  <option value="">-- Choose Approved Customer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.shop_name} ({c.owner_name} - {c.customer_code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="branch" className="text-xs">
                  Fulfilling Branch *
                </Label>
                <select
                  id="branch"
                  className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
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

            {/* Delivery Address & Price List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="address" className="text-xs">
                  Delivery Address *
                </Label>
                <select
                  id="address"
                  className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                  value={deliveryAddressId}
                  onChange={(e) => setDeliveryAddressId(e.target.value)}
                  required
                >
                  <option value="">-- Select Delivery Location --</option>
                  {(selectedCust?.addresses || []).map((addr) => (
                    <option key={addr.id} value={addr.id}>
                      {addr.address_line1}, {addr.city}, {addr.state} - {addr.pincode}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="priceList" className="text-xs">
                  Price List / Contract Slab
                </Label>
                <select
                  id="priceList"
                  className="w-full px-3 py-2 border rounded-md text-sm bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                  value={priceListId}
                  onChange={(e) => setPriceListId(e.target.value)}
                >
                  <option value="">Company Default Price List</option>
                  {priceLists.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Credit Info Strip */}
            {selectedCust && (
              <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg border text-xs grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <div className="text-zinc-500">Credit Limit:</div>
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100 font-mono">
                    ₹{Number(selectedCust.credit_limit || 0).toLocaleString("en-IN")}
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500">Pending Exposure:</div>
                  <div className="font-semibold text-amber-600 font-mono">
                    ₹{((creditInfo?.pendingExposurePaisa || 0) / 100).toLocaleString("en-IN")}
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500">Available Credit:</div>
                  <div
                    className={`font-semibold font-mono ${
                      (creditInfo?.availableCreditPaisa || 0) < 0 ? "text-rose-600" : "text-emerald-600"
                    }`}
                  >
                    ₹{((creditInfo?.availableCreditPaisa || 0) / 100).toLocaleString("en-IN")}
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500">Payment Terms:</div>
                  <div className="font-semibold text-zinc-800 dark:text-zinc-200">
                    {paymentTermsDays} Days Net
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Line Items Card */}
        <Card>
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Tag className="w-4 h-4 text-primary" />
              2. Product Line Items
            </CardTitle>
            <Button type="button" size="sm" variant="outline" onClick={addLine} className="h-8 text-xs">
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Product Line
            </Button>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-3">
            {lines.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 border border-dashed rounded-lg text-xs">
                No products added yet. Click &quot;Add Product Line&quot; to pick packaged snacks.
              </div>
            ) : (
              lines.map((line, idx) => (
                <div
                  key={idx}
                  className="p-3 border rounded-lg bg-zinc-50/50 dark:bg-zinc-900/50 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Line #{idx + 1}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-rose-500 hover:text-rose-600"
                      onClick={() => removeLine(idx)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <div className="sm:col-span-2 space-y-1">
                      <Label className="text-[11px]">Product SKU *</Label>
                      <select
                        className="w-full px-2.5 py-1.5 border rounded text-xs bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                        value={line.itemId}
                        onChange={(e) => handleItemChange(idx, e.target.value)}
                        required
                      >
                        {items.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name} ({it.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px]">Order Qty *</Label>
                      <Input
                        type="number"
                        min="1"
                        className="h-8 text-xs"
                        value={line.orderedQty}
                        onChange={(e) => handleQtyChange(idx, Number(e.target.value))}
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px]">Selling Price (₹)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        className="h-8 text-xs font-mono"
                        value={line.unitPrice}
                        onChange={(e) => handlePriceChange(idx, Number(e.target.value))}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Discount (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        className="h-8 text-xs font-mono"
                        value={line.discountPercent}
                        onChange={(e) => handleDiscountChange(idx, Number(e.target.value))}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px]">Tax Slab (%)</Label>
                      <div className="h-8 px-2 py-1.5 border rounded text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 font-mono flex items-center">
                        {line.taxRatePercent}% GST
                      </div>
                    </div>

                    <div className="col-span-2 flex items-center justify-end gap-2 pt-4">
                      <span className="text-xs text-zinc-500">Line Total:</span>
                      <span className="font-mono font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                        ₹{line.lineTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Order Details & Delivery Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label htmlFor="orderDate" className="text-xs">Order Date</Label>
            <Input
              type="date"
              id="orderDate"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="reqDate" className="text-xs">Requested Delivery Date</Label>
            <Input
              type="date"
              id="reqDate"
              value={requestedDeliveryDate}
              onChange={(e) => setRequestedDeliveryDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="notes" className="text-xs">Salesman / Delivery Remarks</Label>
            <Input
              id="notes"
              placeholder="e.g., Deliver before 11 AM via Route 4 van."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Financial Summary & Approval Notices */}
        <Card className="border-t-4 border-t-primary">
          <CardContent className="p-4 space-y-4">
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Gross Items Subtotal:</span>
                <span className="font-mono">₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Total Discounts:</span>
                <span className="font-mono text-emerald-600">-₹{totalDiscount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Estimated GST:</span>
                <span className="font-mono">₹{totalTax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 text-base font-bold">
                <span>Final Order Total:</span>
                <span className="font-mono text-primary">₹{orderTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Approval Notice Banners */}
            {approvalRequired && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs space-y-1">
                <div className="font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  Manager Approval Required Before Warehouse Allocation
                </div>
                <ul className="list-disc list-inside text-amber-700 dark:text-amber-300 text-[11px] space-y-0.5">
                  {isCreditExceeded && (
                    <li>Order value exceeds customer available credit limit.</li>
                  )}
                  {isBenchmarkExceeded && (
                    <li>Order total exceeds standard value threshold (&gt; ₹7,875).</li>
                  )}
                  {hasHighDiscount && (
                    <li>One or more items carry discount exceeding salesman limit (&gt; 5%).</li>
                  )}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Link href="/sales/orders">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Booking Order...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Submit Sales Order
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
