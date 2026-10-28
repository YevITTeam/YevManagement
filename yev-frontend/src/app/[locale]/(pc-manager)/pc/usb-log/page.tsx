"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import UsbMachineDetail from "@/modules/pc-management/components/usb-log/UsbMachineDetail";
import UsbMachineList from "@/modules/pc-management/components/usb-log/UsbMachineList";

// Query string (?machine=) thay cho route động: static export không biết trước tên máy (xem pc/devices/page.tsx).
function UsbLogContent() {
    const searchParams = useSearchParams();
    const machine = searchParams.get("machine");
    const deviceId = Number(searchParams.get("deviceId"));

    return machine ? <UsbMachineDetail machineName={machine} deviceId={deviceId || undefined} /> : <UsbMachineList />;
}

export default function Page() {
    return (
        <Suspense>
            <UsbLogContent />
        </Suspense>
    );
}
