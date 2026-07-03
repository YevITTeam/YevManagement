"use client";

import { useState } from "react";
import UserRoleModal from "@/components/admin/UserRoleModal";
import RoleList from "@/components/admin/roles/RoleList";

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
    <div className="flex h-[calc(100vh-4rem)] bg-gray-100">
      <aside className="w-64 border-r border-gray-200 bg-white p-4 shadow-md space-y-2">
        <h3 className="mb-4 px-2 text-xs font-bold uppercase tracking-wider text-gray-400">
          Quản trị hệ thống
        </h3>

        <button
          onClick={openPermissions}
          className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors ${activeMenu === "permissions"
            ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
            : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
        >
          <span>🛡️</span> Phân quyền
        </button>

        <button
          onClick={openRoles}
          className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors ${activeMenu === "roles"
            ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
            : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
        >
          <span>🔑</span> Quản lý Roles
        </button>

        <button className="w-full cursor-not-allowed rounded-lg px-4 py-3 text-left text-gray-600 opacity-50 transition-colors hover:bg-gray-50">
          <span>📊</span> Báo cáo số liệu
        </button>
        <button className="w-full cursor-not-allowed rounded-lg px-4 py-3 text-left text-gray-600 opacity-50 transition-colors hover:bg-gray-50">
          <span>⚙️</span> Cài đặt chung
        </button>
      </aside>

      <main className="flex-1 p-8">
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
          <div className="flex h-full flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <div className="mb-4 text-6xl">👋</div>
            <h1 className="mb-2 text-2xl font-bold text-gray-800">Xin chào Quản trị viên!</h1>
            <p className="max-w-md text-gray-500">
              Bạn đang ở trong khu vực điều khiển hệ thống YEV.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}