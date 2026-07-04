import type { ReactNode } from "react";
import Sidebar from "./PcManagerSidebar";

export const metadata = {
  title: "PC Manager | YEV Management",
};

export default function PcManagerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f7f9fb] text-[#191c1e]">
      <Sidebar />

      <div className="ml-64 flex min-h-screen flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[#e0e3e5] bg-[#f7f9fb]/95 px-6 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="hidden md:block">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#5e3f3a]">Yazaki IT</p>
              <h2 className="text-lg font-semibold text-[#191c1e]">Management Suite</h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="hidden w-80 items-center gap-2 rounded-none border border-[#e0e3e5] bg-white px-3 py-2 md:flex">
              <span className="text-lg text-[#5e3f3a]">⌕</span>
              <input
                placeholder="Tìm kiếm tài sản, cấu hình..."
                className="w-full border-0 bg-transparent text-sm outline-none placeholder:text-[#5e3f3a]/50"
              />
            </label>
            <button className="rounded-none border border-[#e0e3e5] bg-white p-2 text-[#5e3f3a] transition hover:text-[#b40009]">
              🔔
            </button>
            <button className="rounded-none border border-[#e0e3e5] bg-white p-2 text-[#5e3f3a] transition hover:text-[#b40009]">
              👤
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-[#f8fafc] p-6 md:p-8 lg:p-10">
          <div className="mx-auto max-w-[1280px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
