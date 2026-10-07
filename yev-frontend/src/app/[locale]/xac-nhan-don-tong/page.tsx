"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import OtFormBatchDetail from "@/modules/attendance/components/ot-form-batch/OtFormBatchDetail";

// Route public — mở qua link email "Duyệt đơn tổng" (docs/attendance-module.md §API §Đơn tổng). Không nằm
// trong sơ đồ menu, không cần đăng nhập SPA — cùng nguyên tắc với /xac-nhan-don hiện có.
function OtFormBatchEmailConfirmContent() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token") ?? "";
    return <OtFormBatchDetail variant="email" token={token} />;
}

export default function Page() {
    return (
        <Suspense fallback={<div className="py-16 text-center text-sm text-[#5e3f3a]">Đang tải...</div>}>
            <OtFormBatchEmailConfirmContent />
        </Suspense>
    );
}
