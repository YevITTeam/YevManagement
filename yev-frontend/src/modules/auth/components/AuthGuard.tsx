"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "@/navigation";
import { useAuth } from "@/modules/auth/context/AuthContext";

const isLoginPath = (pathname: string) => pathname === "/login" || pathname.startsWith("/login/");

// Email-link routes authenticate via the URL token (BE [AllowAnonymous]); forcing SPA login here would defeat email approval.
const PUBLIC_CONFIRM_PATHS = [
    "/xac-nhan-don",
    "/xac-nhan-chu-ky",
    "/xac-nhan-don-tong",
    "/xac-nhan-mat-khau-cap-2",
    "/xac-nhan-chu-ky-quy-trinh",
    "/xac-nhan-don-quy-trinh",
];

const isPublicConfirmPath = (pathname: string) =>
    PUBLIC_CONFIRM_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

// Site-wide login gate (module guards handle permissions); `?redirect=` lets LoginForm return the user afterwards.
export default function AuthGuard({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname() || "";
    const { user, isLoading } = useAuth();
    const onLoginPage = isLoginPath(pathname);
    const onPublicConfirmPage = isPublicConfirmPath(pathname);

    useEffect(() => {
        if (onPublicConfirmPage) return;
        if (isLoading) return;
        if (!user && !onLoginPage) {
            const redirectTarget = pathname || "/";
            router.replace(`/login?redirect=${encodeURIComponent(redirectTarget)}`);
        } else if (user && onLoginPage) {
            router.replace("/");
        }
    }, [isLoading, user, onLoginPage, onPublicConfirmPage, pathname, router]);

    // Don't wait for auth: these pages must work in any session state.
    if (onPublicConfirmPage) {
        return <>{children}</>;
    }

    if (isLoading || (!user && !onLoginPage) || (user && onLoginPage)) {
        return (
            <div className="flex min-h-full items-center justify-center bg-[#f8fafc] text-sm text-[#5e3f3a]">
                Đang tải...
            </div>
        );
    }

    return <>{children}</>;
}
