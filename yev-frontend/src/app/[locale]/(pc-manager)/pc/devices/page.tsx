"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import DeviceDetail from "@/modules/pc-management/components/devices/DeviceDetail";

// Dùng query string (?id=) thay vì route động [id]: "output: export" (static export) yêu cầu mọi
// route động phải khai báo trước toàn bộ id qua generateStaticParams(), không khả thi vì id thiết bị
// phát sinh liên tục từ BE. Query string không phải 1 phần routing tĩnh nên tương thích static export.
function DeviceDetailContent() {
    const searchParams = useSearchParams();
    const id = Number(searchParams.get("id"));
    return <DeviceDetail deviceId={id} />;
}

export default function Page() {
    return (
        <Suspense>
            <DeviceDetailContent />
        </Suspense>
    );
}
