"use client";

import { Pagination } from "@/components/ui/Pagination";
import { Fragment, useState } from "react";
import { FilterX, RefreshCw, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";

import { UsbLogApi } from "@/modules/pc-management/api/usb-log.api";
import type { UsbSessionDto } from "@/modules/pc-management/types/usb-log.dto";
import { NO_SORT, SortableTh, type SortState } from "@/components/ui/SortableTh";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { Badge } from "@/components/ui/Badge";
import UsbSessionFiles, { UsbFileCount } from "./UsbSessionFiles";
import { POLICY_META, deviceClassLabel, formatBytes, formatDateTime, usbLabel } from "./usb-log-format";

const PAGE_SIZE = 20;

const fieldLabelClassName = "mb-1 block text-xs font-semibold text-[#5e3f3a]";
const fieldClassName =
    "h-9 w-full rounded-md border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]";

const emptyFilters = { keyword: "", fromDate: "", toDate: "", unpermittedOnly: false };

interface UsbLogListProps {
    // With deviceId or machineName, only that machine's sessions are shown and the filter bar is hidden.
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

    const [draft, setDraft] = useState(emptyFilters);
    const [applied, setApplied] = useState(emptyFilters);

    const [pageIndex, setPageIndex] = useState(1);
    const [sort, setSort] = useState<SortState>(NO_SORT);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    const showMachine = deviceId === undefined && machineName === undefined;
    const columnCount = showMachine ? 7 : 6;

    const { isLoading, error, refetch } = useFetchEffect(
        () =>
            UsbLogApi.getSessions({
                pageIndex,
                pageSize: PAGE_SIZE,
                deviceId,
                machineName,
                usbDeviceId,
                keyword: applied.keyword || undefined,
                fromDate: applied.fromDate || undefined,
                toDate: applied.toDate || undefined,
                unpermittedOnly: applied.unpermittedOnly,
                ...sort,
            }),
        [pageIndex, applied, deviceId, machineName, usbDeviceId, sort],
        (result) => {
            setRows(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
        },
        t("sessions.loadError"),
        (message) => toast.error(message),
        showMachine ? "usb-log" : undefined
    );

    const handleSort = (next: SortState) => {
        setPageIndex(1);
        setSort(next);
    };

    const handleSearch = () => {
        setPageIndex(1);
        setApplied({ ...draft, keyword: draft.keyword.trim() });
    };

    const handleReset = () => {
        setPageIndex(1);
        setDraft(emptyFilters);
        setApplied(emptyFilters);
    };

    return (
        <div className="space-y-4">
            {showMachine && (
                <>
                    <div className="flex items-center justify-between gap-3">
                        <h1 className="text-lg font-semibold text-[#191c1e]">{t("sessions.title")}</h1>
                        <button
                            onClick={() => refetch()}
                            disabled={isLoading}
                            title={t("common.refresh")}
                            aria-label={t("common.refresh")}
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-[#e0e3e5] bg-white text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                    </div>

                    <section className="rounded-lg border border-[#e0e3e5] bg-white p-2.5 shadow-sm">
                        <div className="flex flex-wrap items-end gap-x-2 gap-y-2 [&>label]:w-[calc(50%-0.25rem)] sm:[&>label]:w-40">
                            <label className="block max-sm:w-full! sm:w-64!">
                                <span className={fieldLabelClassName}>{t("common.search")}</span>
                                <input
                                    value={draft.keyword}
                                    onChange={(event) => setDraft({ ...draft, keyword: event.target.value })}
                                    onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                                    placeholder={t("sessions.searchPlaceholder")}
                                    className={fieldClassName}
                                />
                            </label>
                            <label className="block">
                                <span className={fieldLabelClassName}>{t("common.fromDate")}</span>
                                <input
                                    type="date"
                                    value={draft.fromDate}
                                    onChange={(event) => setDraft({ ...draft, fromDate: event.target.value })}
                                    className={fieldClassName}
                                />
                            </label>
                            <label className="block">
                                <span className={fieldLabelClassName}>{t("common.toDate")}</span>
                                <input
                                    type="date"
                                    value={draft.toDate}
                                    onChange={(event) => setDraft({ ...draft, toDate: event.target.value })}
                                    className={fieldClassName}
                                />
                            </label>
                            <label className="flex h-9 w-auto! cursor-pointer items-center gap-2 text-sm text-[#191c1e]">
                                <input
                                    type="checkbox"
                                    checked={draft.unpermittedOnly}
                                    onChange={(event) => setDraft({ ...draft, unpermittedOnly: event.target.checked })}
                                    className="h-4 w-4 accent-[#e3000f]"
                                />
                                {t("common.notApproved")}
                            </label>

                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={handleSearch}
                                    disabled={isLoading}
                                    title={t("common.search")}
                                    aria-label={t("common.search")}
                                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md bg-[#e3000f] text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <Search className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={handleReset}
                                    disabled={isLoading}
                                    title={t("common.clearFilter")}
                                    aria-label={t("common.clearFilter")}
                                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-[#e0e3e5] bg-white text-[#5e3f3a] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <FilterX className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </section>
                </>
            )}

            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">

                {error && <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>}

                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">
                                <SortableTh label={t("sessions.connectedAt")} sortKey="connectedAt" sort={sort} onSort={handleSort} className="px-3 py-2" />
                                <SortableTh label={t("sessions.disconnectedAt")} sortKey="disconnectedAt" sort={sort} onSort={handleSort} className="hidden px-3 py-2 lg:table-cell" />
                                {showMachine && <SortableTh label={t("common.machine")} sortKey="machineName" sort={sort} onSort={handleSort} className="px-3 py-2" />}
                                <SortableTh label={t("common.user")} sortKey="windowsUser" sort={sort} onSort={handleSort} className="hidden px-3 py-2 lg:table-cell" />
                                {usbDeviceId === undefined ? (
                                    <SortableTh label="USB" sortKey="usb" sort={sort} onSort={handleSort} className="px-3 py-2" />
                                ) : (
                                    <th className="px-3 py-2">{t("sessions.drive")}</th>
                                )}
                                <SortableTh label={t("common.file")} sortKey="fileEventCount" sort={sort} onSort={handleSort} className="px-3 py-2" />
                                <th className="px-3 py-2 text-right">{t("sessions.detail")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && rows.length === 0 && (
                                <tr>
                                    <td colSpan={columnCount} className="px-6 py-8 text-center text-sm text-[#5e3f3a]">
                                        {t("common.noData")}
                                    </td>
                                </tr>
                            )}
                            {rows.map((row) => (
                                <Fragment key={row.id}>
                                    <tr className="border-b border-[#f1f5f9] align-top">
                                        <td className="px-3 py-2 text-sm text-[#191c1e] lg:whitespace-nowrap">{formatDateTime(row.connectedAt)}</td>
                                        <td className="hidden lg:table-cell whitespace-nowrap px-3 py-2 text-sm text-[#5e3f3a]">
                                            {row.disconnectedAt ? (
                                                formatDateTime(row.disconnectedAt)
                                            ) : row.agentOnline ? (
                                                t("common.connectedNow")
                                            ) : (
                                                <span title={t("sessions.unknownTitle")}>{t("sessions.unknown")}</span>
                                            )}
                                        </td>
                                        {showMachine && (
                                            <td className="px-3 py-2 text-sm text-[#191c1e]">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold">{row.deviceCode ?? row.machineName}</span>
                                                    {row.wasPermitted === false && (
                                                        <span
                                                            title={t("common.unpermittedMachineTitle")}
                                                            className="shrink-0 rounded-full border border-[#f3d9b1] bg-[#fff8ee] px-2 py-0.5 text-[10px] font-semibold text-[#8a5a00]"
                                                        >
                                                            {t("common.unpermittedMachine")}
                                                        </span>
                                                    )}
                                                </div>
                                                {row.deviceCode && <div className="text-xs text-[#5e3f3a]">{row.machineName}</div>}
                                            </td>
                                        )}
                                        <td className="hidden lg:table-cell px-3 py-2 text-sm text-[#5e3f3a]">{row.windowsUser || "-"}</td>
                                        <td className="px-3 py-2 text-sm text-[#191c1e]">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span>{usbDeviceId === undefined ? usbLabel({ ...row, alias: row.usbAlias }) : row.driveLetter || "-"}</span>
                                                {row.policyResult !== null && POLICY_META[row.policyResult] && (
                                                    <span title={t(`policy.${POLICY_META[row.policyResult].key}.title`)}>
                                                        <Badge variant={POLICY_META[row.policyResult].variant}>{t(`policy.${POLICY_META[row.policyResult].key}.label`)}</Badge>
                                                    </span>
                                                )}
                                            </div>
                                            <div className={usbDeviceId === undefined ? "break-all text-xs text-[#5e3f3a]" : "hidden"}>
                                                {[
                                                    row.deviceClass === "DiskDrive" ? null : deviceClassLabel(t, row.deviceClass),
                                                    row.driveLetter,
                                                    row.serialNumber,
                                                    formatBytes(row.capacityBytes),
                                                ]
                                                    .filter((v) => v && v !== "-")
                                                    .join(" · ")}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-sm text-[#5e3f3a]">
                                            <UsbFileCount total={row.fileEventCount} sensitive={row.sensitiveFileCount} />
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            <button
                                                onClick={() => setExpandedId((current) => (current === row.id ? null : row.id))}
                                                disabled={row.fileEventCount === 0}
                                                className="cursor-pointer font-semibold text-[#5e3f3a] transition hover:text-[#191c1e] disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                                {expandedId === row.id ? t("sessions.hide") : t("sessions.view")}
                                            </button>
                                        </td>
                                    </tr>
                                    {expandedId === row.id && (
                                        <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                                            <td colSpan={columnCount} className="px-3 py-2">
                                                <UsbSessionFiles sessionId={row.id} sensitiveCount={row.sensitiveFileCount} />
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>

                <Pagination
                    pageIndex={pageIndex}
                    totalPages={totalPages}
                    onPageChange={setPageIndex}
                    disabled={isLoading}
                    summary={isLoading ? t("common.loadingData") : t("common.shownSessions", { shown: rows.length, total: totalCount })}
                    compactSummary={isLoading ? t("common.loadingData") : t("common.shownSessions", { shown: rows.length, total: totalCount })}
                />
            </section>
        </div>
    );
}
