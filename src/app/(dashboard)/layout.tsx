import React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { getCurrentUserSession, logoutUser } from "@/modules/auth/actions";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentUserSession();

  if (!session) {
    redirect("/login");
  }

  const primaryBranch =
    session.accessibleBranches.find((b) => b.isDefault) ||
    session.accessibleBranches[0];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50">
      {/* Collapsible Sidebar - Enforcing Role Visibility */}
      <Sidebar
        currentRole={session.role}
        companyName={session.companyName}
        activeBranchName={primaryBranch ? `${primaryBranch.name} (${primaryBranch.code})` : "All Branches"}
      />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header
          currentRole={session.role}
          userName={session.fullName}
          userEmail={session.email}
          activeBranchCode={primaryBranch?.code || "HQ-ALL"}
          onLogout={logoutUser}
        />

        {/* Scrollable Viewport */}
        <main className="flex-1 p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
