"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { AuthApi } from "@/modules/auth/api/auth.api";
import type { UserDto } from "@/modules/auth/types/auth.dto";

const AUTH_TOKEN_KEY = "yev_auth_token";

export default function Header() {
  const pathname = usePathname() || "";
  const hasSidebar = pathname.startsWith("/pc");
  const [user, setUser] = useState<UserDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      if (typeof window === "undefined") {
        setIsLoading(false);
        return;
      }

      try {
        const response = await AuthApi.windowsLogin();
        setUser(response);
      } catch (error) {
        console.error("Lỗi lấy thông tin:", error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, []);

  const isAdmin = user?.roles?.includes("Admin");

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
            <div className="text-base font-semibold text-[#191c1e]">YEV Management</div>
            <div className="text-xs font-medium uppercase tracking-[0.2em] text-[#5e3f3a]">
              Asset Management Suite
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          {isLoading ? (
            <div className="h-9 w-40 animate-pulse rounded-md bg-[#eceef0]" />
          ) : user ? (
            <>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="hidden items-center gap-2 rounded-none border border-[#e3000f]/15 bg-[#fff5f5] px-3 py-2 text-sm font-semibold text-[#e3000f] transition hover:border-[#e3000f]/30 hover:bg-[#ffe8e8] sm:flex"
                >
                  <span className="text-base">⚙</span>
                  <span>Admin</span>
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
            <span className="text-sm font-medium text-[#5e3f3a]">Chưa đăng nhập</span>
          )}
        </div>
      </div>
    </header>
  );
}