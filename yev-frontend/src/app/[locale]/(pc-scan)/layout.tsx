import type { ReactNode } from "react";
import PcAccessGuard from "../(pc-manager)/PcAccessGuard";

export const metadata = {
  title: "Quét kiểm tra Server | YEV Management",
};

// Kiosk layout without the Sidebar: the fixed 13.75rem sidebar has no mobile breakpoint and squeezes the scan page on phones.
// Still behind PcAccessGuard; no own h-screen/overflow-y-auto (see DESIGN_SYSTEM.md §3).
export default function PcScanLayout({ children }: { children: ReactNode }) {
  return (
    <PcAccessGuard>
      <div className="min-h-full bg-[#f8fafc] px-4 pb-6 pt-4 sm:px-6">
        {children}
      </div>
    </PcAccessGuard>
  );
}
