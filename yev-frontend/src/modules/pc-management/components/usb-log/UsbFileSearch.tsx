"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";

import { Pagination } from "@/components/ui/Pagination";
import { NO_SORT, SortableTh, type SortState } from "@/components/ui/SortableTh";
import { StyledSelect } from "@/components/ui/StyledSelect";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { UsbLogApi } from "@/modules/pc-management/api/usb-log.api";
import type { UsbFileSearchDto } from "@/modules/pc-management/types/usb-log.dto";
import { useRouter } from "@/navigation";
import UsbExportButton from "./UsbExportButton";
import { DateRange, ErrorBar, FilterActions, ListToolbar, SearchField, TableStatusRows, ToggleChip, fieldClassName, rowClassName, theadRowClassName } from "@/components/ui/ListToolbar";
import { UsbOwnerCell, UsbOwnerFilterFields, useUsbOwnerOptions } from "./UsbOwnerFilter";
import { UsbFileAction, UsbFilePath } from "./UsbSessionFiles";
import { formatBytes, formatDateTime } from "./usb-log-format";
import { readPersisted, usePersistOnChange, usePersistedState } from "@/modules/common/hooks/usePersistedState";
import { TableScroll } from "@/components/ui/TableScroll";

const PAGE_SIZE = 20;
const COLUMNS = 8;

const emptyFilters = { keyword: "", extension: "", fromDate: "", toDate: "", direction: "", sensitiveOnly: false, branchId: 0, departmentId: 0 };

// Leak investigation starts from the file: every operation on it across all PCs, with the machine, user and USB.
export default function UsbFileSearch() {
    const t = useTranslations("usbLog");
    const router = useRouter();
    const owners = useUsbOwnerOptions();
    const [rows, setRows] = useState<UsbFileSearchDto[]>([]);

    // Filters, page and sort survive opening a machine and coming back.
    const [saved] = useState(() => readPersisted<{ draft: typeof emptyFilters; applied: typeof emptyFilters; pageIndex: number; sort: SortState }>("list:pc/usb-log:files"));
    const [draft, setDraft] = useState({ ...emptyFilters, ...saved?.draft });
    const [applied, setApplied] = useState({ ...emptyFilters, ...saved?.applied });
    const [pageIndex, setPageIndex] = useState(saved?.pageIndex ?? 1);
    const [pageSize, setPageSize] = usePersistedState("page-size:pc-management/components/usb-log/UsbFileSearch", PAGE_SIZE);
    const [sort, setSort] = useState<SortState>(saved?.sort ?? NO_SORT);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    usePersistOnChange("list:pc/usb-log:files", { draft, applied, pageIndex, sort });

    const filterParams = () => ({
        keyword: applied.keyword || undefined,
        extension: applied.extension || undefined,
        fromDate: applied.fromDate || undefined,
        toDate: applied.toDate || undefined,
        direction: applied.direction || undefined,
        sensitiveOnly: applied.sensitiveOnly,
        branchId: applied.branchId || undefined,
        departmentId: applied.departmentId || undefined,
    });

    const { isLoading, error, refetch } = useFetchEffect(
        () => UsbLogApi.searchFiles({ pageIndex, pageSize, ...filterParams(), ...sort }),
        [pageIndex, pageSize, applied, sort],
        (result) => {
            setRows(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
        },
        t("fileSearch.loadError"),
        (message) => toast.error(message),
        "usb-file-search"
    );

    const handleSort = (next: SortState) => {
        setPageIndex(1);
        setSort(next);
    };

    const handleSearch = () => {
        setPageIndex(1);
        setApplied({ ...draft, keyword: draft.keyword.trim(), extension: draft.extension.trim() });
    };

    const handleReset = () => {
        setPageIndex(1);
        setDraft(emptyFilters);
        setApplied(emptyFilters);
    };

    const openMachine = (row: UsbFileSearchDto) => {
        const query: Record<string, string> = { machine: row.machineName, tab: "files" };
        if (row.deviceId) query.deviceId = String(row.deviceId);
        router.push({ pathname: "/pc/usb-log", query });
    };

    const directionOptions = [
        { value: "", label: t("fileSearch.allDirections") },
        { value: "out", label: t("fileSearch.out") },
        { value: "in", label: t("fileSearch.in") },
        { value: "deleted", label: t("fileSearch.deleted") },
    ];

    const summary = isLoading ? t("common.loadingData") : t("fileSearch.shown", { shown: rows.length, total: totalCount });

    return (
        <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
            <ListToolbar
                actions={<UsbExportButton items={[{ label: t("common.export"), fallbackFileName: "ThaoTacFileUSB.xlsx", download: () => UsbLogApi.exportFiles(filterParams()) }]} />}
            >
                <SearchField value={draft.keyword} onChange={(keyword) => setDraft({ ...draft, keyword })} onEnter={handleSearch} placeholder={t("fileSearch.searchPlaceholder")} wide />
                <input
                    value={draft.extension}
                    onChange={(event) => setDraft({ ...draft, extension: event.target.value })}
                    onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                    placeholder=".xlsx"
                    aria-label={t("fileSearch.extension")}
                    title={t("fileSearch.extension")}
                    className={`${fieldClassName} w-24`}
                />
                <DateRange from={draft.fromDate} to={draft.toDate} onChange={(range) => setDraft({ ...draft, ...range })} title={t("fileSearch.dateRange")} />
                <div className="w-[calc(50%-0.25rem)] sm:w-36">
                    <StyledSelect
                        value={draft.direction}
                        onChange={(direction) => setDraft({ ...draft, direction })}
                        options={directionOptions}
                        ariaLabel={t("common.actions")}
                        triggerClassName={`${fieldClassName} w-full pr-8`}
                    />
                </div>
                <UsbOwnerFilterFields options={owners} value={draft} onChange={(owner) => setDraft({ ...draft, ...owner })} />
                <ToggleChip
                    checked={draft.sensitiveOnly}
                    onChange={(sensitiveOnly) => setDraft({ ...draft, sensitiveOnly })}
                    icon={TriangleAlert}
                    label={t("files.sensitive")}
                    title={t("files.sensitiveTitle")}
                    compact
                />
                <FilterActions onSearch={handleSearch} onReset={handleReset} onRefresh={() => refetch()} disabled={isLoading} />
            </ListToolbar>

            <ErrorBar message={error} />

            <TableScroll className="relative">
                <table className="min-w-full border-collapse text-left text-sm">
                    <thead>
                        <tr className={theadRowClassName}>
                            <SortableTh label={t("files.time")} sortKey="occurredAt" sort={sort} onSort={handleSort} className="px-3 py-2" />
                            <SortableTh label={t("common.file")} sortKey="filePath" sort={sort} onSort={handleSort} className="px-3 py-2" />
                            <SortableTh label={t("common.actions")} sortKey="action" sort={sort} onSort={handleSort} className="hidden px-3 py-2 sm:table-cell" />
                            <SortableTh label={t("files.size")} sortKey="sizeBytes" sort={sort} onSort={handleSort} className="hidden px-3 py-2 text-right 2xl:table-cell" />
                            <SortableTh label={t("common.machine")} sortKey="machineName" sort={sort} onSort={handleSort} className="px-3 py-2" />
                            <th className="hidden px-3 py-2 2xl:table-cell">{t("common.owner")}</th>
                            <SortableTh label={t("common.user")} sortKey="windowsUser" sort={sort} onSort={handleSort} className="hidden px-3 py-2 md:table-cell" />
                            <th className="hidden px-3 py-2 lg:table-cell">USB</th>
                        </tr>
                    </thead>
                    <tbody>
                        <TableStatusRows loading={isLoading} empty={rows.length === 0} columns={COLUMNS} emptyText={t("fileSearch.empty")} />
                        {rows.map((row) => (
                            <tr key={row.id} onClick={() => openMachine(row)} className={`${rowClassName} cursor-pointer`}>
                                <td className="whitespace-nowrap px-3 py-2 tabular-nums text-[#5e3f3a]">{formatDateTime(row.occurredAt)}</td>
                                <td className="min-w-64 px-3 py-2 text-[#191c1e] wrap-anywhere">
                                    <UsbFilePath file={row} />
                                </td>
                                <td className="hidden whitespace-nowrap px-3 py-2 sm:table-cell">
                                    <UsbFileAction action={row.action} text={row.actionText} />
                                </td>
                                <td className="hidden whitespace-nowrap px-3 py-2 text-right tabular-nums text-[#5e3f3a] 2xl:table-cell">{formatBytes(row.sizeBytes)}</td>
                                <td className="whitespace-nowrap px-3 py-2">
                                    <div className="font-semibold text-[#191c1e]">{row.deviceCode ?? row.machineName}</div>
                                    {row.deviceCode && <div className="text-xs text-[#5e3f3a]">{row.machineName}</div>}
                                </td>
                                <td className="hidden px-3 py-2 text-[#191c1e] 2xl:table-cell">
                                    <UsbOwnerCell branchName={row.branchName} departmentName={row.departmentName} />
                                </td>
                                <td className="hidden px-3 py-2 text-[#5e3f3a] md:table-cell">{row.windowsUser || "-"}</td>
                                <td className="hidden px-3 py-2 lg:table-cell">
                                    <div className="whitespace-nowrap text-[#191c1e]">{row.usbAlias ?? row.friendlyName ?? "-"}</div>
                                    <div className="break-all text-xs text-[#8a8f94]">{row.serialNumber}</div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </TableScroll>

            <Pagination pageSize={pageSize} onPageSizeChange={setPageSize} pageIndex={pageIndex} totalPages={totalPages} onPageChange={setPageIndex} disabled={isLoading} summary={summary} compactSummary={summary} />
        </section>
    );
}
