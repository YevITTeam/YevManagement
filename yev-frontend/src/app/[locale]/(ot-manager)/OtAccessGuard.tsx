"use client";

import { useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/navigation";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasAnyPermission, hasModuleAccess } from "@/modules/auth/lib/permissions";
import { OT_ROUTE_PERMISSIONS } from "@/modules/attendance/lib/otRoutePermissions";

// Blocks direct URL access to /ot/* without any Attendance permission.
export default function OtAccessGuard({ children }: { children: ReactNode }) {
    const router = useRouter();
    const t = useTranslations("Attendance.OtHome");
    const tCommon = useTranslations("Common");
    const { user, isLoading } = useAuth();
    const pathname = usePathname() || "";
    // Page-level permissions shared with the sidebar (otRoutePermissions.ts), so direct URLs are blocked too.
    const routeRule = OT_ROUTE_PERMISSIONS.find((rule) => pathname === rule.prefix || pathname.startsWith(rule.prefix + "/"));
    const canAccess = hasModuleAccess(user, "Attendance") && (!routeRule || hasAnyPermission(user, routeRule.permissions));

    useEffect(() => {
        if (!isLoading && !canAccess) {
            router.replace("/");
        }
    }, [isLoading, canAccess, router]);

    if (isLoading || !canAccess) {
        // min-h-full, not min-h-screen: <main> is already viewport minus Header, 100vh would overflow by the Header height.
        return (
            <div className="flex min-h-full items-center justify-center bg-[#f8fafc] text-sm text-[#5e3f3a]">
                {isLoading ? tCommon("loading") : t("noAccess")}
            </div>
        );
    }

    return <>{children}</>;
}
