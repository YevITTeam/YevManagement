"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { Tabs } from "@/components/ui/Tabs";
import { useRouter } from "@/navigation";
import UsbAgentList from "@/modules/pc-management/components/usb-log/UsbAgentList";
import UsbDeviceList from "@/modules/pc-management/components/usb-log/UsbDeviceList";
import UsbMachineDetail from "@/modules/pc-management/components/usb-log/UsbMachineDetail";
import UsbMachineList from "@/modules/pc-management/components/usb-log/UsbMachineList";
import UsbStatsBar from "@/modules/pc-management/components/usb-log/UsbStatsBar";

const TABS = ["machines", "devices", "agents"] as const;

// ?machine= instead of a dynamic route: static export can't know machine names in advance. ?tab= keeps the tab on F5.
function UsbLogContent() {
    const t = useTranslations("usbLog");
    const router = useRouter();
    const searchParams = useSearchParams();
    const machine = searchParams.get("machine");
    const deviceId = Number(searchParams.get("deviceId"));

    if (machine) return <UsbMachineDetail machineName={machine} deviceId={deviceId || undefined} />;

    const tab = TABS.find((key) => key === searchParams.get("tab")) ?? "machines";

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-lg font-semibold text-[#191c1e]">{t("title")}</h1>
                <Tabs
                    tabs={TABS.map((key) => ({ key, label: t(`tabs.${key}`) }))}
                    activeKey={tab}
                    onChange={(key) => router.replace({ pathname: "/pc/usb-log", query: key === "machines" ? {} : { tab: key } })}
                />
            </div>
            <UsbStatsBar />
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
