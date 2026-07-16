"use client";

import { Link, usePathname } from "@/navigation";
import { useTranslations } from "next-intl";
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
  PanelLeftClose,
} from "lucide-react";
import { useSidebarCollapse } from "@/modules/common/hooks/useSidebarCollapse";

const navItems = [
  { key: "devices", href: "/pc", icon: Computer },
  { key: "reports", href: "/pc/reports", icon: Flag },
  { key: "ips", href: "/pc/ips", icon: Monitor },
  { key: "deviceTypes", href: "/pc/device-types", icon: HardDrive },
  { key: "branches", href: "/pc/branches", icon: Building2 },
  { key: "deviceGroups", href: "/pc/device-groups", icon: Layers },
  { key: "deviceDepartments", href: "/pc/device-departments", icon: Users },
  { key: "softwares", href: "/pc/softwares", icon: ShieldCheck },
  { key: "suppliers", href: "/pc/suppliers", icon: Package },
  { key: "settings", href: "/pc/settings", icon: Settings },
] as const;

export default function PcManagerSidebar() {
  const t = useTranslations("Navigation");
  const pathname = usePathname() || "";
  const { collapsed, toggle } = useSidebarCollapse();

  return (
    // Trích xuất phần khai báo aside trong PcManagerSidebar.tsx
    <aside
      className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-[#e0e3e5] bg-[#f7f9fb] py-6 transition-[width] duration-200 ${collapsed ? "w-[4.5rem]" : "w-[13.75rem]"
        }`}
    >
      <div className={`flex items-center ${collapsed ? "justify-center px-2" : "justify-between px-5"}`}>
        {collapsed ? (
          <button
            type="button"
            onClick={toggle}
            title={t("expandSidebar")}
            aria-label={t("expandSidebar")}
            className="cursor-pointer flex h-10 w-10 shrink-0 items-center justify-center bg-[#e3000f] text-lg font-bold text-white transition hover:opacity-90"
          >
            Y
          </button>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#e3000f] text-lg font-bold text-white">
                Y
              </div>
              <div>
                <div className="text-lg font-semibold text-[#191c1e]">YEV IT</div>
                <div className="text-xs font-medium uppercase tracking-[0.2em] text-[#5e3f3a]">{t("pcManagerTagline")}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={toggle}
              title={t("collapseSidebar")}
              aria-label={t("collapseSidebar")}
              className="cursor-pointer flex h-8 w-8 shrink-0 items-center justify-center text-[#5e3f3a] transition hover:bg-[#eceef0] hover:text-[#191c1e]"
            >
              <PanelLeftClose size={18} />
            </button>
          </>
        )}
      </div>

      <nav className="mt-8 flex-1 overflow-y-auto overflow-x-hidden">
        {navItems.map((item) => {
          // Logic tách riêng cho route gốc "/pc" để tránh highlight sai ở các route con
          const isActive = item.href === "/pc"
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.key}
              href={item.href}
              title={collapsed ? t(item.key) : undefined}
              className={`flex items-center gap-3 border-l-4 py-3 text-sm font-medium transition ${collapsed ? "justify-center px-0" : "px-5"
                } ${isActive
                  ? "border-[#e3000f] bg-[#eceef0] text-[#191c1e]"
                  : "border-transparent text-[#5e3f3a] hover:bg-[#eceef0] hover:text-[#191c1e]"
                }`}
            >
              <item.icon
                size={18}
                className={isActive ? "text-[#e3000f]" : "text-[#5e3f3a]"}
              />
              {!collapsed && <span>{t(item.key)}</span>}
            </Link>
          );
        })}
      </nav>

      <div className={`mt-auto border-t border-[#e0e3e5] pt-4 ${collapsed ? "px-2" : "px-5"}`}>
        {collapsed ? (
          <div className="flex justify-center">
            <div
              className="flex h-9 w-9 items-center justify-center bg-[#e3000f] text-sm font-semibold text-white"
              title="Quản trị viên"
            >
              QT
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-none bg-white p-3">
            <div className="flex h-9 w-9 items-center justify-center bg-[#e3000f] text-sm font-semibold text-white">
              QT
            </div>
            <div>
              <div className="text-sm font-semibold text-[#191c1e]">Quản trị viên</div>
              <div className="text-xs text-[#5e3f3a]">Phòng IT</div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}