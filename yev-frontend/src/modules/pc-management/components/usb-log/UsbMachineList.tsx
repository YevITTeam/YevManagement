"use client";

import { useState } from "react";
import { Plug, ShieldAlert, ShieldX, TriangleAlert, Unplug } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";

import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { NO_SORT, SortableTh, type SortState } from "@/components/ui/SortableTh";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { UsbLogApi } from "@/modules/pc-management/api/usb-log.api";
import type { UsbMachineDto } from "@/modules/pc-management/types/usb-log.dto";
import { useRouter } from "@/navigation";
import UsbAgentSettings from "./UsbAgentSettings";
import UsbExportButton from "./UsbExportButton";
import { DateRange, ErrorBar, FilterActions, IconFlag, ListToolbar, SearchField, StatusDot, TableStatusRows, ToggleChip, rowClassName, theadRowClassName } from "./UsbListToolbar";
import { UsbOwnerCell, UsbOwnerFilterFields, useUsbOwnerOptions } from "./UsbOwnerFilter";
import { UsbFileCount } from "./UsbSessionFiles";
import { AGENT_EVENT_META, formatDateTime } from "./usb-log-format";
import { readPersisted, usePersistOnChange, usePersistedState } from "@/modules/common/hooks/usePersistedState";
import { TableScroll } from "@/components/ui/TableScroll";

const PAGE_SIZE = 20;
const COLUMNS = 10;

const emptyFilters = { keyword: "", fromDate: "", toDate: "", connectedNowOnly: false, sensitiveOnly: false, staleOnly: false, branchId: 0, departmentId: 0 };

// Every PC with an agent plus PCs that only have USB history: agent health and USB use on one row.
export default function UsbMachineList() {
    const t = useTranslations("usbLog");
    const router = useRouter();
    const { user } = useAuth();
    const canEdit = hasPermission(user, "Asset.UsbLog.Approve");
    const [rows, setRows] = useState<UsbMachineDto[]>([]);
    const owners = useUsbOwnerOptions();

    // Filters, page and sort survive opening a machine and coming back.
    const [saved] = useState(() => readPersisted<{ draft: typeof emptyFilters; applied: typeof emptyFilters; pageIndex: number; sort: SortState }>("list:pc/usb-log:machines"));
    const [draft, setDraft] = useState({ ...emptyFilters, ...saved?.draft });
    const [applied, setApplied] = useState({ ...emptyFilters, ...saved?.applied });
    const [pageIndex, setPageIndex] = useState(saved?.pageIndex ?? 1);
    const [pageSize, setPageSize] = usePersistedState("page-size:pc-management/components/usb-log/UsbMachineList", PAGE_SIZE);
    const [sort, setSort] = useState<SortState>(saved?.sort ?? NO_SORT);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    usePersistOnChange("list:pc/usb-log:machines", { draft, applied, pageIndex, sort });

    const filterParams = () => ({
        keyword: applied.keyword || undefined,
        fromDate: applied.fromDate || undefined,
        toDate: applied.toDate || undefined,
        connectedNowOnly: applied.connectedNowOnly,
        sensitiveOnly: applied.sensitiveOnly,
        staleOnly: applied.staleOnly,
        branchId: applied.branchId || undefined,
        departmentId: applied.departmentId || undefined,
    });

    // The sessions export uses the session filter, which has no agent-only criteria.
    const sessionFilter = () => ({
        keyword: applied.keyword || undefined,
        fromDate: applied.fromDate || undefined,
        toDate: applied.toDate || undefined,
        sensitiveOnly: applied.sensitiveOnly,
        branchId: applied.branchId || undefined,
        departmentId: applied.departmentId || undefined,
    });

    const { isLoading, error, refetch } = useFetchEffect(
        () => UsbLogApi.getMachines({ pageIndex, pageSize, ...filterParams(), ...sort }),
        [pageIndex, pageSize, applied, sort],
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

    const openMachine = (row: UsbMachineDto) => {
        const query: Record<string, string> = { machine: row.machineName };
        if (row.deviceId) query.deviceId = String(row.deviceId);
        if (row.agentId) query.agentId = String(row.agentId);
        router.push({ pathname: "/pc/usb-log", query });
    };

    const summary = isLoading ? t("common.loadingData") : t("common.shownMachines", { shown: rows.length, total: totalCount });

    return (
        <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
            <ListToolbar
                actions={
                    <>
                        <UsbAgentSettings canEdit={canEdit} onPurged={() => refetch()} />
                        <UsbExportButton
                            items={[
                                { label: t("machines.exportMachines"), fallbackFileName: "MayTinhUSB.xlsx", download: () => UsbLogApi.exportMachines(filterParams()) },
                                { label: t("machines.exportSessions"), fallbackFileName: "PhienCamUSB.xlsx", download: () => UsbLogApi.exportSessions(sessionFilter()) },
                            ]}
                        />
                    </>
                }
            >
                <SearchField value={draft.keyword} onChange={(keyword) => setDraft({ ...draft, keyword })} onEnter={handleSearch} placeholder={t("machines.searchPlaceholder")} />
                <DateRange from={draft.fromDate} to={draft.toDate} onChange={(range) => setDraft({ ...draft, ...range })} />
                <UsbOwnerFilterFields options={owners} value={draft} onChange={(owner) => setDraft({ ...draft, ...owner })} />
                <ToggleChip checked={draft.connectedNowOnly} onChange={(connectedNowOnly) => setDraft({ ...draft, connectedNowOnly })} icon={Plug} label={t("common.connectedNow")} compact />
                <ToggleChip
                    checked={draft.sensitiveOnly}
                    onChange={(sensitiveOnly) => setDraft({ ...draft, sensitiveOnly })}
                    icon={TriangleAlert}
                    label={t("files.sensitive")}
                    title={t("files.sensitiveTitle")}
                    compact
                />
                <ToggleChip checked={draft.staleOnly} onChange={(staleOnly) => setDraft({ ...draft, staleOnly })} icon={Unplug} label={t("common.stale")} title={t("agents.staleTitle")} compact />
                <FilterActions onSearch={handleSearch} onReset={handleReset} onRefresh={() => refetch()} disabled={isLoading} />
            </ListToolbar>

            <ErrorBar message={error} />

            <TableScroll className="relative">
                <table className="min-w-full border-collapse text-left text-sm">
                    <thead>
                        <tr className={theadRowClassName}>
                            <SortableTh label={t("common.machine")} sortKey="machineName" sort={sort} onSort={handleSort} className="px-3 py-2" />
                            <th className="hidden px-3 py-2 md:table-cell">{t("common.owner")}</th>
                            <SortableTh label={t("common.user")} sortKey="lastWindowsUser" sort={sort} onSort={handleSort} className="hidden px-3 py-2 2xl:table-cell" />
                            <SortableTh label={t("agents.version")} sortKey="agentVersion" sort={sort} onSort={handleSort} className="hidden px-3 py-2 lg:table-cell" />
                            <SortableTh label="USB" sortKey="usbDeviceCount" sort={sort} onSort={handleSort} className="hidden px-3 py-2 text-right 2xl:table-cell" />
                            <SortableTh label={t("common.sessionCount")} sortKey="sessionCount" sort={sort} onSort={handleSort} className="px-3 py-2 text-right" />
                            <SortableTh label={t("common.file")} sortKey="fileEventCount" sort={sort} onSort={handleSort} className="hidden px-3 py-2 lg:table-cell" />
                            <SortableTh label={t("machines.lastConnected")} sortKey="lastConnectedAt" sort={sort} onSort={handleSort} className="hidden px-3 py-2 sm:table-cell" />
                            <SortableTh label={t("agents.lastSeen")} sortKey="agentLastSeenAt" sort={sort} onSort={handleSort} className="hidden px-3 py-2 md:table-cell" />
                            <th className="hidden px-3 py-2 2xl:table-cell">{t("agents.events")}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <TableStatusRows loading={isLoading} empty={rows.length === 0} columns={COLUMNS} emptyText={t("machines.empty")} />
                        {rows.map((row) => {
                            const lastEvent = row.lastEventType ? AGENT_EVENT_META[row.lastEventType] : undefined;
                            const agentTone = row.agentId === null ? "idle" : row.isStale ? "offline" : "online";
                            const agentLabel = row.agentId === null ? t("machines.noAgent") : row.isStale ? t("common.stale") : t("common.online");
                            return (
                                <tr key={row.machineName} onClick={() => openMachine(row)} className={`${rowClassName} cursor-pointer`}>
                                    <td className="px-3 py-2">
                                        <div className="flex items-center gap-1.5">
                                            <StatusDot tone={agentTone} label={agentLabel} />
                                            <span className="whitespace-nowrap font-semibold text-[#191c1e]">{row.deviceCode ?? row.machineName}</span>
                                            {row.isConnectedNow && <IconFlag icon={Plug} tone="success" label={t("common.connectedNow")} />}
                                            {row.blockedCount > 0 && <IconFlag icon={ShieldX} tone="danger" label={t("machines.writeBlockedTitle")} />}
                                            {row.unpermittedCount > 0 && <IconFlag icon={ShieldAlert} tone="warning" label={t("common.unpermittedMachineTitle")} />}
                                        </div>
                                        {row.deviceCode && <div className="pl-3.5 text-xs text-[#5e3f3a]">{row.machineName}</div>}
                                    </td>
                                    <td className="hidden px-3 py-2 text-[#191c1e] md:table-cell">
                                        <UsbOwnerCell branchName={row.branchName} departmentName={row.departmentName} />
                                    </td>
                                    <td className="hidden px-3 py-2 text-[#5e3f3a] 2xl:table-cell">{row.lastWindowsUser || "-"}</td>
                                    <td className="hidden px-3 py-2 tabular-nums text-[#5e3f3a] lg:table-cell">{row.agentVersion || "-"}</td>
                                    <td className="hidden px-3 py-2 text-right tabular-nums text-[#191c1e] 2xl:table-cell">{row.usbDeviceCount}</td>
                                    <td className={`px-3 py-2 text-right tabular-nums ${row.sessionCount === 0 ? "text-[#8a8f94]" : "text-[#191c1e]"}`}>{row.sessionCount}</td>
                                    <td className="hidden px-3 py-2 text-[#191c1e] lg:table-cell">
                                        <UsbFileCount total={row.fileEventCount} sensitive={row.sensitiveFileCount} />
                                    </td>
                                    <td className="hidden whitespace-nowrap px-3 py-2 tabular-nums text-[#5e3f3a] sm:table-cell">{formatDateTime(row.lastConnectedAt)}</td>
                                    <td
                                        className={`hidden whitespace-nowrap px-3 py-2 tabular-nums md:table-cell ${row.isStale ? "font-medium text-[#930006]" : "text-[#5e3f3a]"}`}
                                        title={row.isStale ? t("agents.staleTitle") : undefined}
                                    >
                                        {formatDateTime(row.agentLastSeenAt)}
                                    </td>
                                    <td className="hidden px-3 py-2 2xl:table-cell">
                                        {lastEvent && (
                                            <span title={formatDateTime(row.lastEventAt)}>
                                                <Badge variant={lastEvent.variant}>{t(`agentEvent.${lastEvent.key}`)}</Badge>
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </TableScroll>

            <Pagination pageSize={pageSize} onPageSizeChange={setPageSize} pageIndex={pageIndex} totalPages={totalPages} onPageChange={setPageIndex} disabled={isLoading} summary={summary} compactSummary={summary} />
        </section>
    );
}
