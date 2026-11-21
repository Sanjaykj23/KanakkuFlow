"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { UserRole } from "@/types/database";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // In Phase 1 shell, default to OWNER role for initial inspection.
  // Can be toggled for demo or derived from authenticated session.
  const [currentRole, setCurrentRole] = useState<UserRole>("OWNER");

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50">
      {/* Collapsible Sidebar */}
      <Sidebar
        currentRole={currentRole}
        companyName="Sri Murugan Food Industries"
        activeBranchName="Plant 1 - Madurai Factory"
      />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header
          currentRole={currentRole}
          userName="Sanjay K J"
          userEmail="owner@kanakkuflow.internal"
          activeBranchCode="MDU-PLANT-01"
          onLogout={() => {
            window.location.href = "/login";
          }}
        />

        {/* Dynamic Role Switcher Bar for Development Testing */}
        <div className="flex items-center justify-between px-6 py-1.5 text-xs bg-amber-50/80 border-b border-amber-200 text-amber-900">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Role Preview Mode:</span>
            <span>Switch role to inspect role-based sidebar & permission rendering:</span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {(
              [
                "OWNER",
                "ADMIN",
                "SUPERVISOR",
                "SALESMAN",
                "ACCOUNTANT",
                "PRODUCTION",
                "WAREHOUSE",
              ] as UserRole[]
            ).map((role) => (
              <button
                key={role}
                onClick={() => setCurrentRole(role)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  currentRole === role
                    ? "bg-slate-900 text-white font-bold"
                    : "bg-white text-slate-700 hover:bg-amber-100 border border-amber-200"
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Viewport */}
        <main className="flex-1 p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
