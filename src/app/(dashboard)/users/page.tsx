"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { UserRole } from "@/types/database";
import { UserPlus, Search, Shield, Building, Mail, Key } from "lucide-react";

interface EmployeeRow {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  mobile: string;
  role: UserRole;
  branches: string;
  status: "ACTIVE" | "PENDING_INVITE" | "DEACTIVATED";
}

const INITIAL_EMPLOYEES: EmployeeRow[] = [
  {
    id: "usr-01",
    employeeCode: "EMP-00001",
    fullName: "Sanjay K J",
    email: "owner@kanakkuflow.internal",
    mobile: "+91 98765 43210",
    role: "OWNER",
    branches: "All Branches",
    status: "ACTIVE",
  },
  {
    id: "usr-02",
    employeeCode: "EMP-00002",
    fullName: "Anand Raj",
    email: "anand.admin@muruganfoods.com",
    mobile: "+91 98400 11223",
    role: "ADMIN",
    branches: "All Branches",
    status: "ACTIVE",
  },
  {
    id: "usr-03",
    employeeCode: "EMP-00003",
    fullName: "Meenakshi Sundaram",
    email: "meena.accounts@muruganfoods.com",
    mobile: "+91 94431 55667",
    role: "ACCOUNTANT",
    branches: "All Branches (Finance)",
    status: "ACTIVE",
  },
  {
    id: "usr-04",
    employeeCode: "EMP-00004",
    fullName: "Murugesan K",
    email: "murugesan.prod@muruganfoods.com",
    mobile: "+91 97890 22334",
    role: "PRODUCTION",
    branches: "Madurai Factory (Branch 1)",
    status: "ACTIVE",
  },
  {
    id: "usr-05",
    employeeCode: "EMP-00005",
    fullName: "Ramesh Kumar",
    email: "ramesh.sales@muruganfoods.com",
    mobile: "+91 98401 23456",
    role: "SALESMAN",
    branches: "Madurai City & South Hub",
    status: "ACTIVE",
  },
  {
    id: "usr-06",
    employeeCode: "EMP-00006",
    fullName: "Selvam P",
    email: "selvam.wh@muruganfoods.com",
    mobile: "+91 96291 77889",
    role: "WAREHOUSE",
    branches: "Central Distribution Depot",
    status: "PENDING_INVITE",
  },
];

export default function UserManagementPage() {
  const [employees, setEmployees] = useState<EmployeeRow[]>(INITIAL_EMPLOYEES);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("ALL");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Form state for creating employee
  const [newFullName, setNewFullName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newMobile, setNewMobile] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("SALESMAN");
  const [newBranch, setNewBranch] = useState("Madurai Factory (Branch 1)");
  const [provisioningType, setProvisioningType] = useState<"INVITE" | "DIRECT">("INVITE");

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employeeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole =
      selectedRoleFilter === "ALL" || emp.role === selectedRoleFilter;
    return matchesSearch && matchesRole;
  });

  const handleCreateEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    const newEmp: EmployeeRow = {
      id: `usr-${Date.now()}`,
      employeeCode: `EMP-0000${employees.length + 1}`,
      fullName: newFullName,
      email: newEmail,
      mobile: newMobile,
      role: newRole,
      branches: newBranch,
      status: provisioningType === "INVITE" ? "PENDING_INVITE" : "ACTIVE",
    };
    setEmployees([...employees, newEmp]);
    setIsDialogOpen(false);
    // Reset form
    setNewFullName("");
    setNewEmail("");
    setNewMobile("");
  };

  return (
    <div className="space-y-6">
      {/* Header & Action Bar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            User & Employee Management
          </h1>
          <p className="text-xs text-slate-500">
            Manage hierarchical team permissions, branch assignments, and role invitations.
          </p>
        </div>

        {/* Invite / Add Employee Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-slate-900 text-white hover:bg-slate-800">
              <UserPlus className="w-4 h-4 mr-2" />
              Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add / Invite Team Member</DialogTitle>
              <DialogDescription>
                Assign role and physical branch access. Admins cannot create Owner or Admin accounts.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateEmployee} className="space-y-4 py-2">
              <div className="space-y-1">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. Ramesh Kumar"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="ramesh@muruganfoods.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="mobile">Mobile Number</Label>
                <Input
                  id="mobile"
                  placeholder="+91 98401 23456"
                  value={newMobile}
                  onChange={(e) => setNewMobile(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="role">Role</Label>
                  <select
                    id="role"
                    className="w-full h-9 px-3 py-1 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
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
                    className="w-full h-9 px-3 py-1 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900"
                    value={newBranch}
                    onChange={(e) => setNewBranch(e.target.value)}
                  >
                    <option value="Madurai Factory (Branch 1)">Plant 1 (Madurai)</option>
                    <option value="Dindigul Distribution Hub">Hub 2 (Dindigul)</option>
                    <option value="All Branches">All Branches</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2 p-3 rounded-md bg-slate-50 border border-slate-200 text-xs">
                <div className="font-semibold text-slate-800">Onboarding Method:</div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="provType"
                      checked={provisioningType === "INVITE"}
                      onChange={() => setProvisioningType("INVITE")}
                    />
                    <span>Email Invitation (Recommended)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="provType"
                      checked={provisioningType === "DIRECT"}
                      onChange={() => setProvisioningType("DIRECT")}
                    />
                    <span>Direct Password Setup</span>
                  </label>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-slate-900 text-white">
                  Send Invitation
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

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
              ].map((role) => (
                <button
                  key={role}
                  onClick={() => setSelectedRoleFilter(role)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    selectedRoleFilter === role
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employee Table */}
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
              {filteredEmployees.map((emp) => (
                <TableRow key={emp.id}>
                  <TableCell className="font-mono text-xs font-semibold text-slate-800">
                    {emp.employeeCode}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs font-semibold text-slate-900">{emp.fullName}</div>
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
                    {emp.status === "ACTIVE" && (
                      <Badge variant="success">ACTIVE</Badge>
                    )}
                    {emp.status === "PENDING_INVITE" && (
                      <Badge variant="warning">INVITE PENDING</Badge>
                    )}
                    {emp.status === "DEACTIVATED" && (
                      <Badge variant="danger">DEACTIVATED</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="text-xs">
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
