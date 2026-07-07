"use client";

import { useState } from "react";
import UserRoleModal from "@/modules/auth/components/UserRoleModal";
import RoleList from "@/modules/auth/components/roles/RoleList";

export default function AdminDashboard() {
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [showRoleManager, setShowRoleManager] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const openPermissions = () => {
    setShowRoleManager(false);
    setIsRoleModalOpen(true);
    setActiveMenu("permissions");
  };

  const openRoles = () => {
    setIsRoleModalOpen(false);
    setShowRoleManager(true);
    setActiveMenu("roles");
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-[#f8fafc]">
      <aside className="w-64 space-y-2 border-r border-[#e0e3e5] bg-white p-4 shadow-sm">
        <h3 className="mb-4 px-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
          Quản trị hệ thống
        </h3>

        <button
          onClick={openPermissions}
          className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors ${activeMenu === "permissions"
            ? "bg-[#fff4f2] text-[#e3000f]"
            : "bg-white text-[#5e3f3a] hover:bg-[#f2f4f6] hover:text-[#191c1e]"
            }`}
        >
          <span>🛡️</span> Phân quyền
        </button>

        <button
          onClick={openRoles}
          className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors ${activeMenu === "roles"
            ? "bg-[#fff4f2] text-[#e3000f]"
            : "bg-white text-[#5e3f3a] hover:bg-[#f2f4f6] hover:text-[#191c1e]"
            }`}
        >
          <span>🔑</span> Quản lý Roles
        </button>

        <button className="flex w-full cursor-not-allowed items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium text-[#5e3f3a] opacity-50">
          <span>📊</span> Báo cáo số liệu
        </button>
        <button className="flex w-full cursor-not-allowed items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium text-[#5e3f3a] opacity-50">
          <span>⚙️</span> Cài đặt chung
        </button>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        {activeMenu === "permissions" ? (
          <UserRoleModal
            isOpen={isRoleModalOpen}
            onClose={() => {
              setIsRoleModalOpen(false);
              setActiveMenu(null);
            }}
          />
        ) : showRoleManager ? (
          <RoleList />
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