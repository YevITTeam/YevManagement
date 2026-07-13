"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import DeviceDetail from "@/modules/pc-management/components/devices/DeviceDetail";

function DeviceDetailPageContent() {
    const searchParams = useSearchParams();
    const id = searchParams.get("id");

    return <DeviceDetail deviceId={Number(id)} />;
}

export default function DeviceDetailPage() {
    return (
        <Suspense fallback={null}>
            <DeviceDetailPageContent />
        </Suspense>
    );
}
