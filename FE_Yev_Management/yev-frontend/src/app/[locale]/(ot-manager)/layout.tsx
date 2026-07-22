import type { ReactNode } from "react";
import Sidebar from "./OtManagerSidebar";
import OtAccessGuard from "./OtAccessGuard";

export const metadata = {
  title: "OT Manager | YEV Management",
};

export default function OtManagerLayout({ children }: { children: ReactNode }) {
  return (
    <OtAccessGuard>
      <div className="max-h-screen bg-[#f7f9fb] text-[#191c1e] print:max-h-none">
        <Sidebar />

        <div
          className="flex max-h-screen flex-col transition-[margin-left] duration-200 print:ml-0! print:max-h-none"
          style={{ marginLeft: "var(--sidebar-w, 13.75rem)" }}
        >
          <main className="flex-1 overflow-y-auto bg-[#f8fafc] px-5 pb-5 pt-3 md:px-8 md:pb-8 md:pt-4 lg:px-10 lg:pb-10 lg:pt-5 print:overflow-visible print:p-0">
            <div className="mx-auto max-w-[1280px] print:max-w-none">{children}</div>
          </main>
        </div>
      </div>
    </OtAccessGuard>
  );
}
