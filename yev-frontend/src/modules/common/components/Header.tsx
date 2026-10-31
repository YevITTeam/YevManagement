"use client";

import { useState } from "react";
import { Link, useRouter, usePathname } from "@/navigation";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronUp, LogOut, RefreshCw, Settings } from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasAnyPermission, IDENTITY_ADMIN_PERMISSIONS } from "@/modules/auth/lib/permissions";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import BrandLogo from "@/components/common/BrandLogo";
import { useHeaderCollapse } from "@/modules/common/hooks/useHeaderCollapse";

export default function Header() {
  const t = useTranslations("Header");
  const pathname = usePathname() || "";
  // Scan pages use a kiosk layout without Sidebar ((pc-scan)/layout.tsx); excluding them avoids a phantom left gap.
  const hasSidebar =
    (pathname.startsWith("/pc") &&
      !pathname.startsWith("/pc/server-check/scan") &&
      !pathname.startsWith("/pc/inventory/scan")) ||
    pathname.startsWith("/ot") ||
    pathname.startsWith("/workflow");
  const { user, isLoading, refreshUser, logout } = useAuth();
  const { collapsed, toggle } = useHeaderCollapse();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const router = useRouter();

  const canSeeAdmin = hasAnyPermission(user, IDENTITY_ADMIN_PERMISSIONS);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  // Lets an admin see newly granted role permissions immediately without reopening the tab.
  const handleRefreshPermissions = async () => {
    setIsRefreshing(true);
    try {
      await refreshUser();
      toast.success("Đã làm mới quyền — vui lòng thử lại thao tác vừa rồi.");
    } catch {
      toast.error("Không thể làm mới quyền. Vui lòng thử lại.");
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <>
      {/* Collapsed: only a small top-right tab remains so content gets the full height. */}
      {collapsed && (
        <button
          type="button"
          onClick={toggle}
          title={t("showHeader")}
          aria-label={t("showHeader")}
          className="print:hidden fixed right-4 top-0 z-40 flex h-5 w-10 cursor-pointer items-center justify-center rounded-b-md border border-t-0 border-[#e0e3e5] bg-white text-[#5e3f3a] shadow-sm transition hover:text-[#e3000f]"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      )}
    <header
      className={`print:hidden sticky top-0 z-30 overflow-hidden bg-[#f7f9fb]/95 backdrop-blur transition-all duration-300 ${collapsed ? "h-0 border-b-0" : "h-12 border-b border-[#e0e3e5]"} ${hasSidebar ? "w-[calc(100%-13.75rem)] ml-auto" : "w-full"
        }`}
      aria-hidden={collapsed}
    >
      <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* No prefetch: with static export + [locale], RSC payload URLs don't match the files in out/ and 404. */}
        <Link href="/" prefetch={false} className="flex items-center gap-3">
          <BrandLogo className="h-8 w-10" />
          <div className="leading-tight">
            <div className="text-sm font-semibold text-[#191c1e]">{t("productName")}</div>
            <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#5e3f3a]">
              {t("tagline")}
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <LanguageSwitcher />

          {isLoading ? (
            <div className="h-9 w-40 animate-pulse rounded-md bg-[#eceef0]" />
          ) : user ? (
            <>
              <button
                type="button"
                onClick={handleRefreshPermissions}
                disabled={isRefreshing}
                title={t("refreshPermissionsTitle")}
                className="cursor-pointer flex items-center gap-2 rounded-lg border border-[#e0e3e5] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#5e3f3a] transition hover:border-[#e3000f]/30 hover:text-[#e3000f] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">{t("refreshPermissions")}</span>
              </button>

              {canSeeAdmin && (
                <Link
                  href="/admin"
                  // No prefetch: with static export + [locale], RSC payload URLs don't match the files in out/ and 404.
                  prefetch={false}
                  className="hidden items-center gap-2 rounded-lg border border-[#e3000f]/15 bg-[#fff5f5] px-2.5 py-1.5 text-xs font-semibold text-[#e3000f] transition hover:border-[#e3000f]/30 hover:bg-[#ffe8e8] sm:flex"
                >
                  <Settings className="h-4 w-4" />
                  <span>{t("admin")}</span>
                </Link>
              )}

              <div className="flex items-center gap-3 border-l border-[#e0e3e5] pl-3">
                <div className="text-right">
                  <p className="text-xs font-semibold leading-tight text-[#191c1e]">{user.fullName}</p>
                  <p className="text-[11px] leading-tight text-[#5e3f3a]">{user.userName}</p>
                </div>

                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#191c1e] text-xs font-semibold text-white">
                  {user.fullName?.charAt(0)?.toUpperCase() ?? "U"}
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  title={t("logout")}
                  className="cursor-pointer flex items-center gap-1.5 rounded-lg border border-transparent p-2 text-[#5e3f3a] transition hover:border-[#e0e3e5] hover:text-[#e3000f]"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="sr-only">{t("logout")}</span>
                </button>

                <button
                  type="button"
                  onClick={toggle}
                  title={t("hideHeader")}
                  aria-label={t("hideHeader")}
                  className="cursor-pointer flex items-center rounded-lg border border-transparent p-2 text-[#5e3f3a] transition hover:border-[#e0e3e5] hover:text-[#191c1e]"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
              </div>
            </>
          ) : (
            <span className="text-sm font-medium text-[#5e3f3a]">{t("notLoggedIn")}</span>
          )}
        </div>
      </div>
    </header>
    </>
  );
}