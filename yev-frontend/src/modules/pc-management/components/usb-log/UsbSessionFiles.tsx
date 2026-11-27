"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, FileInput, FilePen, FilePlus, FileSymlink, FileX, TriangleAlert, type LucideIcon } from "lucide-react";
import { toast } from "react-toastify";

import { Skeleton } from "@/components/ui/Skeleton";
import { UsbLogApi } from "@/modules/pc-management/api/usb-log.api";
import type { UsbFileEventDto } from "@/modules/pc-management/types/usb-log.dto";
import { NO_SORT, SortableTh, type SortState } from "@/components/ui/SortableTh";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { IconButton, ToggleChip } from "./UsbListToolbar";
import { formatBytes, formatDateTime } from "./usb-log-format";

const PAGE_SIZE = 50;

// UsbFileAction → icon + tone. 5 = copied from the USB onto the PC: oldFilePath is the USB source, filePath the PC copy.
const ACTION_META: Record<number, { icon: LucideIcon; className: string }> = {
    1: { icon: FilePlus, className: "text-[#191c1e]" },
    2: { icon: FilePen, className: "text-[#5e3f3a]" },
    3: { icon: FileX, className: "text-[#930006]" },
    4: { icon: FileSymlink, className: "text-[#9a5b00]" },
    5: { icon: FileInput, className: "text-[#5e3f3a]" },
};

// File count with the sensitive part flagged in red; shared by every list that shows a file count.
export function UsbFileCount({ total, sensitive }: { total: number; sensitive: number }) {
    const t = useTranslations("usbLog");
    return (
        <span className="inline-flex items-center gap-2 whitespace-nowrap tabular-nums">
            <span className={total === 0 ? "text-[#8a8f94]" : undefined}>{total}</span>
            {sensitive > 0 && (
                <span title={t("files.sensitiveTitle")} className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#e3000f]">
                    <TriangleAlert className="h-3.5 w-3.5" aria-label={t("files.sensitive")} />
                    {sensitive}
                </span>
            )}
        </span>
    );
}

export function UsbFileAction({ action, text }: { action: number; text: string }) {
    const meta = ACTION_META[action];
    const Icon = meta?.icon;
    return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${meta?.className ?? "text-[#5e3f3a]"}`}>
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {text}
        </span>
    );
}

// Rename/copy-in rows show "old → new" so a leaked file is found under either name.
export function UsbFilePath({ file }: { file: Pick<UsbFileEventDto, "filePath" | "oldFilePath" | "isSensitive"> }) {
    const t = useTranslations("usbLog");
    return (
        <>
            {file.isSensitive && (
                <span title={t("files.sensitiveTitle")}>
                    <TriangleAlert className="mr-1 inline h-3.5 w-3.5 align-[-2px] text-[#e3000f]" aria-label={t("files.sensitive")} />
                </span>
            )}
            {file.oldFilePath && <span className="text-[#8a8f94]">{file.oldFilePath} → </span>}
            {file.filePath}
        </>
    );
}

export default function UsbSessionFiles({ sessionId, sensitiveCount = 0 }: { sessionId: string; sensitiveCount?: number }) {
    const t = useTranslations("usbLog");
    const [rows, setRows] = useState<UsbFileEventDto[]>([]);
    const [pageIndex, setPageIndex] = useState(1);
    const [sort, setSort] = useState<SortState>(NO_SORT);
    const [totalPages, setTotalPages] = useState(1);
    const [sensitiveOnly, setSensitiveOnly] = useState(false);

    const { isLoading, error } = useFetchEffect(
        () => UsbLogApi.getSessionFiles(sessionId, { pageIndex, pageSize: PAGE_SIZE, sensitiveOnly, ...sort }),
        [sessionId, pageIndex, sort, sensitiveOnly],
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
    if (isLoading && rows.length === 0) return <Skeleton className="h-20 w-full" />;
    if (rows.length === 0) return <div className="py-2 text-sm text-[#8a8f94]">{t("files.empty")}</div>;

    return (
        <div className="space-y-2">
            {(sensitiveCount > 0 || totalPages > 1) && (
                <div className="flex items-center justify-between gap-2">
                    {sensitiveCount > 0 ? (
                        <ToggleChip
                            checked={sensitiveOnly}
                            onChange={(checked) => {
                                setPageIndex(1);
                                setSensitiveOnly(checked);
                            }}
                            icon={TriangleAlert}
                            label={t("files.sensitiveOnly")}
                            title={t("files.sensitiveTitle")}
                        />
                    ) : (
                        <span />
                    )}
                    {totalPages > 1 && (
                        <div className="flex items-center gap-1 text-sm text-[#5e3f3a]">
                            <IconButton icon={ChevronLeft} label={t("files.prev")} size="sm" variant="ghost" disabled={pageIndex <= 1 || isLoading} onClick={() => setPageIndex((current) => current - 1)} />
                            <span className="tabular-nums">
                                {pageIndex} / {totalPages}
                            </span>
                            <IconButton icon={ChevronRight} label={t("files.next")} size="sm" variant="ghost" disabled={pageIndex >= totalPages || isLoading} onClick={() => setPageIndex((current) => current + 1)} />
                        </div>
                    )}
                </div>
            )}
            <div className="relative overflow-x-auto rounded-lg border border-[#e0e3e5] bg-white">
                <table className="min-w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold text-[#5e3f3a] [&>th]:whitespace-nowrap">
                            <SortableTh label={t("files.time")} sortKey="occurredAt" sort={sort} onSort={handleSort} className="px-3 py-1.5" />
                            <SortableTh label={t("common.actions")} sortKey="action" sort={sort} onSort={handleSort} className="px-3 py-1.5" />
                            <SortableTh label={t("common.file")} sortKey="filePath" sort={sort} onSort={handleSort} className="px-3 py-1.5" />
                            <SortableTh label={t("files.size")} sortKey="sizeBytes" sort={sort} onSort={handleSort} className="px-3 py-1.5 text-right" />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr key={row.id} className="border-b border-[#f1f5f9] last:border-0">
                                <td className="whitespace-nowrap px-3 py-1.5 text-xs text-[#5e3f3a] tabular-nums">{formatDateTime(row.occurredAt)}</td>
                                <td className="whitespace-nowrap px-3 py-1.5">
                                    <UsbFileAction action={row.action} text={row.actionText} />
                                </td>
                                <td className="px-3 py-1.5 text-[#191c1e] wrap-anywhere">
                                    <UsbFilePath file={row} />
                                </td>
                                <td className="whitespace-nowrap px-3 py-1.5 text-right text-xs text-[#5e3f3a] tabular-nums">{formatBytes(row.sizeBytes)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
