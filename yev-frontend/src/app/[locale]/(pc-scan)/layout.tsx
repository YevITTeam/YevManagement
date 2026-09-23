import type { ReactNode } from "react";
import PcAccessGuard from "../(pc-manager)/PcAccessGuard";

export const metadata = {
  title: "Quét kiểm tra Server | YEV Management",
};

// Layout "kiosk" riêng cho trang quét QR (/pc/server-check/scan) — KHÔNG dùng chung layout của
// (pc-manager) vì Sidebar ở đó là `fixed` rộng 13.75rem không có breakpoint mobile, ép nội dung vào
// còn ~155px trên điện thoại (không dùng được — báo cáo thực tế 2026-09-17). Trang quét chỉ dành cho
// nhân viên cầm máy đi quét, không cần thấy menu quản trị (Thiết bị/Báo cáo/IP...) nên bỏ hẳn Sidebar
// thay vì làm nó responsive — Header.tsx cũng đã trừ riêng route này khỏi `hasSidebar`.
// Vẫn giữ `PcAccessGuard` (permission module Asset) để chặn truy cập thẳng URL.
// KHÔNG tự khai h-screen/overflow-y-auto ở đây — xem DESIGN_SYSTEM.md §3 + comment (pc-manager)/layout.tsx.
export default function PcScanLayout({ children }: { children: ReactNode }) {
  return (
    <PcAccessGuard>
      <div className="min-h-full bg-[#f8fafc] px-4 pb-6 pt-4 sm:px-6">
        {children}
      </div>
    </PcAccessGuard>
  );
}
