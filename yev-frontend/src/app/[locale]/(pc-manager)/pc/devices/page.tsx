"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import DeviceDetail from "@/modules/pc-management/components/devices/DeviceDetail";

// ?id= instead of [id]: static export would need every id in generateStaticParams().
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
