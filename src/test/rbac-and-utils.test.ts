import { describe, it, expect } from "vitest";
import { formatCurrencyINR, formatDate } from "@/lib/utils";
import { UserRole } from "@/types/database";

// Permission validation logic mirroring PostgreSQL fn_enforce_role_hierarchy
function canUserCreateRole(actorRole: UserRole, targetRole: UserRole): boolean {
  if (actorRole === "OWNER") {
    return true; // Owner can create any role
  }
  if (actorRole === "ADMIN") {
    // Admin cannot create, promote, or touch Owner or Admin
    if (targetRole === "OWNER" || targetRole === "ADMIN") {
      return false;
    }
    // Admin can create lower-level operational staff
    return ["SUPERVISOR", "SALESMAN", "ACCOUNTANT", "PRODUCTION", "WAREHOUSE"].includes(targetRole);
  }
  // Other roles cannot create accounts
  return false;
}

// Branch access evaluation logic mirroring PostgreSQL has_branch_access
function canUserAccessBranch(
  userRole: UserRole,
  assignedBranchIds: string[],
  targetBranchId: string
): boolean {
  // OWNER, ADMIN, and ACCOUNTANT have company-wide branch access by default
  if (["OWNER", "ADMIN", "ACCOUNTANT"].includes(userRole)) {
    return true;
  }
  // Others must have explicit branch assignment
  return assignedBranchIds.includes(targetBranchId);
}

describe("RBAC Hierarchy & Security Invariants", () => {
  it("allows OWNER to create any role including ADMIN and lower staff", () => {
    expect(canUserCreateRole("OWNER", "ADMIN")).toBe(true);
    expect(canUserCreateRole("OWNER", "ACCOUNTANT")).toBe(true);
    expect(canUserCreateRole("OWNER", "PRODUCTION")).toBe(true);
    expect(canUserCreateRole("OWNER", "WAREHOUSE")).toBe(true);
  });

  it("STRICT: blocks ADMIN from creating OWNER or ADMIN accounts", () => {
    expect(canUserCreateRole("ADMIN", "OWNER")).toBe(false);
    expect(canUserCreateRole("ADMIN", "ADMIN")).toBe(false);
  });

  it("allows ADMIN to create operational roles (Supervisor, Salesman, Accountant, Production, Warehouse)", () => {
    expect(canUserCreateRole("ADMIN", "SUPERVISOR")).toBe(true);
    expect(canUserCreateRole("ADMIN", "SALESMAN")).toBe(true);
    expect(canUserCreateRole("ADMIN", "ACCOUNTANT")).toBe(true);
    expect(canUserCreateRole("ADMIN", "PRODUCTION")).toBe(true);
    expect(canUserCreateRole("ADMIN", "WAREHOUSE")).toBe(true);
  });

  it("blocks lower roles from creating any user accounts", () => {
    const lowerRoles: UserRole[] = ["SUPERVISOR", "SALESMAN", "ACCOUNTANT", "PRODUCTION", "WAREHOUSE"];
    lowerRoles.forEach((role) => {
      expect(canUserCreateRole(role, "SALESMAN")).toBe(false);
      expect(canUserCreateRole(role, "WAREHOUSE")).toBe(false);
    });
  });

  it("enforces company-wide branch access for OWNER, ADMIN, and ACCOUNTANT", () => {
    expect(canUserAccessBranch("OWNER", [], "branch-99")).toBe(true);
    expect(canUserAccessBranch("ADMIN", [], "branch-99")).toBe(true);
    expect(canUserAccessBranch("ACCOUNTANT", [], "branch-99")).toBe(true);
  });

  it("enforces explicit branch assignment for WAREHOUSE and PRODUCTION", () => {
    expect(canUserAccessBranch("WAREHOUSE", ["branch-1"], "branch-1")).toBe(true);
    expect(canUserAccessBranch("WAREHOUSE", ["branch-1"], "branch-2")).toBe(false);
    expect(canUserAccessBranch("PRODUCTION", ["branch-1"], "branch-3")).toBe(false);
  });
});

describe("Manufacturing ERP Formatters", () => {
  it("formats Indian Rupee currency correctly with symbol", () => {
    const formatted = formatCurrencyINR(284500);
    expect(formatted).toContain("2,84,500");
  });

  it("formats dates into readable format", () => {
    const formatted = formatDate(new Date("2026-11-21T00:00:00Z"));
    expect(formatted).toContain("2026");
  });
});
