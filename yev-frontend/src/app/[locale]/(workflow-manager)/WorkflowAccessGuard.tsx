"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "@/navigation";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasModuleAccess } from "@/modules/auth/lib/permissions";

// Chặn truy cập trực tiếp bằng URL vào /workflow/* nếu user không có permission module Workflow —
// mirror PcAccessGuard.tsx (modules/pc-management).
export default function WorkflowAccessGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const canAccess = hasModuleAccess(user, "Workflow");

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
