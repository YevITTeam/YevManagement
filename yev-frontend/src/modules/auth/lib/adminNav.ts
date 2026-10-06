import { Shield, ShieldCheck, Users, type LucideIcon } from "lucide-react";

export interface AdminNavItem {
  key: "adminUsers" | "adminRolePermissions" | "adminUserPermissions";
  href: string;
  icon: LucideIcon;
  permission: string;
}

// Mỗi mục chỉ hiện (sidebar + thẻ ở trang Tổng quan) khi user có permission "View" của màn nó mở ra —
// BE vẫn enforce lại 403, FE chỉ ẩn/hiện UI.
export const adminNavItems: AdminNavItem[] = [
  { key: "adminUsers", href: "/admin/user-roles", icon: Users, permission: "Identity.User.View" },
  { key: "adminRolePermissions", href: "/admin/permissions", icon: Shield, permission: "Identity.Permission.View" },
  { key: "adminUserPermissions", href: "/admin/user-permissions", icon: ShieldCheck, permission: "Identity.Permission.View" },
];
