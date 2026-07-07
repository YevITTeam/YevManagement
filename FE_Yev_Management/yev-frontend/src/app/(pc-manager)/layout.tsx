import type { ReactNode } from "react";
import Sidebar from "./PcManagerSidebar";

export const metadata = {
  title: "PC Manager | YEV Management",
};

export default function PcManagerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="max-h-screen bg-[#f7f9fb] text-[#191c1e]">
      <Sidebar />

      <div className="ml-[13.75rem] flex max-h-screen flex-col">
        <main className="flex-1 overflow-y-auto bg-[#f8fafc] px-5 pb-5 pt-3 md:px-8 md:pb-8 md:pt-4 lg:px-10 lg:pb-10 lg:pt-5">
          <div className="mx-auto max-w-[1280px]">{children}</div>
        </main>
      </div>
    </div>
  );
}