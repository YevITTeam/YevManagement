"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter, usePathname } from "@/navigation";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasModuleAccess } from "@/modules/auth/lib/permissions";

// "Lũy kế của tôi" (docs/attendance-api-fe.md §3.6/§1.4) không gắn permission Attendance nào — bất kỳ
// user đăng nhập nào cũng dùng được, kể cả không có Role nghiệp vụ nào — nên bỏ qua kiểm tra module bên dưới.
const MODULE_CHECK_EXEMPT_PATHS = ["/ot/accumulation"];

// Chặn truy cập trực tiếp bằng URL vào /ot/* nếu user không có permission module Attendance —
// mirror PcAccessGuard.tsx (src/app/[locale]/(pc-manager)/PcAccessGuard.tsx).
export default function OtAccessGuard({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname() || "";
    const { user, isLoading } = useAuth();
    const isExempt = MODULE_CHECK_EXEMPT_PATHS.some((path) => pathname === path || pathname.startsWith(path + "/"));
    const canAccess = isExempt || hasModuleAccess(user, "Attendance");

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
