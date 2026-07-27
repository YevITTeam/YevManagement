"use client";

import { useState } from "react";
import UserRoleModal from "@/modules/auth/components/UserRoleModal";
import RoleList from "@/modules/auth/components/roles/RoleList";
import RolePermissionManager from "@/modules/auth/components/permissions/RolePermissionManager";
import UserPermissionOverrideManager from "@/modules/auth/components/permissions/UserPermissionOverrideManager";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";
import {Users, Key, Shield, ShieldCheck} from "lucide-react"

type MenuKey = "user-roles" | "roles" | "permissions" | "user-permissions";

export default function AdminDashboard() {
  const { user: currentUser, isLoading: isLoadingUser } = useAuth();
  const [activeMenu, setActiveMenu] = useState<MenuKey | null>(null);

  // Mỗi mục sidebar chỉ hiện khi user có permission tương ứng (docs/identity-api-fe.md §4) —
  // BE vẫn tự enforce lại 403 nếu FE có sai sót, đây chỉ là ẩn/hiện UI.
  const canViewUserRoles = hasPermission(currentUser, "Identity.User.View");
  const canViewRoles = hasPermission(currentUser, "Identity.Role.View");
  const canViewPermissions = hasPermission(currentUser, "Identity.Permission.View");

  const isUserRoles = activeMenu === "user-roles";
  const isRoles = activeMenu === "roles";
  const isPermissions = activeMenu === "permissions";
  const isUserPermissions = activeMenu === "user-permissions";

  const menuItemClass = (active: boolean) =>
    `flex w-full cursor-pointer items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors ${active
      ? "bg-[#fff4f2] text-[#e3000f]"
      : "bg-white text-[#5e3f3a] hover:bg-[#f2f4f6] hover:text-[#191c1e]"
    }`;

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-[#f8fafc]">
      <aside className="w-64 space-y-2 border-r border-[#e0e3e5] bg-white p-4 shadow-sm">
        <h3 className="mb-4 px-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
          Quản trị hệ thống
        </h3>

        {isLoadingUser ? (
          <div className="space-y-2">
            <div className="h-11 animate-pulse rounded-lg bg-[#eceef0]" />
            <div className="h-11 animate-pulse rounded-lg bg-[#eceef0]" />
            <div className="h-11 animate-pulse rounded-lg bg-[#eceef0]" />
          </div>
        ) : (
          <>
            {canViewUserRoles && (
              <button onClick={() => setActiveMenu("user-roles")} className={menuItemClass(isUserRoles)}>
                <span><Users className="h-4 w-4" /></span> Gán vai trò người dùng
              </button>
            )}

            {canViewRoles && (
              <button onClick={() => setActiveMenu("roles")} className={menuItemClass(isRoles)}>
                <span><Key className="h-4 w-4" /></span> Quản lý Roles
              </button>
            )}

            {canViewPermissions && (
              <button onClick={() => setActiveMenu("permissions")} className={menuItemClass(isPermissions)}>
                <span><Shield className="h-4 w-4" /></span> Phân quyền theo Role
              </button>
            )}

            {canViewPermissions && (
              <button onClick={() => setActiveMenu("user-permissions")} className={menuItemClass(isUserPermissions)}>
                <span><ShieldCheck className="h-4 w-4" /></span> Phân quyền riêng theo User
              </button>
            )}

            {!canViewUserRoles && !canViewRoles && !canViewPermissions && (
              <p className="px-2 text-sm text-[#5e3f3a]">
                Tài khoản của bạn chưa được cấp quyền quản trị nào.
              </p>
            )}
          </>
        )}
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        {isUserRoles && canViewUserRoles ? (
          <UserRoleModal isOpen onClose={() => setActiveMenu(null)} />
        ) : isRoles && canViewRoles ? (
          <RoleList />
        ) : isPermissions && canViewPermissions ? (
          <RolePermissionManager />
        ) : isUserPermissions && canViewPermissions ? (
          <UserPermissionOverrideManager />
        ) : (
          <div className="flex h-full flex-col items-center justify-center rounded-xl border border-[#e0e3e5] bg-white p-8 text-center shadow-sm">
            <div className="mb-4 text-6xl">👋</div>
            <h1 className="mb-2 text-2xl font-semibold text-[#191c1e]">Xin chào Quản trị viên!</h1>
            <p className="max-w-md text-[#5e3f3a]">
              Bạn đang ở trong khu vực điều khiển hệ thống YEV.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
