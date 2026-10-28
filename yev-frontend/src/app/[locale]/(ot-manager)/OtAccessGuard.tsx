"use client";

import { useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/navigation";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasAnyPermission, hasModuleAccess } from "@/modules/auth/lib/permissions";
import { OT_ROUTE_PERMISSIONS } from "@/modules/attendance/lib/otRoutePermissions";

// Chặn truy cập trực tiếp bằng URL vào /ot/* nếu user không có permission module Attendance —
// mirror PcAccessGuard.tsx (src/app/[locale]/(pc-manager)/PcAccessGuard.tsx).
export default function OtAccessGuard({ children }: { children: ReactNode }) {
    const router = useRouter();
    const t = useTranslations("Attendance.OtHome");
    const tCommon = useTranslations("Common");
    const { user, isLoading } = useAuth();
    const pathname = usePathname() || "";
    // Ngoài quyền module, từng trang còn phải đủ quyền riêng của nó (vào thẳng URL cũng bị chặn, không
    // chỉ ẩn menu) — bảng quyền dùng chung với sidebar, xem otRoutePermissions.ts.
    const routeRule = OT_ROUTE_PERMISSIONS.find((rule) => pathname === rule.prefix || pathname.startsWith(rule.prefix + "/"));
    const canAccess = hasModuleAccess(user, "Attendance") && (!routeRule || hasAnyPermission(user, routeRule.permissions));

    useEffect(() => {
        if (!isLoading && !canAccess) {
            router.replace("/");
        }
    }, [isLoading, canAccess, router]);

    if (isLoading || !canAccess) {
        // min-h-full (không phải min-h-screen) — đã nằm trong <main> cao 1 màn hình trừ Header ở
        // [locale]/layout.tsx; khai 100vh ở đây sẽ dôi ra đúng bằng chiều cao Header.
        return (
            <div className="flex min-h-full items-center justify-center bg-[#f8fafc] text-sm text-[#5e3f3a]">
                {isLoading ? tCommon("loading") : t("noAccess")}
            </div>
        );
    }

    return <>{children}</>;
}
