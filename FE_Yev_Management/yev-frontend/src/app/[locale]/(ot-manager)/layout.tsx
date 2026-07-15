import type { ReactNode } from "react";
import Sidebar from "./OtManagerSidebar";
import OtAccessGuard from "./OtAccessGuard";

export const metadata = {
  title: "OT Manager | YEV Management",
};

export default function OtManagerLayout({ children }: { children: ReactNode }) {
  return (
    <OtAccessGuard>
      <div className="max-h-screen bg-[#f7f9fb] text-[#191c1e]">
        <Sidebar />

        <div className="ml-[13.75rem] flex max-h-screen flex-col">
          <main className="flex-1 overflow-y-auto bg-[#f8fafc] px-5 pb-5 pt-3 md:px-8 md:pb-8 md:pt-4 lg:px-10 lg:pb-10 lg:pt-5">
            <div className="mx-auto max-w-[1280px]">{children}</div>
          </main>
        </div>
      </div>
    </OtAccessGuard>
  );
}
