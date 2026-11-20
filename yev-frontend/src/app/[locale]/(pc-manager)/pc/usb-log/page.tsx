"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { Tabs } from "@/components/ui/Tabs";
import { useRouter } from "@/navigation";
import UsbAgentList from "@/modules/pc-management/components/usb-log/UsbAgentList";
import UsbDeviceList from "@/modules/pc-management/components/usb-log/UsbDeviceList";
import UsbMachineDetail from "@/modules/pc-management/components/usb-log/UsbMachineDetail";
import UsbMachineList from "@/modules/pc-management/components/usb-log/UsbMachineList";

type UsbTab = "machines" | "devices" | "agents";

const TABS: { key: UsbTab; label: string }[] = [
    { key: "machines", label: "Máy" },
    { key: "devices", label: "Thiết bị USB" },
    { key: "agents", label: "Agent" },
];

// ?machine= instead of a dynamic route: static export can't know machine names in advance. ?tab= keeps the tab on F5.
function UsbLogContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const machine = searchParams.get("machine");
    const deviceId = Number(searchParams.get("deviceId"));

    if (machine) return <UsbMachineDetail machineName={machine} deviceId={deviceId || undefined} />;

    const tab = TABS.find((t) => t.key === searchParams.get("tab"))?.key ?? "machines";

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-lg font-semibold text-[#191c1e]">Quản lý USB</h1>
                <Tabs
                    tabs={TABS}
                    activeKey={tab}
                    onChange={(key) => router.replace({ pathname: "/pc/usb-log", query: key === "machines" ? {} : { tab: key } })}
                />
            </div>
            {tab === "devices" ? <UsbDeviceList /> : tab === "agents" ? <UsbAgentList /> : <UsbMachineList />}
        </div>
    );
}

export default function Page() {
    return (
        <Suspense>
            <UsbLogContent />
        </Suspense>
    );
}
