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
      {/* Sidebar tự ẩn khi in (print:hidden) nhưng margin-left bên dưới là inline style (biến
          --sidebar-w) nên class Tailwind `print:` không thắng nổi — phải override riêng bằng
          <style> mới đủ specificity, nếu không bản in sẽ có 1 dải trắng rộng 13.75rem bên trái do
          Sidebar đã ẩn nhưng chỗ nó chừa ra thì chưa. */}
      <style>{`@media print { .pc-content-offset { margin-left: 0 !important; } }`}</style>
      <div className="min-h-full bg-[#f7f9fb] text-[#191c1e]">
        <Sidebar />

        <div
          className="pc-content-offset min-h-full transition-[margin-left] duration-200"
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
