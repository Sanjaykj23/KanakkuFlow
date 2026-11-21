"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UserRole, MembershipStatus } from "@/types/database";
import {
  UserPlus,
  Search,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  RefreshCw,
} from "lucide-react";
import {
  getEmployees,
  getCompanyBranches,
  createEmployee,
  toggleUserStatus,
  EmployeeListItem,
} from "@/modules/users/actions";

export default function UserManagementPage() {
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [branches, setBranches] = useState<{ id: string; code: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("ALL");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // New Employee Form
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [role, setRole] = useState<UserRole>("SALESMAN");
  const [selectedBranchId, setSelectedBranchId] = useState("");

  // Provisioning Success Modal
  const [createdCredentials, setCreatedCredentials] = useState<{
    employeeCode: string;
    tempPassword: string;
    fullName: string;
    email: string;
  } | null>(null);

  const fetchEmployeesData = async () => {
    setIsLoading(true);
    const [empRes, branchRes] = await Promise.all([
      getEmployees(),
      getCompanyBranches(),
    ]);

    if (empRes.success && empRes.employees) {
      setEmployees(empRes.employees);
    }
    setBranches(branchRes);
    if (branchRes.length > 0 && !selectedBranchId) {
      setSelectedBranchId(branchRes[0].id);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchEmployeesData();
  }, []);

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError("");

    try {
      const res = await createEmployee({
        fullName,
        email,
        mobile,
        role,
        branchIds: selectedBranchId ? [selectedBranchId] : [],
      });

      if (!res.success) {
        setFormError(res.error || "Failed to create employee.");
        setIsSubmitting(false);
        return;
      }

      setCreatedCredentials({
        employeeCode: res.employeeCode || "",
        tempPassword: res.tempPassword || "",
        fullName,
        email,
      });

      setIsDialogOpen(false);
      setFullName("");
      setEmail("");
      setMobile("");
      fetchEmployeesData();
    } catch (err: any) {
      setFormError(err.message || "An error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (
    membershipId: string,
    currentStatus: MembershipStatus
  ) => {
    const newStatus: MembershipStatus =
      currentStatus === "ACTIVE" ? "DEACTIVATED" : "ACTIVE";
    const res = await toggleUserStatus(membershipId, newStatus);
    if (res.success) {
      fetchEmployeesData();
    } else {
      alert(res.error || "Failed to update account status.");
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole =
      selectedRoleFilter === "ALL" || emp.role === selectedRoleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      {/* Header & Action Bar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            User & Employee Management
          </h1>
          <p className="text-xs text-slate-500">
            Live Supabase database management. Hierarchical RBAC, branch isolation, and immutable audit logs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchEmployeesData}
            disabled={isLoading}
            className="text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          {/* Add Employee Dialog */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-slate-900 text-white hover:bg-slate-800 text-xs">
                <UserPlus className="w-4 h-4 mr-1.5" />
                Add Employee
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add Team Member</DialogTitle>
                <DialogDescription>
                  Creates verified account in Supabase Auth & registers company membership.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleCreateEmployee} className="space-y-4 py-2">
                {formError && (
                  <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g. Ramesh Kumar"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="ramesh@muruganfoods.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="mobile">Mobile Number</Label>
                  <Input
                    id="mobile"
                    placeholder="+91 98401 23456"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="role">Role</Label>
                    <select
                      id="role"
                      className="w-full h-9 px-3 py-1 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900"
                      value={role}
                      onChange={(e) => setRole(e.target.value as UserRole)}
                    >
                      <option value="SUPERVISOR">SUPERVISOR</option>
                      <option value="SALESMAN">SALESMAN</option>
                      <option value="ACCOUNTANT">ACCOUNTANT</option>
                      <option value="PRODUCTION">PRODUCTION</option>
                      <option value="WAREHOUSE">WAREHOUSE</option>
                      <option value="ADMIN">ADMIN (Owner Only)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="branch">Branch Access</Label>
                    <select
                      id="branch"
                      className="w-full h-9 px-3 py-1 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900"
                      value={selectedBranchId}
                      onChange={(e) => setSelectedBranchId(e.target.value)}
                    >
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-slate-900 text-white"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        Saving to Supabase...
                      </>
                    ) : (
                      "Create Employee"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Success Modal Showing One-Time Temporary Password */}
      {createdCredentials && (
        <Dialog
          open={!!createdCredentials}
          onOpenChange={() => setCreatedCredentials(null)}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-2">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <DialogTitle className="text-center">
                Employee Created Successfully
              </DialogTitle>
              <DialogDescription className="text-center text-xs">
                Account registered in Supabase. Provide these initial credentials to the employee.
              </DialogDescription>
            </DialogHeader>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Employee Code:</span>
                <span className="font-mono font-bold text-slate-900">
                  {createdCredentials.employeeCode}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Employee Name:</span>
                <span className="font-semibold text-slate-900">
                  {createdCredentials.fullName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Login Email:</span>
                <span className="font-mono text-slate-900">
                  {createdCredentials.email}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                <span className="text-slate-500 font-medium">One-Time Password:</span>
                <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 select-all">
                  {createdCredentials.tempPassword}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 text-center">
              ⚠️ The employee will be required to change this password upon their first login.
            </p>

            <DialogFooter>
              <Button
                className="w-full bg-slate-900 text-white"
                onClick={() => setCreatedCredentials(null)}
              >
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Filter Bar */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by name, code, email..."
                className="pl-9 text-xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto text-xs">
              <span className="text-slate-500 font-medium shrink-0">Role:</span>
              {[
                "ALL",
                "OWNER",
                "ADMIN",
                "SUPERVISOR",
                "SALESMAN",
                "ACCOUNTANT",
                "PRODUCTION",
                "WAREHOUSE",
              ].map((r) => (
                <button
                  key={r}
                  onClick={() => setSelectedRoleFilter(r)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    selectedRoleFilter === r
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Live Employee Table */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Emp Code</TableHead>
                <TableHead className="text-xs">Employee Name</TableHead>
                <TableHead className="text-xs">Role</TableHead>
                <TableHead className="text-xs">Mobile Number</TableHead>
                <TableHead className="text-xs">Assigned Branch(es)</TableHead>
                <TableHead className="text-xs">Account Status</TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    <Loader2 className="w-5 h-5 mx-auto animate-spin text-slate-400" />
                    <span className="text-xs text-slate-500 mt-2 block">
                      Loading users from Supabase...
                    </span>
                  </TableCell>
                </TableRow>
              ) : filteredEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-xs text-slate-500">
                    No employees found matching filter.
                  </TableCell>
                </TableRow>
              ) : (
                filteredEmployees.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell className="font-mono text-xs font-semibold text-slate-800">
                      {emp.employeeCode}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-semibold text-slate-900">
                        {emp.fullName}
                      </div>
                      <div className="text-[11px] text-slate-400">{emp.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={emp.role.toLowerCase() as any}>
                        {emp.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-slate-600">
                      {emp.mobile}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {emp.branches}
                    </TableCell>
                    <TableCell>
                      {emp.status === "ACTIVE" ? (
                        <Badge variant="success">ACTIVE</Badge>
                      ) : (
                        <Badge variant="danger">DEACTIVATED</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {emp.role !== "OWNER" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleStatus(emp.id, emp.status)}
                          className={`text-xs ${
                            emp.status === "ACTIVE"
                              ? "text-rose-600 hover:bg-rose-50"
                              : "text-emerald-600 hover:bg-emerald-50"
                          }`}
                        >
                          {emp.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
