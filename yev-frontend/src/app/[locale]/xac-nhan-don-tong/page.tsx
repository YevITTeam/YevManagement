"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import OtFormBatchDetail from "@/modules/attendance/components/ot-form-batch/OtFormBatchDetail";

// Public route opened from the batch-approval email; no SPA login.
function OtFormBatchEmailConfirmContent() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token") ?? "";
    return <OtFormBatchDetail token={token} />;
}

export default function Page() {
    return (
        <Suspense fallback={<div className="py-16 text-center text-sm text-[#5e3f3a]">Đang tải...</div>}>
            <OtFormBatchEmailConfirmContent />
        </Suspense>
    );
}
