"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import OtFormPrintView from "@/modules/attendance/components/ot-form/OtFormPrintView";

// Route "In đơn" (docs/attendance-api-fe.md §8) — nằm trong nhóm (ot-manager) để có Sidebar khi xem
// trên trình duyệt (điều hướng thuận tiện); Sidebar + Header đều `print:hidden` nên không lộ ra khi
// in thật. Quyền xem vẫn do BE tự enforce qua permission Attendance.OTForm.View như mọi API khác.
//
// Dùng query string (?id=) thay vì route động [id]: lúc thêm route này đang chạy "output: export"
// (static export) yêu cầu mọi route động phải khai báo trước toàn bộ id qua generateStaticParams(),
// không khả thi vì id đơn OT phát sinh liên tục từ BE — giữ nguyên cách này dù hiện tại export đã tắt.
function OtPrintContent() {
    const searchParams = useSearchParams();
    const id = Number(searchParams.get("id"));
    return <OtFormPrintView id={id} />;
}

export default function Page() {
    return (
        <Suspense>
            <OtPrintContent />
        </Suspense>
    );
}
