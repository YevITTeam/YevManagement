"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { AuditTrailApi } from "@/modules/pc-management/api/audit-trail.api";
import type { AuditTrailDto } from "@/modules/pc-management/types/audit-trail.dto";
import { auditActionClasses, auditActionLabel } from "@/modules/pc-management/components/audit-trail/audit-trail-format";
import AuditTrailDiffView from "@/modules/pc-management/components/audit-trail/AuditTrailDiffView";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

interface DeviceAuditHistoryPanelProps {
    deviceId: number;
}

function formatDateTime(value: string) {
    if (!value) return "-";
    return new Date(value).toLocaleString("vi-VN");
}

// Device History tab: unpaged, newest first.
export default function DeviceAuditHistoryPanel({ deviceId }: DeviceAuditHistoryPanelProps) {
    const t = useTranslations("Asset.AuditTrail");
    const [rows, setRows] = useState<AuditTrailDto[]>([]);

    const { isLoading, error } = useFetchEffect(
        () => AuditTrailApi.getAuditTrailByRecord("Device", deviceId),
        [deviceId],
        (data) => setRows(data),
        t("historyLoadError"),
        undefined,
        "device-audit-history"
    );

    if (isLoading) {
        return <div className="rounded-xl border border-[#e0e3e5] bg-white p-6 text-sm text-[#5e3f3a]">{t("historyLoading")}</div>;
    }

    if (error) {
        return <div className="rounded-xl border border-[#e9bcb6] bg-[#fff4f2] p-4 text-sm text-[#930006]">{error}</div>;
    }

    if (rows.length === 0) {
        return <div className="rounded-xl border border-[#e0e3e5] bg-white p-6 text-sm text-[#5e3f3a]">{t("historyEmpty")}</div>;
    }

    return (
        <div className="space-y-3">
            {rows.map((row) => (
                <section key={row.id} className="rounded-xl border border-[#e0e3e5] bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                            <span
                                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${auditActionClasses[row.action] ?? "border border-[#e0e3e5] bg-[#f8fafc] text-[#5e3f3a]"}`}
                            >
                                {auditActionLabel(t, row.action)}
                            </span>
                            <span className="text-sm font-semibold text-[#191c1e]">{row.recordName}</span>
                            {row.affectedCount > 1 && (
                                <span className="rounded-full border border-[#cfe0fb] bg-[#eef4ff] px-2 py-0.5 text-[10px] font-semibold text-[#1d4ed8]">
                                    ×{row.affectedCount}
                                </span>
                            )}
                            <span className="text-sm text-[#5e3f3a]">{row.changedBy}</span>
                        </div>
                        <span className="text-xs text-[#5e3f3a]">{formatDateTime(row.changedAt)}</span>
                    </div>
                    <div className="mt-3">
                        <AuditTrailDiffView oldValues={row.oldValues} newValues={row.newValues} affectedCount={row.affectedCount} />
                    </div>
                </section>
            ))}
        </div>
    );
}
