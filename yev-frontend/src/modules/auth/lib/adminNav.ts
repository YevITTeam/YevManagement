import { Shield, ShieldCheck, Users, type LucideIcon } from "lucide-react";

export interface AdminNavItem {
  key: "adminUsers" | "adminRolePermissions" | "adminUserPermissions";
  href: string;
  icon: LucideIcon;
  permission: string;
}

// Each item shows only with its screen's View permission; BE still enforces 403.
export const adminNavItems: AdminNavItem[] = [
  { key: "adminUsers", href: "/admin/user-roles", icon: Users, permission: "Identity.User.View" },
  { key: "adminRolePermissions", href: "/admin/permissions", icon: Shield, permission: "Identity.Permission.View" },
  { key: "adminUserPermissions", href: "/admin/user-permissions", icon: ShieldCheck, permission: "Identity.Permission.View" },
];
