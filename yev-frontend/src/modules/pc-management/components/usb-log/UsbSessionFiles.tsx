"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";

import { UsbLogApi } from "@/modules/pc-management/api/usb-log.api";
import type { UsbFileEventDto } from "@/modules/pc-management/types/usb-log.dto";
import { NO_SORT, SortableTh, type SortState } from "@/components/ui/SortableTh";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { formatBytes, formatDateTime } from "./usb-log-format";

const PAGE_SIZE = 50;

const actionClasses: Record<number, string> = {
    1: "border border-[#bfe5c8] bg-[#eefaf1] text-[#0f6b2a]",
    2: "border border-[#cfe0fb] bg-[#eef4ff] text-[#1d4ed8]",
    3: "border border-[#e9bcb6] bg-[#fff4f2] text-[#930006]",
    4: "border border-[#f0dca6] bg-[#fff9e8] text-[#8a5a00]",
    // Copied from the USB onto the PC: oldFilePath is the USB source, filePath the PC copy.
    5: "border border-[#e0e3e5] bg-[#f2f4f6] text-[#5e3f3a]",
};

export default function UsbSessionFiles({ sessionId }: { sessionId: string }) {
    const t = useTranslations("usbLog");
    const [rows, setRows] = useState<UsbFileEventDto[]>([]);
    const [pageIndex, setPageIndex] = useState(1);
    const [sort, setSort] = useState<SortState>(NO_SORT);
    const [totalPages, setTotalPages] = useState(1);

    const { isLoading, error } = useFetchEffect(
        () => UsbLogApi.getSessionFiles(sessionId, { pageIndex, pageSize: PAGE_SIZE, ...sort }),
        [sessionId, pageIndex, sort],
        (result) => {
            setRows(result.data);
            setTotalPages(result.totalPages);
        },
        t("files.loadError"),
        (message) => toast.error(message)
    );

    const handleSort = (next: SortState) => {
        setPageIndex(1);
        setSort(next);
    };

    if (error) return <div className="text-sm text-[#930006]">{error}</div>;
    if (!isLoading && rows.length === 0) return <div className="text-sm text-[#5e3f3a]">{t("files.empty")}</div>;

    return (
        <div className="space-y-2">
            <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-[#e0e3e5] text-[11px] font-semibold tracking-[0.06em] text-[#5e3f3a]">
                            <SortableTh label={t("files.time")} sortKey="occurredAt" sort={sort} onSort={handleSort} className="py-1.5 pr-3" />
                            <SortableTh label={t("common.actions")} sortKey="action" sort={sort} onSort={handleSort} className="py-1.5 pr-3" />
                            <SortableTh label={t("common.file")} sortKey="filePath" sort={sort} onSort={handleSort} className="py-1.5 pr-3" />
                            <SortableTh label={t("files.size")} sortKey="sizeBytes" sort={sort} onSort={handleSort} className="py-1.5 text-right" />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr key={row.id} className="border-b border-[#e0e3e5] last:border-0">
                                <td className="whitespace-nowrap py-1.5 pr-3 text-xs text-[#5e3f3a]">{formatDateTime(row.occurredAt)}</td>
                                <td className="py-1.5 pr-3">
                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${actionClasses[row.action] ?? ""}`}>
                                        {row.actionText}
                                    </span>
                                </td>
                                <td className="break-all py-1.5 pr-3 text-[#191c1e]">
                                    {row.oldFilePath ? `${row.oldFilePath} → ${row.filePath}` : row.filePath}
                                </td>
                                <td className="whitespace-nowrap py-1.5 text-right text-xs text-[#5e3f3a]">{formatBytes(row.sizeBytes)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {totalPages > 1 && (
                <div className="flex items-center justify-end gap-3 text-sm text-[#5e3f3a]">
                    <button
                        className="cursor-pointer disabled:opacity-50"
                        disabled={pageIndex <= 1 || isLoading}
                        onClick={() => setPageIndex((current) => current - 1)}
                    >
                        {t("files.prev")}
                    </button>
                    <span className="font-semibold text-[#191c1e]">
                        {pageIndex} / {totalPages}
                    </span>
                    <button
                        className="cursor-pointer disabled:opacity-50"
                        disabled={pageIndex >= totalPages || isLoading}
                        onClick={() => setPageIndex((current) => current + 1)}
                    >
                        {t("files.next")}
                    </button>
                </div>
            )}
        </div>
    );
}
