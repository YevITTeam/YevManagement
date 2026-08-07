"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "@/navigation";
import { useAuth } from "@/modules/auth/context/AuthContext";

const isLoginPath = (pathname: string) => pathname === "/login" || pathname.startsWith("/login/");

// Chặn truy cập toàn site khi chưa đăng nhập — mirror OtAccessGuard/PcAccessGuard (chặn theo module),
// nhưng ở đây chặn theo trạng thái đăng nhập, áp dụng cho MỌI route trừ /login. `/login` là lối thoát
// duy nhất: user đã đăng nhập lỡ vào lại /login thì đẩy về trang chủ, chưa đăng nhập vào trang khác
// thì đẩy sang /login (giữ ?redirect= để LoginForm quay lại đúng chỗ sau khi đăng nhập xong).
export default function AuthGuard({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname() || "";
    const { user, isLoading } = useAuth();
    const onLoginPage = isLoginPath(pathname);

    useEffect(() => {
        if (isLoading) return;
        if (!user && !onLoginPage) {
            router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
        } else if (user && onLoginPage) {
            router.replace("/");
        }
    }, [isLoading, user, onLoginPage, pathname, router]);

    if (isLoading || (!user && !onLoginPage) || (user && onLoginPage)) {
        return (
            <div className="flex min-h-full items-center justify-center bg-[#f8fafc] text-sm text-[#5e3f3a]">
                Đang tải...
            </div>
        );
    }

    return <>{children}</>;
}
