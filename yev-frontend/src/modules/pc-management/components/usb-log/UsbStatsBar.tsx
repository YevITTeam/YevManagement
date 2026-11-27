"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Ban, FileWarning, Plug, Radio, ShieldCheck, ShieldX, Unplug, Usb, type LucideIcon } from "lucide-react";

import { Skeleton } from "@/components/ui/Skeleton";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { UsbLogApi } from "@/modules/pc-management/api/usb-log.api";
import type { UsbStatsDto } from "@/modules/pc-management/types/usb-log.dto";

// Compact strip rather than KPI cards: the lists below are the main content.
export default function UsbStatsBar() {
    const t = useTranslations("usbLog");
    const [stats, setStats] = useState<UsbStatsDto | null>(null);
    useFetchEffect(() => UsbLogApi.getStats(), [], setStats, t("stats.loadError"));

    const items: { icon: LucideIcon; label: string; value: string | number; title?: string; alert?: boolean }[] = stats
        ? [
              { icon: Radio, label: t("stats.agentOnline"), value: `${stats.agentOnlineCount}/${stats.agentCount}`, title: t("stats.agentOnlineTitle") },
              { icon: Unplug, label: t("common.stale"), value: stats.agentStaleCount, title: t("stats.staleTitle"), alert: stats.agentStaleCount > 0 },
              { icon: Plug, label: t("stats.machinesConnectedNow"), value: stats.machinesConnectedNow },
              { icon: ShieldX, label: t("stats.blockedNow"), value: stats.blockedNow, title: t("stats.blockedNowTitle"), alert: stats.blockedNow > 0 },
              { icon: Usb, label: t("stats.sessionsToday"), value: stats.sessionsToday },
              { icon: Ban, label: t("stats.blockedToday"), value: stats.blockedToday, alert: stats.blockedToday > 0 },
              { icon: FileWarning, label: t("stats.sensitiveToday"), value: stats.sensitiveFilesToday, title: t("files.sensitiveTitle"), alert: stats.sensitiveFilesToday > 0 },
              { icon: ShieldCheck, label: t("stats.approvedUsb"), value: `${stats.approvedUsbCount}/${stats.storageUsbCount}`, title: t("stats.approvedUsbTitle") },
          ]
        : [];

    return (
        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[#e0e3e5] bg-[#e0e3e5] shadow-sm sm:grid-cols-4 xl:grid-cols-8">
            {stats === null
                ? Array.from({ length: 8 }).map((_, index) => (
                      <div key={index} className="bg-white px-3 py-2.5">
                          <Skeleton className="h-10 w-full" />
                      </div>
                  ))
                : items.map(({ icon: Icon, ...item }) => (
                      <div key={item.label} title={item.title} className="min-w-0 bg-white px-3 py-2">
                          <div className={`flex items-center gap-1.5 ${item.alert ? "text-[#e3000f]" : "text-[#191c1e]"}`}>
                              <Icon className={`h-4 w-4 shrink-0 ${item.alert ? "" : "text-[#8a8f94]"}`} />
                              <span className="text-lg font-semibold leading-tight tabular-nums">{item.value}</span>
                          </div>
                          <div className="mt-0.5 text-xs leading-tight text-[#5e3f3a]">{item.label}</div>
                      </div>
                  ))}
        </section>
    );
}
