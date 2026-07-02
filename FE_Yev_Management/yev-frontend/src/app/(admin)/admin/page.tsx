"use client";

import { useState } from "react";
import UserRoleModal from "@/components/admin/UserRoleModal";
import RoleList from "@/components/admin/roles/RoleList";

export default function AdminDashboard() {
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [showRoleManager, setShowRoleManager] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-gray-100">
      {/* Sidebar (Menu bên trái) */}
      <aside className="w-64 bg-white shadow-md border-r border-gray-200 p-4 space-y-2">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 px-2">
          Quản trị hệ thống
        </h3>

        {/* Nút Phân quyền (UserRole Modal) */}
        <button
          onClick={() => { setIsRoleModalOpen(true); setActiveMenu('permissions'); }}
          className={`cursor-pointer w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg font-small transition-colors ${activeMenu === 'permissions'
              ? 'text-blue-700 bg-blue-50 hover:bg-blue-100'
              : 'text-gray-700 bg-white hover:bg-gray-50'
            }`}
        >
          <span>🛡️</span> Phân quyền
        </button>

        {/* Nút Quản lý Roles (CRUD) */}
        <button
          onClick={() => {
            const next = !showRoleManager;
            setShowRoleManager(next);
            setActiveMenu(next ? 'roles' : null);
          }}
          className={`cursor-pointer w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg font-small transition-colors ${activeMenu === 'roles' ? 'text-blue-700 bg-blue-50 hover:bg-blue-100' : 'text-gray-700 bg-white hover:bg-gray-50'
            }`}
        >
          <span>🔑</span> Quản lý Roles
        </button>

        {/* Các nút Placeholder (Chưa có chức năng) */}
        <button className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-gray-600 hover:bg-gray-50 transition-colors opacity-50 cursor-not-allowed">
          <span>📊</span> Báo cáo số liệu
        </button>
        <button className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-gray-600 hover:bg-gray-50 transition-colors opacity-50 cursor-not-allowed">
          <span>⚙️</span> Cài đặt chung
        </button>
      </aside>

      {/* Vùng nội dung chính */}
      <main className="flex-1 p-8">
        {showRoleManager ? (
          <RoleList />
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 h-full flex flex-col items-center justify-center text-center">
            <div className="text-6xl mb-4">👋</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Xin chào Quản trị viên!</h1>
            <p className="text-gray-500 max-w-md">
              Bạn đang ở trong khu vực điều khiển hệ thống YEV.
            </p>
          </div>
        )}
      </main>

      {/* Nhúng Component Popup vào đây */}
      <UserRoleModal
        isOpen={isRoleModalOpen}
        onClose={() => {
          setIsRoleModalOpen(false);
          setActiveMenu(null);
        }}
      />
    </div>
  );
}