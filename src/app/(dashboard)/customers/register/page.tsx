"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import {
  Store,
  MapPin,
  Phone,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Navigation,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import {
  submitCustomerRegistration,
  checkCustomerDuplicates,
  DuplicateCheckResult,
} from "@/modules/customers/actions";
import { getCompanyBranches } from "@/modules/users/actions";
import Link from "next/link";

export default function CustomerRegisterPage() {
  const router = useRouter();

  // Form State
  const [formData, setFormData] = useState({
    shopName: "",
    ownerName: "",
    mobileNumber: "",
    alternateNumber: "",
    email: "",
    gstin: "",
    pan: "",
    fssaiNumber: "",
    branchId: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "Tamil Nadu",
    pincode: "",
    latitude: null as number | null,
    longitude: null as number | null,
    shopPhotoUrl: "",
  });

  const [branches, setBranches] = useState<{ id: string; code: string; name: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ requestNumber: string } | null>(null);

  // Live Duplicate Check State
  const [duplicateResult, setDuplicateResult] = useState<DuplicateCheckResult | null>(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);

  useEffect(() => {
    async function loadBranches() {
      const bList = await getCompanyBranches();
      setBranches(bList);
      if (bList.length > 0) {
        setFormData((prev) => ({ ...prev, branchId: bList[0].id }));
      }
    }
    loadBranches();
  }, []);

  // Trigger duplicate check when mobile or gstin changes
  const runDuplicateCheck = async (mobile: string, gstin?: string) => {
    const cleanMobile = mobile.replace(/\D/g, "").slice(-10);
    if (cleanMobile.length === 10) {
      setIsCheckingDuplicate(true);
      const res = await checkCustomerDuplicates(cleanMobile, gstin);
      setIsCheckingDuplicate(false);
      if (res.success && res.data) {
        setDuplicateResult(res.data);
      } else {
        setDuplicateResult(null);
      }
    } else {
      setDuplicateResult(null);
    }
  };

  const handleMobileBlur = () => {
    runDuplicateCheck(formData.mobileNumber, formData.gstin);
  };

  const handleGstinBlur = () => {
    runDuplicateCheck(formData.mobileNumber, formData.gstin);
  };

  const captureGPSLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData((prev) => ({
          ...prev,
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
        }));
        setIsGettingLocation(false);
      },
      (err) => {
        alert("Failed to retrieve location: " + err.message);
        setIsGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const res = await submitCustomerRegistration({
        shopName: formData.shopName,
        ownerName: formData.ownerName,
        mobileNumber: formData.mobileNumber,
        alternateNumber: formData.alternateNumber || undefined,
        email: formData.email || undefined,
        gstin: formData.gstin || undefined,
        pan: formData.pan || undefined,
        fssaiNumber: formData.fssaiNumber || undefined,
        branchId: formData.branchId,
        addressLine1: formData.addressLine1,
        addressLine2: formData.addressLine2 || undefined,
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode,
        latitude: formData.latitude,
        longitude: formData.longitude,
        shopPhotoUrl: formData.shopPhotoUrl || undefined,
      });

      if (!res.success) {
        setErrorMessage(res.error || "Failed to submit registration.");
      } else {
        setSuccessInfo({ requestNumber: res.requestNumber || "Submitted" });
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (successInfo) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4">
        <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-md text-center p-8">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <CardTitle className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
            Registration Submitted Successfully!
          </CardTitle>
          <CardDescription className="text-base text-zinc-600 dark:text-zinc-400 mb-6">
            Reference Request Number:{" "}
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-lg">
              {successInfo.requestNumber}
            </span>
            <br />
            The shop is now in the verification queue. Admin will review credit limits and assign the customer code.
          </CardDescription>
          <div className="flex justify-center gap-4">
            <Button
              variant="outline"
              onClick={() => {
                setSuccessInfo(null);
                setFormData({
                  shopName: "",
                  ownerName: "",
                  mobileNumber: "",
                  alternateNumber: "",
                  email: "",
                  gstin: "",
                  pan: "",
                  fssaiNumber: "",
                  branchId: branches[0]?.id || "",
                  addressLine1: "",
                  addressLine2: "",
                  city: "",
                  state: "Tamil Nadu",
                  pincode: "",
                  latitude: null,
                  longitude: null,
                  shopPhotoUrl: "",
                });
                setDuplicateResult(null);
              }}
            >
              Register Another Shop
            </Button>
            <Link href="/customers/registrations">
              <Button>View Registrations Queue</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/customers/registrations">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Store className="w-6 h-6 text-primary" />
              Field Sales Shop Registration
            </h1>
            <p className="text-sm text-zinc-500">
              Onboard a new retail shop, grocery store, or distributor.
            </p>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Duplicate Warning Banner */}
      {duplicateResult && duplicateResult.has_duplicate && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/40 rounded-lg text-sm text-amber-800 dark:text-amber-300 space-y-2">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            Duplicate Warning: Existing Record Detected
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-400">
            A customer or pending registration with this mobile number or GSTIN already exists. You can still submit; however, approval will require administrative override.
          </p>
          {duplicateResult.existing_customers.length > 0 && (
            <div className="text-xs bg-white/40 dark:bg-zinc-900/40 p-2 rounded border border-amber-500/20">
              <strong>Approved Customers:</strong>{" "}
              {duplicateResult.existing_customers
                .map((c) => `${c.name} (${c.code}) - ${c.mobile}`)
                .join("; ")}
            </div>
          )}
          {duplicateResult.pending_requests.length > 0 && (
            <div className="text-xs bg-white/40 dark:bg-zinc-900/40 p-2 rounded border border-amber-500/20">
              <strong>Pending Requests:</strong>{" "}
              {duplicateResult.pending_requests
                .map((r) => `${r.name} (${r.request_number})`)
                .join("; ")}
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Shop & Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Store className="w-5 h-5 text-zinc-500" />
              Shop & Owner Profile
            </CardTitle>
            <CardDescription>
              Basic identity details of the retail establishment.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="shopName">Shop / Trade Name *</Label>
                <Input
                  id="shopName"
                  placeholder="e.g., Sri Krishna Sweets & Snacks"
                  required
                  value={formData.shopName}
                  onChange={(e) =>
                    setFormData({ ...formData, shopName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ownerName">Owner / Proprietor Name *</Label>
                <Input
                  id="ownerName"
                  placeholder="e.g., K. Sundaram"
                  required
                  value={formData.ownerName}
                  onChange={(e) =>
                    setFormData({ ...formData, ownerName: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor="mobileNumber">Primary Mobile (10 digits) *</Label>
                  {isCheckingDuplicate && (
                    <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Checking...
                    </span>
                  )}
                </div>
                <Input
                  id="mobileNumber"
                  type="tel"
                  placeholder="9876543210"
                  maxLength={10}
                  required
                  value={formData.mobileNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, mobileNumber: e.target.value })
                  }
                  onBlur={handleMobileBlur}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="alternateNumber">Alternate Mobile</Label>
                <Input
                  id="alternateNumber"
                  type="tel"
                  placeholder="Optional"
                  maxLength={10}
                  value={formData.alternateNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, alternateNumber: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="shop@example.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="branchId">Operating Sales Branch *</Label>
              <select
                id="branchId"
                className="w-full px-3 py-2 border rounded-md bg-white dark:bg-zinc-950 text-sm border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-primary"
                value={formData.branchId}
                onChange={(e) =>
                  setFormData({ ...formData, branchId: e.target.value })
                }
                required
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Statutory & Tax Identifiers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-zinc-500" />
              Tax & Regulatory Registrations
            </CardTitle>
            <CardDescription>
              GSTIN, PAN, and food safety registration numbers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="gstin">GSTIN (15 characters)</Label>
                <Input
                  id="gstin"
                  placeholder="33AAAAA0000A1Z5"
                  maxLength={15}
                  value={formData.gstin}
                  onChange={(e) =>
                    setFormData({ ...formData, gstin: e.target.value.toUpperCase() })
                  }
                  onBlur={handleGstinBlur}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pan">PAN (10 characters)</Label>
                <Input
                  id="pan"
                  placeholder="ABCDE1234F"
                  maxLength={10}
                  value={formData.pan}
                  onChange={(e) =>
                    setFormData({ ...formData, pan: e.target.value.toUpperCase() })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fssaiNumber">FSSAI License (14 digits)</Label>
                <Input
                  id="fssaiNumber"
                  placeholder="14 digits"
                  maxLength={14}
                  value={formData.fssaiNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, fssaiNumber: e.target.value })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Physical Address & GPS Coordinates */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-zinc-500" />
                  Address & Field Coordinates
                </CardTitle>
                <CardDescription>
                  Delivery location and field sales geotagging.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex items-center gap-1.5"
                onClick={captureGPSLocation}
                disabled={isGettingLocation}
              >
                {isGettingLocation ? (
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                ) : (
                  <Navigation className="w-4 h-4 text-primary" />
                )}
                {formData.latitude ? "Update GPS" : "Capture Current GPS"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="addressLine1">Address Line 1 (Door No, Street) *</Label>
              <Input
                id="addressLine1"
                placeholder="No. 12, South Veli Street"
                required
                value={formData.addressLine1}
                onChange={(e) =>
                  setFormData({ ...formData, addressLine1: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="addressLine2">Address Line 2 (Landmark, Area)</Label>
              <Input
                id="addressLine2"
                placeholder="Near Meenakshi Amman Temple"
                value={formData.addressLine2}
                onChange={(e) =>
                  setFormData({ ...formData, addressLine2: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="city">City / Town *</Label>
                <Input
                  id="city"
                  placeholder="Madurai"
                  required
                  value={formData.city}
                  onChange={(e) =>
                    setFormData({ ...formData, city: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="state">State *</Label>
                <Input
                  id="state"
                  required
                  value={formData.state}
                  onChange={(e) =>
                    setFormData({ ...formData, state: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pincode">Pincode (6 digits) *</Label>
                <Input
                  id="pincode"
                  placeholder="625001"
                  maxLength={6}
                  required
                  value={formData.pincode}
                  onChange={(e) =>
                    setFormData({ ...formData, pincode: e.target.value })
                  }
                />
              </div>
            </div>

            {formData.latitude && formData.longitude && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-md text-xs text-emerald-700 dark:text-emerald-400 flex items-center justify-between">
                <span>
                  <strong>Geotagged Coordinates:</strong> Lat {formData.latitude}, Long {formData.longitude}
                </span>
                <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded font-mono">
                  GPS Active
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex items-center justify-end gap-4">
          <Link href="/customers/registrations">
            <Button variant="outline" type="button">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={isSubmitting} className="min-w-[160px]">
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Registration"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
