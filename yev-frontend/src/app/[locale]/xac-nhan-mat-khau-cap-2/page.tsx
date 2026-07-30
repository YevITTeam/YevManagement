import { Suspense } from "react";
import SecondaryPasswordConfirmPage from "@/modules/attendance/components/public-confirm/SecondaryPasswordConfirmPage";

// Route public — mở qua link email "Xác nhận thiết lập mật khẩu cấp 2" (mirror xac-nhan-chu-ky).
// Không nằm trong sơ đồ menu, không cần đăng nhập SPA.
export default function Page() {
    return (
        <Suspense fallback={<div className="py-16 text-center text-sm text-[#5e3f3a]">Đang tải...</div>}>
            <SecondaryPasswordConfirmPage />
        </Suspense>
    );
}
