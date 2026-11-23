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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Store,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  FileText,
  RotateCcw,
  Ban,
  Loader2,
  ExternalLink,
} from "lucide-react";
import {
  getCustomerRegistrations,
  approveRegistration,
  rejectRegistration,
  resubmitRegistration,
  cancelRegistration,
  checkCustomerDuplicates,
  DuplicateCheckResult,
} from "@/modules/customers/actions";
import { CustomerRegistrationRequest, RegistrationStatus } from "@/types/database";

export default function CustomerRegistrationsPage() {
  const [registrations, setRegistrations] = useState<CustomerRegistrationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"ALL" | RegistrationStatus>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Review Dialog State (for Approval)
  const [selectedReq, setSelectedReq] = useState<CustomerRegistrationRequest | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [creditLimit, setCreditLimit] = useState(0);
  const [paymentTermsDays, setPaymentTermsDays] = useState(7);
  const [overrideReason, setOverrideReason] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateCheckResult | null>(null);

  // Rejection Dialog State
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);

  // Resubmit Dialog State
  const [isResubmitOpen, setIsResubmitOpen] = useState(false);
  const [resubmitData, setResubmitData] = useState<any>({});
  const [isResubmitting, setIsResubmitting] = useState(false);

  const fetchRegistrations = async () => {
    setLoading(true);
    const res = await getCustomerRegistrations(
      activeTab === "ALL" ? undefined : (activeTab as RegistrationStatus)
    );
    if (res.success && res.registrations) {
      setRegistrations(res.registrations);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRegistrations();
  }, [activeTab]);

  const openReviewModal = async (req: CustomerRegistrationRequest) => {
    setSelectedReq(req);
    setCreditLimit(0);
    setPaymentTermsDays(7);
    setOverrideReason("");
    setReviewError(null);
    setIsReviewOpen(true);

    // Run duplicate check on the fly for reviewer
    const dupRes = await checkCustomerDuplicates(req.mobile_number, req.gstin || undefined, req.id);
    if (dupRes.success && dupRes.data?.has_duplicate) {
      setDuplicateWarning(dupRes.data);
    } else {
      setDuplicateWarning(null);
    }
  };

  const handleApprove = async () => {
    if (!selectedReq) return;
    setReviewError(null);
    setIsApproving(true);

    const res = await approveRegistration({
      requestId: selectedReq.id,
      creditLimit: Number(creditLimit),
      paymentTermsDays: Number(paymentTermsDays),
      duplicateOverrideReason: overrideReason || undefined,
    });

    setIsApproving(false);
    if (!res.success) {
      setReviewError(res.error || "Approval failed.");
    } else {
      setIsReviewOpen(false);
      fetchRegistrations();
    }
  };

  const handleReject = async () => {
    if (!selectedReq || !rejectionReason.trim()) return;
    setIsRejecting(true);

    const res = await rejectRegistration({
      requestId: selectedReq.id,
      rejectionReason: rejectionReason.trim(),
    });

    setIsRejecting(false);
    if (!res.success) {
      alert("Rejection failed: " + res.error);
    } else {
      setIsRejectOpen(false);
      setIsReviewOpen(false);
      setRejectionReason("");
      fetchRegistrations();
    }
  };

  const openResubmitModal = (req: CustomerRegistrationRequest) => {
    setSelectedReq(req);
    setResubmitData({
      requestId: req.id,
      shopName: req.shop_name,
      ownerName: req.owner_name,
      mobileNumber: req.mobile_number,
      alternateNumber: req.alternate_number || "",
      email: req.email || "",
      gstin: req.gstin || "",
      pan: req.pan || "",
      fssaiNumber: req.fssai_number || "",
      branchId: req.branch_id,
      addressLine1: req.address_line1,
      addressLine2: req.address_line2 || "",
      city: req.city,
      state: req.state,
      pincode: req.pincode,
    });
    setIsResubmitOpen(true);
  };

  const handleResubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsResubmitting(true);
    const res = await resubmitRegistration(resubmitData);
    setIsResubmitting(false);

    if (!res.success) {
      alert("Resubmission failed: " + res.error);
    } else {
      setIsResubmitOpen(false);
      fetchRegistrations();
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this registration request?")) return;
    const res = await cancelRegistration(id);
    if (!res.success) {
      alert("Cancellation failed: " + res.error);
    } else {
      fetchRegistrations();
    }
  };

  const filteredRegistrations = registrations.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.request_number.toLowerCase().includes(q) ||
      r.shop_name.toLowerCase().includes(q) ||
      r.owner_name.toLowerCase().includes(q) ||
      r.mobile_number.includes(q)
    );
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Store className="w-6 h-6 text-primary" />
            Customer Registration Queue
          </h1>
          <p className="text-sm text-zinc-500">
            Field sales shop registration verification, approval, and audit workflow.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/customers">
            <Button variant="outline" size="sm">
              Customer Directory
            </Button>
          </Link>
          <Link href="/customers/register">
            <Button size="sm" className="flex items-center gap-1.5">
              <Plus className="w-4 h-4" />
              New Registration
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs & Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              {(["ALL", "PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const).map(
                (tab) => (
                  <Button
                    key={tab}
                    size="sm"
                    variant={activeTab === tab ? "default" : "outline"}
                    onClick={() => setActiveTab(tab)}
                    className="text-xs"
                  >
                    {tab}
                  </Button>
                )
              )}
            </div>
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
              <Input
                placeholder="Search shop, owner, mobile..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">
            Registration Submissions ({filteredRegistrations.length})
          </CardTitle>
          <CardDescription>
            Click &quot;Review&quot; to inspect shop verification details, credit limits, and assign customer code.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request #</TableHead>
                  <TableHead>Shop & Owner</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-zinc-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                      Loading registrations...
                    </TableCell>
                  </TableRow>
                ) : filteredRegistrations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-zinc-500">
                      No registrations found for this filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRegistrations.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell className="font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        {req.request_number}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                          {req.shop_name}
                        </div>
                        <div className="text-xs text-zinc-500">{req.owner_name}</div>
                      </TableCell>
                      <TableCell className="text-xs text-zinc-600 dark:text-zinc-400">
                        <div>{req.mobile_number}</div>
                        {req.gstin && (
                          <div className="text-[11px] font-mono text-zinc-500">
                            GST: {req.gstin}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-600 dark:text-zinc-400">
                        {req.branch?.name || "Main Branch"}
                      </TableCell>
                      <TableCell>
                        {req.status === "PENDING" && (
                          <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-500/10">
                            <Clock className="w-3 h-3 mr-1" />
                            Pending Review
                          </Badge>
                        )}
                        {req.status === "APPROVED" && (
                          <Badge variant="outline" className="border-emerald-500 text-emerald-600 bg-emerald-500/10">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Approved
                          </Badge>
                        )}
                        {req.status === "REJECTED" && (
                          <Badge variant="outline" className="border-red-500 text-red-600 bg-red-500/10">
                            <XCircle className="w-3 h-3 mr-1" />
                            Rejected
                          </Badge>
                        )}
                        {req.status === "CANCELLED" && (
                          <Badge variant="secondary" className="text-zinc-500">
                            <Ban className="w-3 h-3 mr-1" />
                            Cancelled
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-500">
                        <div>{req.submitted_by_profile?.full_name || "Salesman"}</div>
                        <div className="text-[10px]">
                          {new Date(req.created_at).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {req.status === "PENDING" && (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => openReviewModal(req)}
                            >
                              Review
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-500 hover:text-red-600 text-xs"
                              onClick={() => handleCancel(req.id)}
                            >
                              Cancel
                            </Button>
                          </>
                        )}
                        {req.status === "REJECTED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs flex items-center gap-1"
                            onClick={() => openResubmitModal(req)}
                          >
                            <RotateCcw className="w-3 h-3" />
                            Resubmit
                          </Button>
                        )}
                        {req.status === "APPROVED" && (
                          <span className="text-xs text-emerald-600 font-mono">
                            Linked to Master
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Review & Approval Modal */}
      {selectedReq && (
        <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Store className="w-5 h-5 text-primary" />
                Review Registration: {selectedReq.shop_name}
              </DialogTitle>
              <DialogDescription>
                Reference: <span className="font-mono">{selectedReq.request_number}</span> | Branch: {selectedReq.branch?.name}
              </DialogDescription>
            </DialogHeader>

            {reviewError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-600 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{reviewError}</span>
              </div>
            )}

            {/* Duplicate Detected Warning */}
            {duplicateWarning && duplicateWarning.has_duplicate && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/40 rounded text-xs text-amber-800 dark:text-amber-300 space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Potential Duplicate Customer Detected
                </div>
                <p>
                  Another customer exists with identical mobile or GSTIN. An explicit audit override reason is strictly required before approval can proceed.
                </p>
              </div>
            )}

            {/* Shop Summary Details */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-zinc-50 dark:bg-zinc-900 p-3 rounded border">
              <div>
                <span className="text-zinc-500">Owner Name:</span>{" "}
                <span className="font-semibold">{selectedReq.owner_name}</span>
              </div>
              <div>
                <span className="text-zinc-500">Mobile:</span>{" "}
                <span className="font-semibold">{selectedReq.mobile_number}</span>
              </div>
              <div>
                <span className="text-zinc-500">GSTIN:</span>{" "}
                <span className="font-mono">{selectedReq.gstin || "Unregistered"}</span>
              </div>
              <div>
                <span className="text-zinc-500">PAN:</span>{" "}
                <span className="font-mono">{selectedReq.pan || "—"}</span>
              </div>
              <div className="col-span-2">
                <span className="text-zinc-500">Address:</span>{" "}
                <span>
                  {selectedReq.address_line1}, {selectedReq.city}, {selectedReq.state} - {selectedReq.pincode}
                </span>
              </div>
              {selectedReq.latitude && (
                <div className="col-span-2 text-emerald-600 font-mono">
                  Coordinates: Lat {selectedReq.latitude}, Long {selectedReq.longitude}
                </div>
              )}
            </div>

            {/* Credit & Terms Configuration */}
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="creditLimit">Assigned Credit Limit (₹)</Label>
                  <Input
                    id="creditLimit"
                    type="number"
                    min={0}
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(Number(e.target.value))}
                  />
                  <span className="text-[10px] text-zinc-500">
                    Maximum credit allowed for sales orders.
                  </span>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="paymentTerms">Payment Terms (Days)</Label>
                  <Input
                    id="paymentTerms"
                    type="number"
                    min={0}
                    value={paymentTermsDays}
                    onChange={(e) => setPaymentTermsDays(Number(e.target.value))}
                  />
                  <span className="text-[10px] text-zinc-500">
                    Due date window (e.g., 7 days for Murukku retail).
                  </span>
                </div>
              </div>

              {/* Duplicate Override Reason (Mandatory if duplicate exists) */}
              {duplicateWarning?.has_duplicate && (
                <div className="space-y-1.5 pt-2">
                  <Label htmlFor="overrideReason" className="text-amber-600 dark:text-amber-400 font-semibold">
                    Duplicate Audit Override Reason *
                  </Label>
                  <Input
                    id="overrideReason"
                    placeholder="e.g., Verified separate branch of same proprietor under distinct trade name"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    required
                  />
                </div>
              )}
            </div>

            <DialogFooter className="flex justify-between items-center sm:justify-between pt-4">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsRejectOpen(true)}
              >
                Reject Request
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsReviewOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleApprove}
                  disabled={isApproving}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isApproving ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                  )}
                  Approve & Create Customer
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Reject Reason Dialog */}
      <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <XCircle className="w-5 h-5" />
              Reject Shop Registration
            </DialogTitle>
            <DialogDescription>
              Provide an actionable reason explaining why this shop cannot be onboarded. The salesman will be notified to review and resubmit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="rejectionReason">Reason for Rejection *</Label>
            <Input
              id="rejectionReason"
              placeholder="e.g., Incomplete address, GST certificate unverified"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectOpen(false)}>
              Back
            </Button>
            <Button
              variant="destructive"
              disabled={isRejecting || !rejectionReason.trim()}
              onClick={handleReject}
            >
              {isRejecting ? "Rejecting..." : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resubmit Dialog */}
      {selectedReq && (
        <Dialog open={isResubmitOpen} onOpenChange={setIsResubmitOpen}>
          <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-primary" />
                Resubmit Registration: {selectedReq.shop_name}
              </DialogTitle>
              <DialogDescription>
                Previous Rejection Reason:{" "}
                <span className="text-red-500 font-semibold">
                  {selectedReq.rejection_reason || "None specified"}
                </span>
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleResubmit} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Shop Name</Label>
                  <Input
                    value={resubmitData.shopName || ""}
                    onChange={(e) =>
                      setResubmitData({ ...resubmitData, shopName: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Owner Name</Label>
                  <Input
                    value={resubmitData.ownerName || ""}
                    onChange={(e) =>
                      setResubmitData({ ...resubmitData, ownerName: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Mobile Number</Label>
                  <Input
                    value={resubmitData.mobileNumber || ""}
                    onChange={(e) =>
                      setResubmitData({ ...resubmitData, mobileNumber: e.target.value })
                    }
                    maxLength={10}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>GSTIN</Label>
                  <Input
                    value={resubmitData.gstin || ""}
                    onChange={(e) =>
                      setResubmitData({ ...resubmitData, gstin: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Address Line 1</Label>
                <Input
                  value={resubmitData.addressLine1 || ""}
                  onChange={(e) =>
                    setResubmitData({ ...resubmitData, addressLine1: e.target.value })
                  }
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>City</Label>
                  <Input
                    value={resubmitData.city || ""}
                    onChange={(e) =>
                      setResubmitData({ ...resubmitData, city: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>State</Label>
                  <Input
                    value={resubmitData.state || ""}
                    onChange={(e) =>
                      setResubmitData({ ...resubmitData, state: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Pincode</Label>
                  <Input
                    value={resubmitData.pincode || ""}
                    onChange={(e) =>
                      setResubmitData({ ...resubmitData, pincode: e.target.value })
                    }
                    maxLength={6}
                    required
                  />
                </div>
              </div>

              <DialogFooter className="pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsResubmitOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isResubmitting}>
                  {isResubmitting ? "Resubmitting..." : "Resubmit for Review"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
