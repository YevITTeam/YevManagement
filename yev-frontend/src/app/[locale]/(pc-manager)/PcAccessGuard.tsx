"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "@/navigation";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasModuleAccess } from "@/modules/auth/lib/permissions";

// Blocks direct URL access to /pc/* without any Asset permission; hiding the menu alone isn't enough.
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
    // min-h-full, not min-h-screen: <main> is already viewport minus Header, 100vh would overflow by the Header height.
    return (
      <div className="flex min-h-full items-center justify-center bg-[#f8fafc] text-sm text-[#5e3f3a]">
        {isLoading ? "Đang tải..." : "Bạn không có quyền truy cập mục này."}
      </div>
    );
  }

  return <>{children}</>;
}
