import type { ReactNode } from "react";
import Sidebar from "./WorkflowManagerSidebar";
import WorkflowAccessGuard from "./WorkflowAccessGuard";

export const metadata = {
  title: "Workflow Manager | YEV Management",
};

// KHÔNG tự khai chiều cao / overflow riêng — [locale]/layout.tsx đã giữ vai trò khung + vùng cuộn
// DUY NHẤT của app (mirror (pc-manager)/layout.tsx, xem DESIGN_SYSTEM.md §3).
export default function WorkflowManagerLayout({ children }: { children: ReactNode }) {
  return (
    <WorkflowAccessGuard>
      <div className="min-h-full bg-[#f7f9fb] text-[#191c1e]">
        <Sidebar />

        <div
          className="min-h-full transition-[margin-left] duration-200 print:ml-0!"
          style={{ marginLeft: "var(--sidebar-w, 13.75rem)" }}
        >
          <div className="min-h-full bg-[#f8fafc] px-5 pb-5 pt-3 md:px-8 md:pb-8 md:pt-4 lg:px-10 lg:pb-10 lg:pt-5 print:p-0">
            <div className="mx-auto max-w-[1280px] print:max-w-none">{children}</div>
          </div>
        </div>
      </div>
    </WorkflowAccessGuard>
  );
}
