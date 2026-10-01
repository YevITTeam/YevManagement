"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "@/navigation";
import { useAuth } from "@/modules/auth/context/AuthContext";

const isLoginPath = (pathname: string) => pathname === "/login" || pathname.startsWith("/login/");

// Route public mở từ link email — tự xác thực bằng token nằm trong URL, BE để [AllowAnonymous]
// (OtFormController/UserSignatureController/SecondaryPasswordController/WorkflowRequest...). KHÔNG
// được bắt đăng nhập SPA, dù người bấm link đang mở trình duyệt ẩn danh hay đã có sẵn phiên đăng nhập
// khác — bắt đăng nhập ở đây là đi ngược đúng mục đích của kênh duyệt qua email (2026-09-28, sửa lỗi
// AuthGuard chặn nhầm các route này vì trước đó chỉ trừ ngoại lệ "/login").
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

// Chặn truy cập toàn site khi chưa đăng nhập — mirror OtAccessGuard/PcAccessGuard (chặn theo module),
// nhưng ở đây chặn theo trạng thái đăng nhập, áp dụng cho MỌI route trừ /login và các route public ở
// trên. `/login` là lối thoát duy nhất cho luồng SPA: user đã đăng nhập lỡ vào lại /login thì đẩy về
// trang chủ, chưa đăng nhập vào trang khác thì đẩy sang /login (giữ ?redirect= để LoginForm quay lại
// đúng chỗ sau khi đăng nhập xong).
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

    // Route public: render ngay, không chờ AuthContext xác thực xong và không quan tâm trạng thái đăng nhập.
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
