"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import OtFormBatchDetail from "@/modules/attendance/components/ot-form-batch/OtFormBatchDetail";

// Dùng query string (?id=) thay vì route động [id] — giống ot/forms/page.tsx: "output: export"
// (static export) yêu cầu mọi route động phải khai báo trước toàn bộ id qua generateStaticParams(),
// không khả thi vì id đơn tổng phát sinh liên tục từ BE.
function OtFormBatchDetailContent() {
    const searchParams = useSearchParams();
    const id = Number(searchParams.get("id"));
    return <OtFormBatchDetail variant="app" id={id} />;
}

export default function Page() {
    return (
        <Suspense>
            <OtFormBatchDetailContent />
        </Suspense>
    );
}
