"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "@/navigation";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasAnyPermission, hasPermission, IDENTITY_ADMIN_PERMISSIONS } from "@/modules/auth/lib/permissions";

// Blocks direct URL access to /admin/* without any Identity admin permission.
export default function AdminAccessGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const canAccess = hasAnyPermission(user, IDENTITY_ADMIN_PERMISSIONS);

  useEffect(() => {
    if (!isLoading && !canAccess) {
      router.replace("/");
    }
  }, [isLoading, canAccess, router]);

  if (isLoading || !canAccess) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[#f8fafc] text-sm text-[#5e3f3a]">
        {isLoading ? "Đang tải..." : "Bạn không có quyền truy cập mục này."}
      </div>
    );
  }

  return <>{children}</>;
}

// Per-page gate: users with permission for another admin page can't reach this one by URL.
export function AdminPageGate({ permission, children }: { permission: string; children: ReactNode }) {
  const { user } = useAuth();
  if (!hasPermission(user, permission)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center rounded-xl border border-[#e0e3e5] bg-white p-8 text-sm text-[#5e3f3a] shadow-sm">
        Bạn không có quyền truy cập mục này.
      </div>
    );
  }
  return <>{children}</>;
}
