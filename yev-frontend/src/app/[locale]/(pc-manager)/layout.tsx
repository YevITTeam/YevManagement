import type { ReactNode } from "react";
import Sidebar from "./PcManagerSidebar";
import PcAccessGuard from "./PcAccessGuard";

export const metadata = {
  title: "PC Manager | YEV Management",
};

// KHÔNG tự khai chiều cao (`h-screen`/`max-h-screen`) và KHÔNG tự mở `overflow-y-auto` ở đây —
// `[locale]/layout.tsx` đã giữ vai trò khung chiều cao + vùng cuộn DUY NHẤT của app. Khai lại ở tầng
// này chính là nguyên nhân lỗi "2 thanh cuộn chồng nhau, nội dung bị cắt/che" đã gặp bên module OT.
// Xem DESIGN_SYSTEM.md §3.
export default function PcManagerLayout({ children }: { children: ReactNode }) {
  return (
    <PcAccessGuard>
      <div className="min-h-full bg-[#f7f9fb] text-[#191c1e]">
        <Sidebar />

        <div
          className="min-h-full transition-[margin-left] duration-200"
          style={{ marginLeft: "var(--sidebar-w, 13.75rem)" }}
        >
          <div className="min-h-full bg-[#f8fafc] px-5 pb-5 pt-3 md:px-8 md:pb-8 md:pt-4 lg:px-10 lg:pb-10 lg:pt-5">
            <div className="mx-auto max-w-[1280px]">{children}</div>
          </div>
        </div>
      </div>
    </PcAccessGuard>
  );
}
