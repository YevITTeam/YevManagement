import { Suspense } from "react";
import OtFormEmailConfirmPage from "@/modules/attendance/components/public-confirm/OtFormEmailConfirmPage";

// Route public — mở qua link email "Duyệt/Từ chối đơn tăng ca" (docs/attendance-api-fe.md §4.6).
// Không nằm trong sơ đồ menu, không cần đăng nhập SPA.
export default function Page() {
    return (
        <Suspense fallback={<div className="py-16 text-center text-sm text-[#5e3f3a]">Đang tải...</div>}>
            <OtFormEmailConfirmPage />
        </Suspense>
    );
}
