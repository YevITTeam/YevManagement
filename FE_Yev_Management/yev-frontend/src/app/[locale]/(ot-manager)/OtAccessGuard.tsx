"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "@/navigation";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasModuleAccess } from "@/modules/auth/lib/permissions";

// Chặn truy cập trực tiếp bằng URL vào /ot/* nếu user không có permission module Attendance —
// mirror PcAccessGuard.tsx (src/app/[locale]/(pc-manager)/PcAccessGuard.tsx).
export default function OtAccessGuard({ children }: { children: ReactNode }) {
    const router = useRouter();
    const { user, isLoading } = useAuth();
    const canAccess = hasModuleAccess(user, "Attendance");

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
