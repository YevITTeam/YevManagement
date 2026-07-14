"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasModuleAccess } from "@/modules/auth/lib/permissions";

// Chặn truy cập trực tiếp bằng URL vào /pc/* nếu user không có permission module Asset (role "Quản lý
// Thiết bị" hoặc "Admin") — bổ sung cho việc ẩn menu ở trang chủ, phòng trường hợp user gõ thẳng URL.
export default function PcAccessGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const canAccess = hasModuleAccess(user, "Asset");

  useEffect(() => {
    if (!isLoading && !canAccess) {
      router.replace("/");
    }
  }, [isLoading, canAccess, router]);

  if (isLoading || !canAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] text-sm text-[#5e3f3a]">
        {isLoading ? "Đang tải..." : "Bạn không có quyền truy cập mục này."}
      </div>
    );
  }

  return <>{children}</>;
}
