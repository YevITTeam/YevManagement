"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Tổng quan", href: "/pc", icon: "◈" },
  { label: "Quản lý Tài sản", href: "/pc", icon: "▣" },
  { label: "Quản lý IP", href: "/pc/ips", icon: "◌" },
  { label: "Cấu hình Hệ thống", href: "/pc/device-types", icon: "⚙" },
  { label: "Nhật ký Hoạt động", href: "/pc/branches", icon: "☰" },
];

export default function PcManagerSidebar() {
  const pathname = usePathname() || "";

  return (
    <aside className="fixed left-0 top-0 z-20 flex h-screen w-64 flex-col border-r border-[#e0e3e5] bg-[#f7f9fb] py-6">
      <div className="px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center bg-[#e3000f] text-lg font-bold text-white">
            Y
          </div>
          <div>
            <div className="text-lg font-semibold text-[#191c1e]">YAZAKI IT</div>
            <div className="text-xs font-medium uppercase tracking-[0.2em] text-[#5e3f3a]">Management Suite</div>
          </div>
        </div>
      </div>

      <nav className="mt-8 flex-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 border-l-4 px-5 py-3 text-sm font-medium transition ${isActive
                  ? "border-[#e3000f] bg-[#eceef0] text-[#191c1e]"
                  : "border-transparent text-[#5e3f3a] hover:bg-[#eceef0] hover:text-[#191c1e]"
                }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-[#e0e3e5] px-5 pt-4">
        <div className="flex items-center gap-3 rounded-none bg-white p-3">
          <div className="flex h-9 w-9 items-center justify-center bg-[#e3000f] text-sm font-semibold text-white">
            QT
          </div>
          <div>
            <div className="text-sm font-semibold text-[#191c1e]">Quản trị viên</div>
            <div className="text-xs text-[#5e3f3a]">Phòng IT</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
