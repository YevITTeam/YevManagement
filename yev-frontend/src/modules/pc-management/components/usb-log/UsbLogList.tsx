"use client";

import { Fragment, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";

import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { NO_SORT, SortableTh, type SortState } from "@/components/ui/SortableTh";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { UsbLogApi } from "@/modules/pc-management/api/usb-log.api";
import type { UsbSessionDto } from "@/modules/pc-management/types/usb-log.dto";
import { ErrorBar, TableStatusRows, theadRowClassName } from "./UsbListToolbar";
import UsbSessionFiles, { UsbFileCount } from "./UsbSessionFiles";
import { POLICY_META, deviceClassLabel, formatBytes, formatDateTime, usbLabel } from "./usb-log-format";
import { usePersistedState } from "@/modules/common/hooks/usePersistedState";

const PAGE_SIZE = 20;
const COLUMNS = 6;

interface UsbLogListProps {
    // One machine's sessions: by asset device (device detail page) or by agent machine name.
    deviceId?: number;
    machineName?: string;
    // Narrows to one USB; the USB column then shows only the drive letter and policy badge.
    usbDeviceId?: number;
}

// USB plug-in sessions reported by the PC agent.
export default function UsbLogList({ deviceId, machineName, usbDeviceId }: UsbLogListProps) {
    const t = useTranslations("usbLog");
    const [rows, setRows] = useState<UsbSessionDto[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [pageIndex, setPageIndex] = useState(1);
    const [pageSize, setPageSize] = usePersistedState("page-size:pc-management/components/usb-log/UsbLogList", PAGE_SIZE);
    const [sort, setSort] = useState<SortState>(NO_SORT);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    const { isLoading, error } = useFetchEffect(
        () => UsbLogApi.getSessions({ pageIndex, pageSize, deviceId, machineName, usbDeviceId, ...sort }),
        [pageIndex, pageSize, deviceId, machineName, usbDeviceId, sort],
        (result) => {
            setRows(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
        },
        t("sessions.loadError"),
        (message) => toast.error(message)
    );

    const handleSort = (next: SortState) => {
        setPageIndex(1);
        setSort(next);
    };

    const summary = isLoading ? t("common.loadingData") : t("common.shownSessions", { shown: rows.length, total: totalCount });

    return (
        <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white">
            <ErrorBar message={error} />

            <div className="relative overflow-x-auto">
                <table className="min-w-full border-collapse text-left text-sm">
                    <thead>
                        <tr className={theadRowClassName}>
                            <SortableTh label={t("sessions.connectedAt")} sortKey="connectedAt" sort={sort} onSort={handleSort} className="px-3 py-2" />
                            <SortableTh label={t("sessions.disconnectedAt")} sortKey="disconnectedAt" sort={sort} onSort={handleSort} className="hidden px-3 py-2 lg:table-cell" />
                            <SortableTh label={t("common.user")} sortKey="windowsUser" sort={sort} onSort={handleSort} className="hidden px-3 py-2 lg:table-cell" />
                            {usbDeviceId === undefined ? (
                                <SortableTh label="USB" sortKey="usb" sort={sort} onSort={handleSort} className="px-3 py-2" />
                            ) : (
                                <th className="px-3 py-2">{t("sessions.drive")}</th>
                            )}
                            <SortableTh label={t("common.file")} sortKey="fileEventCount" sort={sort} onSort={handleSort} className="px-3 py-2" />
                            <th className="w-10 px-2 py-2">
                                <span className="sr-only">{t("sessions.detail")}</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <TableStatusRows loading={isLoading} empty={rows.length === 0} columns={COLUMNS} />
                        {rows.map((row) => {
                            const open = expandedId === row.id;
                            const policy = row.policyResult !== null ? POLICY_META[row.policyResult] : undefined;
                            return (
                                <Fragment key={row.id}>
                                    <tr className={`border-b border-[#f1f5f9] align-top ${open ? "bg-[#f8fafc]" : ""}`}>
                                        <td className="whitespace-nowrap px-3 py-2 tabular-nums text-[#191c1e]">{formatDateTime(row.connectedAt)}</td>
                                        <td className="hidden whitespace-nowrap px-3 py-2 tabular-nums text-[#5e3f3a] lg:table-cell">
                                            {row.disconnectedAt ? (
                                                formatDateTime(row.disconnectedAt)
                                            ) : row.agentOnline ? (
                                                <span className="font-medium text-emerald-600">{t("common.connectedNow")}</span>
                                            ) : (
                                                <span title={t("sessions.unknownTitle")} className="text-[#8a8f94]">
                                                    {t("sessions.unknown")}
                                                </span>
                                            )}
                                        </td>
                                        <td className="hidden px-3 py-2 text-[#5e3f3a] lg:table-cell">{row.windowsUser || "-"}</td>
                                        <td className="px-3 py-2 text-[#191c1e]">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <span>{usbDeviceId === undefined ? usbLabel({ ...row, alias: row.usbAlias }) : row.driveLetter || "-"}</span>
                                                {policy && (
                                                    <span title={t(`policy.${policy.key}.title`)}>
                                                        <Badge variant={policy.variant}>{t(`policy.${policy.key}.label`)}</Badge>
                                                    </span>
                                                )}
                                            </div>
                                            {usbDeviceId === undefined && (
                                                <div className="break-all text-xs text-[#5e3f3a]">
                                                    {[row.deviceClass === "DiskDrive" ? null : deviceClassLabel(t, row.deviceClass), row.driveLetter, row.serialNumber, formatBytes(row.capacityBytes)]
                                                        .filter((v) => v && v !== "-")
                                                        .join(" · ")}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-[#191c1e]">
                                            <UsbFileCount total={row.fileEventCount} sensitive={row.sensitiveFileCount} />
                                        </td>
                                        <td className="px-2 py-1.5 text-right">
                                            <button
                                                type="button"
                                                onClick={() => setExpandedId(open ? null : row.id)}
                                                disabled={row.fileEventCount === 0}
                                                aria-expanded={open}
                                                title={open ? t("common.collapse") : t("sessions.view")}
                                                aria-label={open ? t("common.collapse") : t("sessions.view")}
                                                className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-[#5e3f3a] transition hover:bg-[#f2f4f6] hover:text-[#191c1e] disabled:cursor-not-allowed disabled:opacity-30"
                                            >
                                                <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
                                            </button>
                                        </td>
                                    </tr>
                                    {open && (
                                        <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                                            <td colSpan={COLUMNS} className="px-3 pb-3 pt-1">
                                                <UsbSessionFiles sessionId={row.id} sensitiveCount={row.sensitiveFileCount} />
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <Pagination pageSize={pageSize} onPageSizeChange={setPageSize} pageIndex={pageIndex} totalPages={totalPages} onPageChange={setPageIndex} disabled={isLoading} summary={summary} compactSummary={summary} />
        </section>
    );
}
