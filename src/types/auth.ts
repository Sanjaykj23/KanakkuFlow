import { UserRole } from "./database";

export interface CurrentUserSession {
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
  companyId: string;
  companyName: string;
  accessibleBranches: {
    id: string;
    code: string;
    name: string;
    isDefault: boolean;
  }[];
  requiresPasswordChange: boolean;
  permissions: string[];
}
