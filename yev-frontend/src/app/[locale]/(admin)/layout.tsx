import type { ReactNode } from "react";
import Sidebar from "./AdminSidebar";
import AdminAccessGuard from "./AdminAccessGuard";

export const metadata = {
  title: "Admin | YEV Management",
};

// KHÔNG tự khai chiều cao / overflow riêng — [locale]/layout.tsx đã giữ vai trò khung + vùng cuộn
// DUY NHẤT của app (mirror (pc-manager)/layout.tsx, xem DESIGN_SYSTEM.md §3).
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminAccessGuard>
      <div className="min-h-full bg-[#f7f9fb] text-[#191c1e]">
        <Sidebar />

        <div
          className="min-h-full transition-[margin-left] duration-200 print:ml-0!"
          style={{ marginLeft: "var(--sidebar-w, 13.75rem)" }}
        >
          <div className="min-h-full bg-[#f8fafc] px-4 pb-4 pt-3 md:px-5 md:pb-5 md:pt-3 lg:px-6 lg:pb-6 lg:pt-4">
            <div className="mx-auto max-w-[1600px]">{children}</div>
          </div>
        </div>
      </div>
    </AdminAccessGuard>
  );
}
