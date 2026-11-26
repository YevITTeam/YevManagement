"use client";

import { Pagination } from "@/components/ui/Pagination";
import { useState } from "react";
import { FilterX, RefreshCw, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";

import { useRouter } from "@/navigation";
import { UsbLogApi } from "@/modules/pc-management/api/usb-log.api";
import type { UsbMachineDto } from "@/modules/pc-management/types/usb-log.dto";
import { NO_SORT, SortableTh, type SortState } from "@/components/ui/SortableTh";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import UsbExportButton from "./UsbExportButton";
import { formatDateTime } from "./usb-log-format";
import { UsbOwnerCell, UsbOwnerFilterFields, useUsbOwnerOptions } from "./UsbOwnerFilter";

const PAGE_SIZE = 20;

const fieldLabelClassName = "mb-1 block text-xs font-semibold text-[#5e3f3a]";
const fieldClassName =
    "h-9 w-full rounded-md border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]";

const emptyFilters = { keyword: "", fromDate: "", toDate: "", connectedNowOnly: false, branchId: 0, departmentId: 0 };

// PCs with USB activity.
export default function UsbMachineList() {
    const t = useTranslations("usbLog");
    const router = useRouter();
    const [rows, setRows] = useState<UsbMachineDto[]>([]);
    const owners = useUsbOwnerOptions();

    const [draft, setDraft] = useState(emptyFilters);
    const [applied, setApplied] = useState(emptyFilters);
    const exportFilter = () => ({
        keyword: applied.keyword || undefined,
        fromDate: applied.fromDate || undefined,
        toDate: applied.toDate || undefined,
        branchId: applied.branchId || undefined,
        departmentId: applied.departmentId || undefined,
    });

    const [pageIndex, setPageIndex] = useState(1);
    const [sort, setSort] = useState<SortState>(NO_SORT);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    const { isLoading, error, refetch } = useFetchEffect(
        () =>
            UsbLogApi.getMachines({
                pageIndex,
                pageSize: PAGE_SIZE,
                keyword: applied.keyword || undefined,
                fromDate: applied.fromDate || undefined,
                toDate: applied.toDate || undefined,
                connectedNowOnly: applied.connectedNowOnly,
                branchId: applied.branchId || undefined,
                departmentId: applied.departmentId || undefined,
                ...sort,
            }),
        [pageIndex, applied, sort],
        (result) => {
            setRows(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
        },
        t("machines.loadError"),
        (message) => toast.error(message),
        "usb-machines"
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

    const openMachine = (row: UsbMachineDto) =>
        router.push({
            pathname: "/pc/usb-log",
            query: row.deviceId ? { machine: row.machineName, deviceId: String(row.deviceId) } : { machine: row.machineName },
        });

    return (
        <div className="space-y-4">
            <section className="rounded-lg border border-[#e0e3e5] bg-white p-2.5 shadow-sm">
                <div className="flex flex-wrap items-end gap-x-2 gap-y-2 [&>label]:w-[calc(50%-0.25rem)] sm:[&>label]:w-40">
                    <label className="block max-sm:w-full! sm:w-64!">
                        <span className={fieldLabelClassName}>{t("common.search")}</span>
                        <input
                            value={draft.keyword}
                            onChange={(event) => setDraft({ ...draft, keyword: event.target.value })}
                            onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                            placeholder={t("machines.searchPlaceholder")}
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
                    <UsbOwnerFilterFields options={owners} value={draft} onChange={(owner) => setDraft({ ...draft, ...owner })} />
                    <label className="flex h-9 w-auto! cursor-pointer items-center gap-2 text-sm text-[#191c1e]">
                        <input
                            type="checkbox"
                            checked={draft.connectedNowOnly}
                            onChange={(event) => setDraft({ ...draft, connectedNowOnly: event.target.checked })}
                            className="h-4 w-4 accent-[#e3000f]"
                        />
                        {t("common.connectedNow")}
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
                        <button
                            onClick={() => refetch()}
                            disabled={isLoading}
                            title={t("common.refresh")}
                            aria-label={t("common.refresh")}
                            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-[#e0e3e5] bg-white text-[#5e3f3a] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <RefreshCw className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="flex items-center gap-1.5 sm:ml-auto">
                        <UsbExportButton
                            label={t("machines.exportSessions")}
                            title={t("machines.exportSessionsTitle")}
                            fallbackFileName="PhienCamUSB.xlsx"
                            download={() => UsbLogApi.exportSessions(exportFilter())}
                        />
                        <UsbExportButton
                            label={t("common.fileEvents")}
                            title={t("machines.exportFilesTitle")}
                            fallbackFileName="ThaoTacFileUSB.xlsx"
                            download={() => UsbLogApi.exportFiles(exportFilter())}
                        />
                    </div>
                </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">

                {error && <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>}

                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">
                                <SortableTh label={t("common.machine")} sortKey="machineName" sort={sort} onSort={handleSort} className="px-3 py-2" />
                                <th className="hidden whitespace-nowrap px-3 py-2 md:table-cell">{t("common.owner")}</th>
                                <SortableTh label={t("machines.lastUser")} sortKey="lastWindowsUser" sort={sort} onSort={handleSort} className="hidden px-3 py-2 lg:table-cell" />
                                <SortableTh label="USB" sortKey="usbDeviceCount" sort={sort} onSort={handleSort} className="hidden px-3 py-2 text-right lg:table-cell" />
                                <SortableTh label={t("common.sessionCount")} sortKey="sessionCount" sort={sort} onSort={handleSort} className="px-3 py-2 text-right" />
                                <SortableTh label={t("common.fileEvents")} sortKey="fileEventCount" sort={sort} onSort={handleSort} className="hidden px-3 py-2 text-right lg:table-cell" />
                                <SortableTh label={t("common.lastSeen")} sortKey="lastConnectedAt" sort={sort} onSort={handleSort} className="px-3 py-2" />
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && rows.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-sm text-[#5e3f3a]">
                                        {t("machines.empty")}
                                    </td>
                                </tr>
                            )}
                            {rows.map((row) => (
                                <tr
                                    key={row.machineName}
                                    onClick={() => openMachine(row)}
                                    className="cursor-pointer border-b border-[#f1f5f9] transition hover:bg-[#f8fafc]"
                                >
                                    <td className="px-3 py-2 text-sm text-[#191c1e]">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-semibold">{row.deviceCode ?? row.machineName}</span>
                                            {row.isConnectedNow && (
                                                <span className="shrink-0 rounded-full border border-[#bfe5c8] bg-[#eefaf1] px-2 py-0.5 text-[10px] font-semibold text-[#0f6b2a]">
                                                    {t("common.connectedNow")}
                                                </span>
                                            )}
                                            {row.blockedCount > 0 && (
                                                <span
                                                    title={t("machines.writeBlockedTitle")}
                                                    className="shrink-0 rounded-full border border-[#e9bcb6] bg-[#fff4f2] px-2 py-0.5 text-[10px] font-semibold text-[#930006]">
                                                    {t("machines.writeBlocked")}
                                                </span>
                                            )}
                                            {row.unpermittedCount > 0 && (
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
                                    <td className="hidden px-3 py-2 text-sm text-[#191c1e] md:table-cell">
                                        <UsbOwnerCell branchName={row.branchName} departmentName={row.departmentName} />
                                    </td>
                                    <td className="hidden px-3 py-2 text-sm text-[#5e3f3a] lg:table-cell">{row.lastWindowsUser || "-"}</td>
                                    <td className="hidden lg:table-cell px-3 py-2 text-right text-sm text-[#191c1e]">{row.usbDeviceCount}</td>
                                    <td className="px-3 py-2 text-right text-sm text-[#191c1e]">{row.sessionCount}</td>
                                    <td className="hidden lg:table-cell px-3 py-2 text-right text-sm text-[#191c1e]">{row.fileEventCount}</td>
                                    <td className="whitespace-nowrap px-3 py-2 text-sm text-[#5e3f3a]">{formatDateTime(row.lastConnectedAt)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <Pagination
                    pageIndex={pageIndex}
                    totalPages={totalPages}
                    onPageChange={setPageIndex}
                    disabled={isLoading}
                    summary={isLoading ? t("common.loadingData") : t("common.shownMachines", { shown: rows.length, total: totalCount })}
                    compactSummary={isLoading ? t("common.loadingData") : t("common.shownMachines", { shown: rows.length, total: totalCount })}
                />
            </section>
        </div>
    );
}
