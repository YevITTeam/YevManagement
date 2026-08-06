"use client";

import { useState } from "react";
import UserRoleModal from "@/modules/auth/components/UserRoleModal";
import RoleList from "@/modules/auth/components/roles/RoleList";
import RolePermissionManager from "@/modules/auth/components/permissions/RolePermissionManager";
import UserPermissionOverrideManager from "@/modules/auth/components/permissions/UserPermissionOverrideManager";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";
import { Users, Key, Shield, ShieldCheck, LayoutGrid, ArrowUpRight, type LucideIcon } from "lucide-react"

type MenuKey = "home" | "user-roles" | "roles" | "permissions" | "user-permissions";

interface QuickLink {
  key: MenuKey;
  label: string;
  description: string;
  icon: LucideIcon;
  visible: boolean;
}

export default function AdminDashboard() {
  const { user: currentUser, isLoading: isLoadingUser } = useAuth();
  const [activeMenu, setActiveMenu] = useState<MenuKey>("home");

  // Mỗi mục sidebar chỉ hiện khi user có permission tương ứng (docs/identity-api-fe.md §4) —
  // BE vẫn tự enforce lại 403 nếu FE có sai sót, đây chỉ là ẩn/hiện UI.
  const canViewUserRoles = hasPermission(currentUser, "Identity.User.View");
  const canViewRoles = hasPermission(currentUser, "Identity.Role.View");
  const canViewPermissions = hasPermission(currentUser, "Identity.Permission.View");

  const isHome = activeMenu === "home";
  const isUserRoles = activeMenu === "user-roles";
  const isRoles = activeMenu === "roles";
  const isPermissions = activeMenu === "permissions";
  const isUserPermissions = activeMenu === "user-permissions";

  const quickLinks: QuickLink[] = [
    {
      key: "user-roles",
      label: "Gán vai trò người dùng",
      description: "Gán hoặc gỡ vai trò cho từng tài khoản.",
      icon: Users,
      visible: canViewUserRoles,
    },
    {
      key: "roles",
      label: "Quản lý Roles",
      description: "Tạo, sửa, xoá các vai trò trong hệ thống.",
      icon: Key,
      visible: canViewRoles,
    },
    {
      key: "permissions",
      label: "Phân quyền theo Role",
      description: "Cấu hình quyền hạn theo từng vai trò.",
      icon: Shield,
      visible: canViewPermissions,
    },
    {
      key: "user-permissions",
      label: "Phân quyền riêng theo User",
      description: "Ghi đè quyền cho một tài khoản cụ thể.",
      icon: ShieldCheck,
      visible: canViewPermissions,
    },
  ];
  const visibleQuickLinks = quickLinks.filter((item) => item.visible);

  const menuItemClass = (active: boolean) =>
    `flex w-full cursor-pointer items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors ${active
      ? "bg-[#fff4f2] text-[#e3000f]"
      : "bg-white text-[#5e3f3a] hover:bg-[#f2f4f6] hover:text-[#191c1e]"
    }`;

  // min-h-full (không phải h-full) — section cha (layout.tsx) đã có h-full nên % ở đây resolve được,
  // cho container này 1 SÀN chiều cao = khung nhìn. Dùng min thay vì h cứng để khi nội dung bên cạnh
  // (vd danh sách user dài) cao hơn 1 màn hình, flex align-items:stretch mặc định vẫn kéo <aside> giãn
  // theo đúng chiều cao thật của nội dung — tránh sidebar bị "cụt" trong khi nội dung tràn dài hơn.
  // Nội dung ngắn hơn màn hình thì container vẫn không thấp hơn sàn min-h-full, nên <aside> vẫn phủ đủ
  // 1 màn hình như cũ. <main> gốc vẫn là nơi cuộn duy nhất — không thêm overflow/vh nào ở đây nên không
  // tái phát bẫy "2 thanh cuộn chồng nhau" ở DESIGN_SYSTEM.md §3.
  return (
    <div className="flex min-h-full bg-[#f8fafc]">
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
            <button onClick={() => setActiveMenu("home")} className={menuItemClass(isHome)}>
              <span><LayoutGrid className="h-4 w-4" /></span> Trang chủ
            </button>

            {visibleQuickLinks.length > 0 && (
              <p className="px-2 pb-1 pt-3 text-xs font-semibold uppercase tracking-[0.1em] text-[#8a8f94]">
                Người dùng &amp; phân quyền
              </p>
            )}

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

      {/* <div> chứ không phải <main> — [locale]/layout.tsx đã có <main> bọc ngoài rồi, lồng 2 <main>
          là HTML không hợp lệ. Không tự mở overflow-y-auto riêng — <main> gốc đã là vùng cuộn DUY
          NHẤT của app (xem DESIGN_SYSTEM.md §3). */}
      <div className="flex-1 p-8">
        {isUserRoles && canViewUserRoles ? (
          <UserRoleModal isOpen onClose={() => setActiveMenu("home")} />
        ) : isRoles && canViewRoles ? (
          <RoleList />
        ) : isPermissions && canViewPermissions ? (
          <RolePermissionManager />
        ) : isUserPermissions && canViewPermissions ? (
          <UserPermissionOverrideManager />
        ) : (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold text-[#191c1e]">
                Xin chào, {currentUser?.fullName ?? "Quản trị viên"}!
              </h1>
              <p className="mt-1 text-sm text-[#5e3f3a]">
                Bạn đang ở khu vực quản trị hệ thống YEV. Chọn một chức năng bên dưới để bắt đầu.
              </p>
            </div>

            {visibleQuickLinks.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {visibleQuickLinks.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setActiveMenu(item.key)}
                    className="group flex items-center gap-3.5 rounded-xl border border-[#e0e3e5] bg-white p-4 text-left shadow-sm transition hover:border-[#e9bcb6] hover:shadow-md"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#fff4f2] text-[#e3000f]">
                      <item.icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-[#191c1e]">{item.label}</span>
                      <span className="block text-xs text-[#5e3f3a]">{item.description}</span>
                    </span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-[#8a8f94] transition group-hover:text-[#e3000f]" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-xl border border-[#e0e3e5] bg-white p-8 text-center shadow-sm">
                <p className="max-w-md text-[#5e3f3a]">
                  Tài khoản của bạn chưa được cấp quyền quản trị nào.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
