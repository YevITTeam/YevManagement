"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import CreateOtFormPage from "@/modules/attendance/components/ot-form/CreateOtFormPage";

// Dùng query string (?id=) thay vì route động [id]/edit: "output: export" (static export) yêu cầu
// mọi route động phải khai báo trước toàn bộ id qua generateStaticParams(), không khả thi vì id đơn
// OT phát sinh liên tục từ BE. Query string không phải 1 phần routing tĩnh nên tương thích static export.
function EditOtFormContent() {
    const searchParams = useSearchParams();
    const id = Number(searchParams.get("id"));
    return <CreateOtFormPage otFormId={id} />;
}

export default function Page() {
    return (
        <Suspense>
            <EditOtFormContent />
        </Suspense>
    );
}
