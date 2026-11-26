"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, Eraser, FilterX, RefreshCw, Search, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";

import ConfirmDialog from "@/components/common/ConfirmDialog";
import FormDialog from "@/components/common/FormDialog";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { NO_SORT, SortableTh, type SortState } from "@/components/ui/SortableTh";
import { getApiErrorMessage } from "@/lib/apiError";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { UsbLogApi } from "@/modules/pc-management/api/usb-log.api";
import type { UsbAgentDto, UsbAgentEventDto } from "@/modules/pc-management/types/usb-log.dto";
import UsbAgentSettings from "./UsbAgentSettings";
import UsbExportButton from "./UsbExportButton";
import { AGENT_EVENT_META, formatDateTime } from "./usb-log-format";
import { UsbOwnerCell, UsbOwnerFilterFields, useUsbOwnerOptions } from "./UsbOwnerFilter";

const PAGE_SIZE = 20;

const fieldLabelClassName = "mb-1 block text-xs font-semibold text-[#5e3f3a]";
const fieldClassName =
    "h-9 w-full rounded-md border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]";
const iconButtonClassName =
    "flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-[#e0e3e5] bg-white text-[#5e3f3a] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50";

const emptyFilters = { keyword: "", staleOnly: false, branchId: 0, departmentId: 0 };

// PCs running YevUsbAgent; stale = no sync for 24h (PC off, agent stopped or removed).
export default function UsbAgentList() {
    const t = useTranslations("usbLog");
    const { user } = useAuth();
    const canEdit = hasPermission(user, "Asset.UsbLog.Approve");
    const [rows, setRows] = useState<UsbAgentDto[]>([]);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [events, setEvents] = useState<UsbAgentEventDto[] | null>(null);
    const [draft, setDraft] = useState(emptyFilters);
    const [applied, setApplied] = useState(emptyFilters);
    const [pageIndex, setPageIndex] = useState(1);
    const [sort, setSort] = useState<SortState>(NO_SORT);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const owners = useUsbOwnerOptions();
    const [busy, setBusy] = useState(false);
    const [deleting, setDeleting] = useState<UsbAgentDto | null>(null);
    const [purgeOpen, setPurgeOpen] = useState(false);
    const [purgeUninstalled, setPurgeUninstalled] = useState(true);
    const [purgeOffline, setPurgeOffline] = useState(false);
    const [offlineDays, setOfflineDays] = useState(30);
    const columnCount = canEdit ? 9 : 8;

    const { isLoading, error, refetch } = useFetchEffect(
        () =>
            UsbLogApi.getAgents({
                pageIndex,
                pageSize: PAGE_SIZE,
                keyword: applied.keyword || undefined,
                staleOnly: applied.staleOnly,
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
        t("agents.loadError"),
        (message) => toast.error(message),
        "usb-agents"
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

    const run = async (action: () => Promise<void>, failMessage: string) => {
        setBusy(true);
        try {
            await action();
            refetch();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, failMessage));
        } finally {
            setBusy(false);
        }
    };

    const handleDelete = () =>
        run(async () => {
            if (!deleting) return;
            await UsbLogApi.deleteAgent(deleting.id);
            setDeleting(null);
            toast.success(t("agents.deleteSuccess"));
        }, t("agents.deleteFailed"));

    const handlePurge = () => {
        if (!purgeUninstalled && !purgeOffline) {
            toast.error(t("agents.purgeSelectType"));
            return;
        }
        return run(async () => {
            const count = await UsbLogApi.purgeAgents({ uninstalled: purgeUninstalled, offlineDays: purgeOffline ? offlineDays : null });
            setPurgeOpen(false);
            toast.success(t("agents.purgeSuccess", { count }));
        }, t("agents.purgeFailed"));
    };

    const toggle = (machineName: string) => {
        if (expanded === machineName) {
            setExpanded(null);
            return;
        }
        setExpanded(machineName);
        setEvents(null);
        UsbLogApi.getAgentEvents(machineName)
            .then(setEvents)
            .catch(() => {
                setEvents([]);
                toast.error(t("agents.eventsLoadError"));
            });
    };

    return (
        <div className="space-y-4">
            <UsbAgentSettings canEdit={canEdit} />

            <section className="rounded-lg border border-[#e0e3e5] bg-white p-2.5 shadow-sm">
                <div className="flex flex-wrap items-end gap-x-2 gap-y-2">
                    <label className="block w-full sm:w-64">
                        <span className={fieldLabelClassName}>{t("common.search")}</span>
                        <input
                            value={draft.keyword}
                            onChange={(event) => setDraft({ ...draft, keyword: event.target.value })}
                            onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                            placeholder={t("agents.searchPlaceholder")}
                            className={fieldClassName}
                        />
                    </label>
                    <label
                        className="flex h-9 cursor-pointer items-center gap-2 text-sm text-[#191c1e]"
                        title={t("agents.staleTitle")}
                    >
                        <input
                            type="checkbox"
                            checked={draft.staleOnly}
                            onChange={(event) => setDraft({ ...draft, staleOnly: event.target.checked })}
                            className="h-4 w-4 accent-[#e3000f]"
                        />
                        {t("common.stale")}
                    </label>
                    <UsbOwnerFilterFields options={owners} value={draft} onChange={(owner) => setDraft({ ...draft, ...owner })} />
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
                        <button onClick={handleReset} disabled={isLoading} title={t("common.clearFilter")} aria-label={t("common.clearFilter")} className={iconButtonClassName}>
                            <FilterX className="h-4 w-4" />
                        </button>
                        <button onClick={() => refetch()} disabled={isLoading} title={t("common.refresh")} aria-label={t("common.refresh")} className={iconButtonClassName}>
                            <RefreshCw className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="flex items-center gap-1.5 sm:ml-auto">
                        {canEdit && (
                            <button
                                onClick={() => setPurgeOpen(true)}
                                title={t("agents.purgeButtonTitle")}
                                className="inline-flex h-9 cursor-pointer items-center gap-2 whitespace-nowrap rounded-md border border-[#e0e3e5] bg-white px-3 text-sm font-semibold text-[#5e3f3a] transition hover:bg-[#f2f4f6]"
                            >
                                <Eraser className="h-4 w-4" />
                                {t("agents.purge")}
                            </button>
                        )}
                        <UsbExportButton
                            label="Excel"
                            title={t("agents.exportTitle")}
                            fallbackFileName="AgentUSB.xlsx"
                            download={() =>
                                UsbLogApi.exportAgents({
                                    keyword: applied.keyword || undefined,
                                    staleOnly: applied.staleOnly,
                                    branchId: applied.branchId || undefined,
                                    departmentId: applied.departmentId || undefined,
                                })
                            }
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
                                <th className="w-8 px-3 py-2" aria-label={t("agents.expand")} />
                                <SortableTh label={t("common.machine")} sortKey="machineName" sort={sort} onSort={handleSort} className="px-3 py-2" />
                                <th className="hidden whitespace-nowrap px-3 py-2 md:table-cell">{t("common.owner")}</th>
                                <SortableTh label={t("agents.version")} sortKey="agentVersion" sort={sort} onSort={handleSort} className="px-3 py-2" />
                                <SortableTh label={t("common.user")} sortKey="windowsUser" sort={sort} onSort={handleSort} className="hidden px-3 py-2 lg:table-cell" />
                                <SortableTh label={t("agents.firstSeen")} sortKey="firstSeenAt" sort={sort} onSort={handleSort} className="hidden px-3 py-2 lg:table-cell" />
                                <SortableTh label={t("agents.lastSeen")} sortKey="lastSeenAt" sort={sort} onSort={handleSort} className="px-3 py-2" />
                                <th className="whitespace-nowrap px-3 py-2">{t("agents.events")}</th>
                                {canEdit && <th className="w-10 px-3 py-2" aria-label={t("common.actions")} />}
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
                            {rows.map((row) => {
                                const open = expanded === row.machineName;
                                const last = row.lastEventType ? AGENT_EVENT_META[row.lastEventType] : undefined;
                                return (
                                    <Fragment key={row.id}>
                                        <tr
                                            onClick={(event) => {
                                                if (event.detail > 1 || window.getSelection()?.toString()) return;
                                                toggle(row.machineName);
                                            }}
                                            className="cursor-pointer border-b border-[#f1f5f9] transition hover:bg-[#f8fafc]"
                                        >
                                            <td className="px-3 py-2">
                                                <button
                                                    type="button"
                                                    aria-expanded={open}
                                                    aria-label={open ? t("common.collapse") : t("agents.viewEvents")}
                                                    className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-[#5e3f3a] hover:bg-[#f2f4f6]"
                                                >
                                                    {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                </button>
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-2 text-sm font-semibold text-[#191c1e]">{row.machineName}</td>
                                            <td className="hidden px-3 py-2 text-sm text-[#191c1e] md:table-cell">
                                                <UsbOwnerCell branchName={row.branchName} departmentName={row.departmentName} />
                                            </td>
                                            <td className="px-3 py-2 text-sm text-[#5e3f3a]">{row.agentVersion || "-"}</td>
                                            <td className="hidden px-3 py-2 text-sm text-[#5e3f3a] lg:table-cell">{row.windowsUser || "-"}</td>
                                            <td className="hidden whitespace-nowrap px-3 py-2 text-sm text-[#5e3f3a] lg:table-cell">{formatDateTime(row.firstSeenAt)}</td>
                                            <td className="px-3 py-2 text-sm text-[#5e3f3a]">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="whitespace-nowrap">{formatDateTime(row.lastSeenAt)}</span>
                                                    {row.isStale && <Badge variant="danger">{t("common.stale")}</Badge>}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-sm text-[#5e3f3a]">
                                                {last && (
                                                    <span title={formatDateTime(row.lastEventAt)}>
                                                        <Badge variant={last.variant}>{t(`agentEvent.${last.key}`)}</Badge>
                                                    </span>
                                                )}
                                            </td>
                                            {canEdit && (
                                                <td className="px-3 py-2 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            setDeleting(row);
                                                        }}
                                                        title={t("agents.removeFromList")}
                                                        aria-label={t("agents.removeMachineAria", { machine: row.machineName })}
                                                        className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded text-[#930006] transition hover:bg-[#fff4f2]"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                        {open && (
                                            <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                                                <td colSpan={columnCount} className="px-3 py-2">
                                                    {events === null ? (
                                                        <p className="text-sm text-[#5e3f3a]">{t("common.loading")}</p>
                                                    ) : events.length === 0 ? (
                                                        <p className="text-sm text-[#5e3f3a]">{t("agents.noEvents")}</p>
                                                    ) : (
                                                        <table className="min-w-full text-left text-sm">
                                                            <tbody>
                                                                {events.map((ev, index) => (
                                                                    <tr key={index} className="border-b border-[#e0e3e5] last:border-0">
                                                                        <td className="whitespace-nowrap py-1.5 pr-3 text-xs text-[#5e3f3a]">{formatDateTime(ev.occurredAt)}</td>
                                                                        <td className="py-1.5 pr-3">
                                                                            <Badge variant={AGENT_EVENT_META[ev.eventType]?.variant ?? "neutral"}>
                                                                                {AGENT_EVENT_META[ev.eventType] ? t(`agentEvent.${AGENT_EVENT_META[ev.eventType].key}`) : ev.eventType}
                                                                            </Badge>
                                                                        </td>
                                                                        <td className="break-all py-1.5 pr-3 text-[#191c1e]">{ev.detail}</td>
                                                                        <td className="hidden whitespace-nowrap py-1.5 text-xs text-[#5e3f3a] sm:table-cell">{ev.actor}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                );
                            })}
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

            <ConfirmDialog
                isOpen={deleting !== null}
                title={t("agents.deleteTitle")}
                message={t("agents.deleteMessage", { machine: deleting?.machineName ?? "" })}
                onApprove={handleDelete}
                onDenied={() => setDeleting(null)}
                approveLabel={t("common.delete")}
                deniedLabel={t("common.cancel")}
                loading={busy}
            />

            <FormDialog
                isOpen={purgeOpen}
                title={t("agents.purgeTitle")}
                onClose={() => setPurgeOpen(false)}
                onSubmit={handlePurge}
                loading={busy}
                submitLabel={t("common.delete")}
                cancelLabel={t("common.cancel")}
            >
                <label className="flex cursor-pointer items-center gap-2 text-sm text-[#191c1e]">
                    <input
                        type="checkbox"
                        checked={purgeUninstalled}
                        onChange={(event) => setPurgeUninstalled(event.target.checked)}
                        className="h-4 w-4 accent-[#e3000f]"
                    />
                    {t("agents.purgeUninstalled")}
                </label>
                <label className="flex cursor-pointer flex-wrap items-center gap-2 text-sm text-[#191c1e]">
                    <input
                        type="checkbox"
                        checked={purgeOffline}
                        onChange={(event) => setPurgeOffline(event.target.checked)}
                        className="h-4 w-4 accent-[#e3000f]"
                    />
                    {t("agents.purgeOffline")}
                    <input
                        type="number"
                        min={1}
                        max={3650}
                        value={offlineDays}
                        onChange={(event) => setOfflineDays(Number(event.target.value))}
                        aria-label={t("agents.offlineDaysAria")}
                        className="h-9 w-20 rounded-md border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                    />
                    {t("agents.purgeOfflineDays")}
                </label>
                <p className="text-xs text-[#5e3f3a]">{t("agents.purgeNote")}</p>
            </FormDialog>
        </div>
    );
}
