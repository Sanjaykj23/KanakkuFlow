import { UserRole } from "@/types/database";

export const APP_NAME = "KanakkuFlow";
export const APP_DESCRIPTION = "Manufacturing ERP for Indian Food Products";

export interface NavItem {
  title: string;
  href: string;
  icon: string;
  allowedRoles: UserRole[];
  badge?: string;
}

export interface NavGroup {
  group: string;
  items: NavItem[];
}

export const NAVIGATION_CONFIG: NavGroup[] = [
  {
    group: "Overview",
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: "LayoutDashboard",
        allowedRoles: ["OWNER", "ADMIN", "SUPERVISOR", "SALESMAN", "ACCOUNTANT", "PRODUCTION", "WAREHOUSE"],
      },
      {
        title: "Audit Trail",
        href: "/audit-logs",
        icon: "ShieldAlert",
        allowedRoles: ["OWNER"],
      },
    ],
  },
  {
    group: "Field Sales & CRM",
    items: [
      {
        title: "Shop Visits & Registrations",
        href: "/sales/shop-registrations",
        icon: "Store",
        allowedRoles: ["OWNER", "ADMIN", "SUPERVISOR", "SALESMAN"],
      },
      {
        title: "Sales Orders",
        href: "/sales/orders",
        icon: "ShoppingBag",
        allowedRoles: ["OWNER", "ADMIN", "SUPERVISOR", "SALESMAN"],
      },
      {
        title: "Order Approvals",
        href: "/sales/approvals",
        icon: "CheckSquare",
        allowedRoles: ["OWNER", "ADMIN", "SUPERVISOR"],
      },
      {
        title: "Price Lists",
        href: "/sales/pricing",
        icon: "Tag",
        allowedRoles: ["OWNER", "ADMIN", "SUPERVISOR", "SALESMAN", "ACCOUNTANT"],
      },
    ],
  },
  {
    group: "Production & Quality",
    items: [
      {
        title: "BOM Recipes",
        href: "/production/recipes",
        icon: "ChefHat",
        allowedRoles: ["OWNER", "ADMIN", "PRODUCTION"],
      },
      {
        title: "Production Runs",
        href: "/production/runs",
        icon: "Factory",
        allowedRoles: ["OWNER", "ADMIN", "SUPERVISOR", "PRODUCTION"],
      },
      {
        title: "QC Inspections",
        href: "/production/qc",
        icon: "ClipboardCheck",
        allowedRoles: ["OWNER", "ADMIN", "SUPERVISOR", "PRODUCTION"],
      },
    ],
  },
  {
    group: "Inventory & Batches",
    items: [
      {
        title: "Stock Ledger",
        href: "/inventory/stock",
        icon: "Boxes",
        allowedRoles: ["OWNER", "ADMIN", "SUPERVISOR", "SALESMAN", "ACCOUNTANT", "PRODUCTION", "WAREHOUSE"],
      },
      {
        title: "Batch Traceability (FEFO)",
        href: "/inventory/batches",
        icon: "QrCode",
        allowedRoles: ["OWNER", "ADMIN", "SUPERVISOR", "WAREHOUSE", "PRODUCTION"],
      },
      {
        title: "Goods Receipt & Dispatch",
        href: "/inventory/dispatch",
        icon: "Truck",
        allowedRoles: ["OWNER", "ADMIN", "SUPERVISOR", "WAREHOUSE"],
      },
    ],
  },
  {
    group: "Finance & Accounts",
    items: [
      {
        title: "GST Invoices",
        href: "/billing/invoices",
        icon: "Receipt",
        allowedRoles: ["OWNER", "ADMIN", "ACCOUNTANT"],
      },
      {
        title: "Payments & Collections",
        href: "/billing/payments",
        icon: "IndianRupee",
        allowedRoles: ["OWNER", "ADMIN", "ACCOUNTANT"],
      },
      {
        title: "GST Reports (GSTR-1)",
        href: "/billing/gst-reports",
        icon: "FileSpreadsheet",
        allowedRoles: ["OWNER", "ACCOUNTANT"],
      },
    ],
  },
  {
    group: "Administration",
    items: [
      {
        title: "User Management",
        href: "/users",
        icon: "Users",
        allowedRoles: ["OWNER", "ADMIN"],
      },
      {
        title: "Company Settings",
        href: "/settings",
        icon: "Settings",
        allowedRoles: ["OWNER"],
      },
    ],
  },
];
