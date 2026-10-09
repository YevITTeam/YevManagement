"use client";

import { Link, usePathname } from "@/navigation";
import { useTranslations } from "next-intl";
import { LayoutGrid, PanelLeftClose } from "lucide-react";
import { useSidebarCollapse } from "@/modules/common/hooks/useSidebarCollapse";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";
import { adminNavItems } from "@/modules/auth/lib/adminNav";
import BrandLogo from "@/components/common/BrandLogo";

export default function AdminSidebar() {
  const t = useTranslations("Navigation");
  const pathname = usePathname() || "";
  const { user } = useAuth();
  const { collapsed, toggle } = useSidebarCollapse();

  const items = [
    { key: "adminOverview" as const, href: "/admin", icon: LayoutGrid },
    ...adminNavItems.filter((item) => hasPermission(user, item.permission)),
  ];

  const linkClassName = (isActive: boolean) =>
    collapsed
      ? `flex min-w-0 items-center justify-center gap-3 border-l-4 py-3 text-sm font-medium transition ${
          isActive
            ? "border-[#e3000f] bg-[#eceef0] text-[#191c1e]"
            : "border-transparent text-[#5e3f3a] hover:bg-[#eceef0] hover:text-[#191c1e]"
        }`
      : `flex min-w-0 items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ${
          isActive ? "bg-[#eceef0] text-[#191c1e]" : "text-[#5e3f3a] hover:bg-[#eceef0] hover:text-[#191c1e]"
        }`;

  return (
    <aside
      className={`print:hidden fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-[#e0e3e5] bg-[#f7f9fb] py-4 transition-[width] duration-200 ${
        collapsed ? "w-[4.5rem]" : "w-[13.75rem]"
      }`}
    >
      <div className={`flex items-center ${collapsed ? "justify-center px-2" : "justify-between px-5"}`}>
        {collapsed ? (
          <button
            type="button"
            onClick={toggle}
            title={t("expandSidebar")}
            aria-label={t("expandSidebar")}
            className="cursor-pointer flex h-8 w-8 shrink-0 items-center justify-center transition hover:opacity-90"
          >
            <BrandLogo />
          </button>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <BrandLogo className="h-8 w-10" />
              <div>
                <div className="text-base font-semibold leading-tight text-[#191c1e]">YEV IT</div>
                <div className="whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.12em] text-[#5e3f3a]">
                  {t("adminManagerTagline")}
                </div>
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

      <nav className={`mt-4 flex-1 space-y-0.5 overflow-y-auto overflow-x-clip ${collapsed ? "" : "px-3"}`}>
        {items.map((item) => {
          const isActive = item.href === "/admin" ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link key={item.key} href={item.href} prefetch={false} title={t(item.key)} className={linkClassName(isActive)}>
              <item.icon size={18} className={`shrink-0 ${isActive ? "text-[#e3000f]" : "text-[#8a8f94]"}`} />
              {!collapsed && <span className="truncate">{t(item.key)}</span>}
            </Link>
          );
        })}
      </nav>

      <div className={`mt-auto border-t border-[#e0e3e5] pt-3 ${collapsed ? "px-2" : "px-5"}`}>
        {collapsed ? (
          <div className="flex justify-center">
            <div className="flex h-9 w-9 items-center justify-center bg-[#e3000f] text-sm font-semibold text-white" title="Quản trị viên">
              QT
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-none bg-white p-3">
            <div className="flex h-9 w-9 items-center justify-center bg-[#e3000f] text-sm font-semibold text-white">QT</div>
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
