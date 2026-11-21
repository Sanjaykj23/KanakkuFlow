"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserRole } from "@/types/database";
import {
  Bell,
  Search,
  LogOut,
  User as UserIcon,
  ShieldCheck,
  Building,
} from "lucide-react";

interface HeaderProps {
  currentRole: UserRole;
  userName?: string;
  userEmail?: string;
  activeBranchCode?: string;
  onLogout?: () => void;
}

const ROLE_BADGE_VARIANT_MAP: Record<UserRole, "owner" | "admin" | "supervisor" | "salesman" | "accountant" | "production" | "warehouse"> = {
  OWNER: "owner",
  ADMIN: "admin",
  SUPERVISOR: "supervisor",
  SALESMAN: "salesman",
  ACCOUNTANT: "accountant",
  PRODUCTION: "production",
  WAREHOUSE: "warehouse",
};

export function Header({
  currentRole,
  userName = "Sanjay K J",
  userEmail = "owner@kanakkuflow.internal",
  activeBranchCode = "HQ-MAIN",
  onLogout,
}: HeaderProps) {
  return (
    <header className="flex items-center justify-between h-16 px-6 bg-white border-b border-slate-200">
      {/* Search Input Bar (Retool Style) */}
      <div className="flex items-center gap-3 w-72">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search items, orders, batches... (Ctrl+K)"
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Action Area & Profile */}
      <div className="flex items-center gap-4">
        {/* Branch Indicator */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 rounded-md border border-slate-200">
          <Building className="w-3.5 h-3.5 text-slate-500" />
          <span>Branch: {activeBranchCode}</span>
        </div>

        {/* Notifications Icon */}
        <button
          className="relative p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full" />
        </button>

        <div className="h-4 w-px bg-slate-200" />

        {/* User Info & Role Pill */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden md:block">
            <div className="flex items-center justify-end gap-2">
              <span className="text-xs font-semibold text-slate-900">{userName}</span>
              <Badge variant={ROLE_BADGE_VARIANT_MAP[currentRole]}>
                {currentRole}
              </Badge>
            </div>
            <div className="text-[11px] text-slate-400">{userEmail}</div>
          </div>

          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-900 text-white font-medium text-xs shadow-sm">
            {userName.charAt(0)}
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onLogout}
            title="Log Out"
            className="text-slate-500 hover:text-rose-600 hover:bg-rose-50"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
