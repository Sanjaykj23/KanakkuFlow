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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  UsersRound,
  Store,
  Plus,
  Search,
  Eye,
  MapPin,
  CreditCard,
  Phone,
  FileText,
  Loader2,
} from "lucide-react";
import { getCustomers } from "@/modules/customers/actions";
import { getCompanyBranches } from "@/modules/users/actions";
import { Customer } from "@/types/database";

export default function CustomersDirectoryPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [branches, setBranches] = useState<{ id: string; code: string; name: string }[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Detail Modal
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [custRes, branchList] = await Promise.all([
      getCustomers(searchQuery || undefined, selectedBranch || undefined),
      getCompanyBranches(),
    ]);

    if (custRes.success && custRes.customers) {
      setCustomers(custRes.customers);
    }
    setBranches(branchList);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [selectedBranch]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const openDetailModal = (cust: Customer) => {
    setSelectedCustomer(cust);
    setIsDetailOpen(true);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <UsersRound className="w-6 h-6 text-primary" />
            Customer Master Directory
          </h1>
          <p className="text-sm text-zinc-500">
            Approved retail shops, supermarkets, and distributors with credit terms.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/customers/registrations">
            <Button variant="outline" size="sm">
              Registration Queue
            </Button>
          </Link>
          <Link href="/customers/register">
            <Button size="sm" className="flex items-center gap-1.5">
              <Plus className="w-4 h-4" />
              New Shop Registration
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <form
            onSubmit={handleSearchSubmit}
            className="flex flex-col md:flex-row gap-4 justify-between"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
              <Input
                placeholder="Search by customer code, shop name, or mobile..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <select
                className="px-3 py-2 border rounded-md bg-white dark:bg-zinc-950 text-sm border-zinc-200 dark:border-zinc-800"
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
              >
                <option value="">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <Button type="submit" variant="secondary" size="sm">
                Filter
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">
            Active Accounts ({customers.length})
          </CardTitle>
          <CardDescription>
            All verified customer profiles enrolled into KanakkuFlow ERP.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer Code</TableHead>
                  <TableHead>Shop & Owner</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Credit Limit</TableHead>
                  <TableHead>Payment Terms</TableHead>
                  <TableHead>Assigned Salesman</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-zinc-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                      Loading customers...
                    </TableCell>
                  </TableRow>
                ) : customers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-zinc-500">
                      No customer records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  customers.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs font-bold text-primary">
                        {c.customer_code}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                          {c.shop_name}
                        </div>
                        <div className="text-xs text-zinc-500">{c.owner_name}</div>
                      </TableCell>
                      <TableCell className="text-xs text-zinc-600 dark:text-zinc-400">
                        <div>{c.mobile_number}</div>
                        {c.gstin && (
                          <div className="text-[11px] font-mono text-zinc-500">
                            GST: {c.gstin}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-600 dark:text-zinc-400">
                        {c.branch?.name || "Main Branch"}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                        ₹{Number(c.credit_limit).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-600 dark:text-zinc-400">
                        {c.payment_terms_days} Days
                      </TableCell>
                      <TableCell className="text-xs text-zinc-500">
                        {c.assigned_salesman_profile?.full_name || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => openDetailModal(c)}
                        >
                          <Eye className="w-4 h-4 text-zinc-500" />
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

      {/* Customer Detail Dialog */}
      {selectedCustomer && (
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Store className="w-5 h-5 text-primary" />
                {selectedCustomer.shop_name}
              </DialogTitle>
              <DialogDescription>
                Customer Code: <span className="font-mono font-bold text-primary">{selectedCustomer.customer_code}</span> | Branch: {selectedCustomer.branch?.name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              {/* Profile Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-zinc-50 dark:bg-zinc-900 p-3 rounded border">
                <div>
                  <span className="text-zinc-500">Owner Name:</span>{" "}
                  <span className="font-semibold">{selectedCustomer.owner_name}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Mobile Number:</span>{" "}
                  <span className="font-semibold">{selectedCustomer.mobile_number}</span>
                </div>
                <div>
                  <span className="text-zinc-500">GSTIN:</span>{" "}
                  <span className="font-mono">{selectedCustomer.gstin || "Unregistered"}</span>
                </div>
                <div>
                  <span className="text-zinc-500">PAN:</span>{" "}
                  <span className="font-mono">{selectedCustomer.pan || "—"}</span>
                </div>
                <div>
                  <span className="text-zinc-500">FSSAI License:</span>{" "}
                  <span className="font-mono">{selectedCustomer.fssai_number || "—"}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Account Type:</span>{" "}
                  <span className="font-semibold">{selectedCustomer.customer_type}</span>
                </div>
              </div>

              {/* Credit & Terms */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded border space-y-1">
                <div className="text-xs font-semibold flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                  <CreditCard className="w-4 h-4 text-primary" />
                  Credit & Commercial Terms
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div>
                    <span className="text-zinc-500">Approved Credit Limit:</span>{" "}
                    <span className="font-bold text-emerald-600">
                      ₹{Number(selectedCustomer.credit_limit).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Payment Due Window:</span>{" "}
                    <span className="font-bold">{selectedCustomer.payment_terms_days} Days</span>
                  </div>
                </div>
              </div>

              {/* Addresses */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded border space-y-2">
                <div className="text-xs font-semibold flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                  <MapPin className="w-4 h-4 text-primary" />
                  Delivery & Billing Address
                </div>
                {selectedCustomer.addresses && selectedCustomer.addresses.length > 0 ? (
                  selectedCustomer.addresses.map((addr) => (
                    <div key={addr.id} className="text-xs text-zinc-600 dark:text-zinc-400">
                      <div>{addr.address_line1}</div>
                      {addr.address_line2 && <div>{addr.address_line2}</div>}
                      <div>
                        {addr.city}, {addr.state} - {addr.pincode}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-zinc-400">No registered address record.</div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
