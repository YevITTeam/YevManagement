import type { ReactNode } from "react";
import Sidebar from "./OtManagerSidebar";
import OtAccessGuard from "./OtAccessGuard";

export const metadata = {
  title: "OT Manager | YEV Management",
};

// No own height or overflow-y-auto: [locale]/layout.tsx owns the only scroll container; redeclaring it causes double scrollbars.
export default function OtManagerLayout({ children }: { children: ReactNode }) {
  return (
    <OtAccessGuard>
      <div className="min-h-full bg-[#f7f9fb] text-[#191c1e]">
        <Sidebar />

        <div
          className="min-h-full transition-[margin-left] duration-200 print:ml-0!"
          style={{ marginLeft: "var(--sidebar-w, 13.75rem)" }}
        >
          <div className="min-h-full bg-[#f8fafc] px-4 pb-4 pt-3 md:px-5 md:pb-5 md:pt-3 lg:px-6 lg:pb-6 lg:pt-4 print:p-0">
            <div className="mx-auto max-w-[1600px] print:max-w-none">{children}</div>
          </div>
        </div>
      </div>
    </OtAccessGuard>
  );
}
