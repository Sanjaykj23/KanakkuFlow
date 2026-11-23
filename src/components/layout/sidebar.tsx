"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShieldAlert,
  Store,
  ShoppingBag,
  CheckSquare,
  Tag,
  ChefHat,
  Factory,
  ClipboardCheck,
  Boxes,
  QrCode,
  Truck,
  Receipt,
  IndianRupee,
  FileSpreadsheet,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Building2,
  Package,
  Scale,
  Percent,
  Warehouse,
  UsersRound,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NAVIGATION_CONFIG } from "@/lib/constants";
import { UserRole } from "@/types/database";

const ICON_MAP: Record<string, React.ReactNode> = {
  LayoutDashboard: <LayoutDashboard className="w-4 h-4" />,
  ShieldAlert: <ShieldAlert className="w-4 h-4" />,
  Store: <Store className="w-4 h-4" />,
  ShoppingBag: <ShoppingBag className="w-4 h-4" />,
  CheckSquare: <CheckSquare className="w-4 h-4" />,
  Tag: <Tag className="w-4 h-4" />,
  ChefHat: <ChefHat className="w-4 h-4" />,
  Factory: <Factory className="w-4 h-4" />,
  ClipboardCheck: <ClipboardCheck className="w-4 h-4" />,
  Boxes: <Boxes className="w-4 h-4" />,
  QrCode: <QrCode className="w-4 h-4" />,
  Truck: <Truck className="w-4 h-4" />,
  Receipt: <Receipt className="w-4 h-4" />,
  IndianRupee: <IndianRupee className="w-4 h-4" />,
  FileSpreadsheet: <FileSpreadsheet className="w-4 h-4" />,
  Users: <Users className="w-4 h-4" />,
  Settings: <Settings className="w-4 h-4" />,
  Package: <Package className="w-4 h-4" />,
  Scale: <Scale className="w-4 h-4" />,
  Percent: <Percent className="w-4 h-4" />,
  Warehouse: <Warehouse className="w-4 h-4" />,
  UsersRound: <UsersRound className="w-4 h-4" />,
  ClipboardList: <ClipboardList className="w-4 h-4" />,
};

interface SidebarProps {
  currentRole: UserRole;
  companyName?: string;
  activeBranchName?: string;
}

export function Sidebar({
  currentRole,
  companyName = "Sri Murugan Foods",
  activeBranchName = "Main Factory (Branch 1)",
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "relative flex flex-col border-r border-slate-200 bg-white transition-all duration-300 ease-in-out select-none",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-slate-200">
        {!collapsed && (
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-7 h-7 rounded-md bg-amber-500 text-white font-bold text-sm shadow-sm">
                K
              </span>
              <span className="font-bold text-base tracking-tight text-slate-900">
                Kanakku<span className="text-amber-600">Flow</span>
              </span>
            </div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold pl-9">
              Manufacturing ERP
            </span>
          </div>
        )}
        {collapsed && (
          <span className="mx-auto flex items-center justify-center w-8 h-8 rounded-md bg-amber-500 text-white font-bold text-base shadow-sm">
            K
          </span>
        )}
      </div>

      {/* Tenant Context Pill */}
      {!collapsed && (
        <div className="px-3 py-2.5 m-2 rounded-md bg-slate-50 border border-slate-200/80">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 truncate">
            <Building2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="truncate">{companyName}</span>
          </div>
          <div className="text-[11px] text-slate-500 truncate pl-5">
            {activeBranchName}
          </div>
        </div>
      )}

      {/* Navigation Sections */}
      <div className="flex-1 px-2 py-3 space-y-4 overflow-y-auto">
        {NAVIGATION_CONFIG.map((group) => {
          // Filter items based on currentRole
          const visibleItems = group.items.filter((item) =>
            item.allowedRoles.includes(currentRole)
          );

          if (visibleItems.length === 0) return null;

          return (
            <div key={group.group} className="space-y-1">
              {!collapsed && (
                <div className="px-3 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                  {group.group}
                </div>
              )}
              {visibleItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.title : undefined}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-md transition-colors",
                      isActive
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                      collapsed && "justify-center px-0"
                    )}
                  >
                    <span className={cn(isActive ? "text-amber-400" : "text-slate-500")}>
                      {ICON_MAP[item.icon] || <LayoutDashboard className="w-4 h-4" />}
                    </span>
                    {!collapsed && <span className="truncate">{item.title}</span>}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Collapse Toggle */}
      <div className="p-2 border-t border-slate-200">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full h-8 text-xs text-slate-500 rounded-md hover:bg-slate-100 transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <div className="flex items-center gap-2">
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse Menu</span>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
