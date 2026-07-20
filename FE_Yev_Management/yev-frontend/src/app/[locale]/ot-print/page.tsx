"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import OtFormPrintView from "@/modules/attendance/components/ot-form/OtFormPrintView";

// Route riêng cho "In đơn" (docs/attendance-api-fe.md §8) — cố ý đặt NGOÀI nhóm (ot-manager) để không bị
// OtManagerSidebar/OtAccessGuard chen vào bản in; Header vẫn hiện nhưng bị ẩn qua CSS `print:hidden` khi
// in. Quyền xem vẫn do BE tự enforce qua permission Attendance.OTForm.View như mọi API khác.
//
// Dùng query string (?id=) thay vì route động [id]: "output: export" (static export) yêu cầu mọi
// route động phải khai báo trước toàn bộ id qua generateStaticParams(), không khả thi vì id đơn OT
// phát sinh liên tục từ BE. Query string không phải 1 phần routing tĩnh nên tương thích static export.
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
