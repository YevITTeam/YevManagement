"use client";

import { useState } from "react";
import { Link, usePathname } from "@/navigation";
import { useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasAnyPermission } from "@/modules/auth/lib/permissions";
import LanguageSwitcher from "@/components/LanguageSwitcher";

// Menu "Admin" hiện ra nếu user có ít nhất 1 permission quản trị Identity (docs/identity-api-fe.md §3 —
// FE ẩn/hiện UI dựa trên user.permissions, không còn dựa vào role "Admin" cứng).
const IDENTITY_ADMIN_PERMISSIONS = [
  "Identity.User.View",
  "Identity.User.UpdateRoles",
  "Identity.Role.View",
  "Identity.Permission.View",
];

export default function Header() {
  const t = useTranslations("Header");
  const pathname = usePathname() || "";
  const hasSidebar = pathname.startsWith("/pc");
  const { user, isLoading, refreshUser } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const canSeeAdmin = hasAnyPermission(user, IDENTITY_ADMIN_PERMISSIONS);

  // Xoá token cũ + đăng nhập lại — dùng khi Admin vừa cấp quyền mới cho Role của mình và cần thấy hiệu
  // lực ngay trên UI (nút bấm/menu ẩn hiện theo permissions), thay vì phải tự đóng tab/mở lại.
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
    <header
      className={`sticky top-0 z-30 border-b border-[#e0e3e5] bg-[#f7f9fb]/95 backdrop-blur transition-all duration-300 ${hasSidebar ? "w-[calc(100%-13.75rem)] ml-auto" : "w-full"
        }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center bg-[#e3000f] text-lg font-bold text-white shadow-sm">
            Y
          </div>
          <div className="leading-tight">
            <div className="text-base font-semibold text-[#191c1e]">{t("productName")}</div>
            <div className="text-xs font-medium uppercase tracking-[0.2em] text-[#5e3f3a]">
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
                className="cursor-pointer flex items-center gap-2 rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm font-semibold text-[#5e3f3a] transition hover:border-[#e3000f]/30 hover:text-[#e3000f] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">{t("refreshPermissions")}</span>
              </button>

              {canSeeAdmin && (
                <Link
                  href="/admin"
                  className="hidden items-center gap-2 rounded-lg border border-[#e3000f]/15 bg-[#fff5f5] px-3 py-2 text-sm font-semibold text-[#e3000f] transition hover:border-[#e3000f]/30 hover:bg-[#ffe8e8] sm:flex"
                >
                  <span className="text-base">⚙</span>
                  <span>{t("admin")}</span>
                </Link>
              )}

              <div className="flex items-center gap-3 border-l border-[#e0e3e5] pl-3">
                <div className="text-right">
                  <p className="text-sm font-semibold text-[#191c1e]">{user.fullName}</p>
                  <p className="text-xs text-[#5e3f3a]">{user.userName}</p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#191c1e] text-sm font-semibold text-white">
                  {user.fullName?.charAt(0)?.toUpperCase() ?? "U"}
                </div>
              </div>
            </>
          ) : (
            <span className="text-sm font-medium text-[#5e3f3a]">{t("notLoggedIn")}</span>
          )}
        </div>
      </div>
    </header>
  );
}