import { Suspense } from "react";
import SignatureConfirmPage from "@/modules/attendance/components/public-confirm/SignatureConfirmPage";

// Route public — mở qua link email "Xác nhận cập nhật chữ ký" (docs/attendance-module.md §API).
// Không nằm trong sơ đồ menu, không cần đăng nhập SPA.
export default function Page() {
    return (
        <Suspense fallback={<div className="py-16 text-center text-sm text-[#5e3f3a]">Đang tải...</div>}>
            <SignatureConfirmPage />
        </Suspense>
    );
}
