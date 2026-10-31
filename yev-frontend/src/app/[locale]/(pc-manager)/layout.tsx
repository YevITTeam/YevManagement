import type { ReactNode } from "react";
import Sidebar from "./PcManagerSidebar";
import PcAccessGuard from "./PcAccessGuard";

export const metadata = {
  title: "PC Manager | YEV Management",
};

// No own height or overflow-y-auto: [locale]/layout.tsx owns the only scroll container; redeclaring it causes double scrollbars.
export default function PcManagerLayout({ children }: { children: ReactNode }) {
  return (
    <PcAccessGuard>
      {/* margin-left is an inline style, so Tailwind print: can't override it; without this the print keeps a blank sidebar gap. */}
      <style>{`@media print { .pc-content-offset { margin-left: 0 !important; } }`}</style>
      <div className="min-h-full bg-[#f7f9fb] text-[#191c1e]">
        <Sidebar />

        <div
          className="pc-content-offset min-h-full transition-[margin-left] duration-200"
          style={{ marginLeft: "var(--sidebar-w, 13.75rem)" }}
        >
          <div className="min-h-full bg-[#f8fafc] px-3 pb-4 pt-3 md:px-4 lg:px-5">
            <div className="mx-auto max-w-[1600px]">{children}</div>
          </div>
        </div>
      </div>
    </PcAccessGuard>
  );
}
