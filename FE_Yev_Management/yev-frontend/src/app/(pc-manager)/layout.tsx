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
        <main className="flex-1 overflow-y-auto bg-[#f8fafc] p-6 md:p-8 lg:p-10">
          <div className="mx-auto max-w-[1280px]">{children}</div>
        </main>
      </div>
    </div>
  );
}