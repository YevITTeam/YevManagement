import type { ReactNode } from "react";
import Sidebar from "./PcManagerSidebar";

export const metadata = {
  title: "PC Manager | YEV Management",
};

export default function PcManagerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex bg-slate-50 text-slate-900">
      <Sidebar />
      <main className="flex-1 p-6 sm:p-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
