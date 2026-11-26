"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { UsbLogApi } from "@/modules/pc-management/api/usb-log.api";
import type { UsbStatsDto } from "@/modules/pc-management/types/usb-log.dto";

// Compact strip rather than KPI cards: the lists below are the main content.
export default function UsbStatsBar() {
    const t = useTranslations("usbLog");
    const [stats, setStats] = useState<UsbStatsDto | null>(null);
    useFetchEffect(() => UsbLogApi.getStats(), [], setStats, t("stats.loadError"));

    if (!stats) return null;

    const items: { label: string; value: string | number; title?: string; alert?: boolean }[] = [
        { label: t("stats.agentOnline"), value: `${stats.agentOnlineCount}/${stats.agentCount}`, title: t("stats.agentOnlineTitle") },
        { label: t("common.stale"), value: stats.agentStaleCount, title: t("stats.staleTitle"), alert: stats.agentStaleCount > 0 },
        { label: t("stats.machinesConnectedNow"), value: stats.machinesConnectedNow },
        { label: t("stats.blockedNow"), value: stats.blockedNow, alert: stats.blockedNow > 0 },
        { label: t("stats.sessionsToday"), value: stats.sessionsToday },
        { label: t("stats.blockedToday"), value: stats.blockedToday, alert: stats.blockedToday > 0 },
        { label: t("stats.approvedUsb"), value: `${stats.approvedUsbCount}/${stats.storageUsbCount}`, title: t("stats.approvedUsbTitle") },
    ];

    return (
        <section className="flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-[#e0e3e5] bg-white px-4 py-2.5 shadow-sm">
            {items.map((item) => (
                <div key={item.label} title={item.title}>
                    <div className={`text-lg font-semibold ${item.alert ? "text-[#e3000f]" : "text-[#191c1e]"}`}>{item.value}</div>
                    <div className="text-xs text-[#5e3f3a]">{item.label}</div>
                </div>
            ))}
        </section>
    );
}
