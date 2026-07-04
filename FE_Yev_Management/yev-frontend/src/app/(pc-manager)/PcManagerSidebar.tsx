"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Thiết bị", href: "/pc" },
  { label: "Chi nhánh", href: "/pc/branches" },
  { label: "Loại thiết bị", href: "/pc/device-types" },
  { label: "IP", href: "/pc/ips" },
  { label: "Phần mềm", href: "/pc/softwares" },
  { label: "Nhà cung cấp", href: "/pc/suppliers" },
];

export default function PcManagerSidebar() {
  const pathname = usePathname() || "";

  return (
    <aside className="w-60 shrink-0 border-r border-slate-200 bg-white shadow-sm">
      <div className="flex h-full flex-col justify-between">
        <div>
          <div className="border-b border-slate-200 px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">PC Manager</p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900">Quan ly PC</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Dieu huong nhanh den cac trang quan ly thiet bi, chi nhanh, IP, phan mem va nha cung cap.
            </p>
          </div>

          <nav className="px-4 py-6">
            <div className="space-y-2">
              {navItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block rounded-2xl px-4 py-3 text-sm font-medium transition ${isActive
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>

        <div className="border-t border-slate-200 px-6 py-5 bg-slate-50">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Ban mau giao dien</p>
          <p className="mt-2 text-sm text-slate-600">Du lieu mock de hoan thien giao dien truoc khi ket noi API.</p>
        </div>
      </div>
    </aside>
  );
}
