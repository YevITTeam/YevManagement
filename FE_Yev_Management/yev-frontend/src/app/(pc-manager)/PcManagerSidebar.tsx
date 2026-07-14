"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Computer,
  HardDrive,
  Monitor,
  Package,
  ShieldCheck,
  Flag,
  Users,
  Layers,
  Settings,
} from "lucide-react";

const navItems = [
  { label: "Quản lý Thiết bị", href: "/pc", icon: Computer },
  { label: "Báo cáo thống kê", href: "/pc/reports", icon: Flag },
  { label: "Quản lý IP", href: "/pc/ips", icon: Monitor },
  { label: "Quản lý loại thiết bị", href: "/pc/device-types", icon: HardDrive },
  { label: "Quản lý chi nhánh", href: "/pc/branches", icon: Building2 },
  { label: "Quản lý nhóm", href: "/pc/device-groups", icon: Layers },
  { label: "Quản lý bộ phận", href: "/pc/device-departments", icon: Users },
  { label: "Quản lý phần mềm", href: "/pc/softwares", icon: ShieldCheck },
  { label: "Quản lý nhà cung cấp", href: "/pc/suppliers", icon: Package },
  { label: "Cài đặt hệ thống", href: "/pc/settings", icon: Settings },
];

export default function PcManagerSidebar() {
  const pathname = usePathname() || "";

  return (
    // Trích xuất phần khai báo aside trong PcManagerSidebar.tsx
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-[13.75rem] flex-col border-r border-[#e0e3e5] bg-[#f7f9fb] py-6">
      <div className="px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center bg-[#e3000f] text-lg font-bold text-white">
            Y
          </div>
          <div>
            <div className="text-lg font-semibold text-[#191c1e]">YEV IT</div>
            <div className="text-xs font-medium uppercase tracking-[0.2em] text-[#5e3f3a]">Quản lý PC</div>
          </div>
        </div>
      </div>

      <nav className="mt-8 flex-1 overflow-y-auto">
        {navItems.map((item) => {
          // Logic tách riêng cho route gốc "/pc" để tránh highlight sai ở các route con
          const isActive = item.href === "/pc"
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.label} // Sử dụng item.label làm key để tránh lỗi trùng lặp key nếu có href giống nhau
              href={item.href}
              className={`flex items-center gap-3 border-l-4 px-5 py-3 text-sm font-medium transition ${isActive
                ? "border-[#e3000f] bg-[#eceef0] text-[#191c1e]"
                : "border-transparent text-[#5e3f3a] hover:bg-[#eceef0] hover:text-[#191c1e]"
                }`}
            >
              <item.icon
                size={18}
                className={isActive ? "text-[#e3000f]" : "text-[#5e3f3a]"}
              />
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