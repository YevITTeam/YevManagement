"use client";

import { useState, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { toast } from "react-toastify";
import { useLocale, useTranslations } from "next-intl";

import { AttendanceAuditTrailApi } from "@/modules/attendance/api/attendance-audit-trail.api";
import type { AttendanceMailLogDto } from "@/modules/attendance/types/attendance-audit-trail.dto";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { usePersistedState } from "@/modules/common/hooks/usePersistedState";
import { StyledSelect } from "@/components/ui/StyledSelect";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { TableScroll } from "@/components/ui/TableScroll";
import {
    DateRange,
    ErrorBar,
    FilterActions,
    IconFlag,
    ListToolbar,
    SearchField,
    TableStatusRows,
    fieldClassName,
    rowClassName,
    theadRowClassName,
} from "@/components/ui/ListToolbar";

const PAGE_SIZE = 20;

const STATUS_META: Record<number, { key: "statusPending" | "statusSent" | "statusFailed" | "statusSkipped"; variant: BadgeVariant }> = {
    0: { key: "statusPending", variant: "info" },
    1: { key: "statusSent", variant: "success" },
    2: { key: "statusFailed", variant: "danger" },
    3: { key: "statusSkipped", variant: "neutral" },
};

const emptyFilters = { keyword: "", status: "", fromDate: "", toDate: "" };

export default function AttendanceMailLogList({ header }: { header?: ReactNode }) {
    const t = useTranslations("Attendance.MailLog");
    const locale = useLocale();
    const [rows, setRows] = useState<AttendanceMailLogDto[]>([]);
    const [filters, setFilters] = useState(emptyFilters);
    const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
    const [pageIndex, setPageIndex] = useState(1);
    const [pageSize, setPageSize] = usePersistedState("page-size:attendance/audit-trail/mail-log", PAGE_SIZE);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    const { isLoading, error, refetch } = useFetchEffect(
        () =>
            AttendanceAuditTrailApi.getMailLogPageNation({
                pageIndex,
                pageSize,
                keyword: appliedFilters.keyword || undefined,
                status: appliedFilters.status === "" ? undefined : Number(appliedFilters.status),
                fromDate: appliedFilters.fromDate || undefined,
                toDate: appliedFilters.toDate || undefined,
            }),
        [pageIndex, pageSize, appliedFilters],
        (result) => {
            setRows(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
        },
        t("loadError"),
        (message) => toast.error(message),
        "attendance-mail-log"
    );

    const formatDateTime = (value: string | null) => (value ? new Date(value).toLocaleString(locale) : "-");

    const handleSearch = () => {
        setPageIndex(1);
        setAppliedFilters({ ...filters, keyword: filters.keyword.trim() });
    };

    const handleReset = () => {
        setFilters(emptyFilters);
        setPageIndex(1);
        setAppliedFilters(emptyFilters);
    };

    const summary = t("summary", { shown: rows.length, total: totalCount });

    return (
        <div className="space-y-4">
            {header}

            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                <ListToolbar actions={<FilterActions onSearch={handleSearch} onReset={handleReset} onRefresh={() => refetch()} disabled={isLoading} />}>
                    <SearchField value={filters.keyword} onChange={(keyword) => setFilters((f) => ({ ...f, keyword }))} onEnter={handleSearch} placeholder={t("keywordPlaceholder")} wide />
                    <StyledSelect
                        value={filters.status}
                        onChange={(status) => setFilters((f) => ({ ...f, status }))}
                        ariaLabel={t("colStatus")}
                        triggerClassName={`${fieldClassName} w-40 pr-8`}
                        options={[{ value: "", label: t("allStatus") }, ...Object.entries(STATUS_META).map(([value, meta]) => ({ value, label: t(meta.key) }))]}
                    />
                    <DateRange from={filters.fromDate} to={filters.toDate} onChange={(range) => setFilters((f) => ({ ...f, ...range }))} title={t("dateRange")} />
                </ListToolbar>

                <ErrorBar message={error} />

                <TableScroll>
                    <table className="min-w-full border-collapse text-left text-sm">
                        <thead>
                            <tr className={theadRowClassName}>
                                <th className="px-3 py-2">{t("colTime")}</th>
                                <th className="px-3 py-2">{t("colRecipient")}</th>
                                <th className="px-3 py-2">{t("colSubject")}</th>
                                <th className="px-3 py-2">{t("colStatus")}</th>
                                <th className="hidden px-3 py-2 lg:table-cell">{t("colRequestedBy")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <TableStatusRows loading={isLoading} empty={rows.length === 0} columns={5} emptyText={t("empty")} />
                            {rows.map((row) => {
                                const meta = STATUS_META[row.status];
                                const retrying = row.status === 0 && row.lastError;
                                const createdAt = formatDateTime(row.createdAt);
                                const sentAt = row.sentAt ? formatDateTime(row.sentAt) : null;
                                return (
                                    <tr key={row.id} className={rowClassName}>
                                        <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">
                                            {createdAt}
                                            {sentAt && sentAt !== createdAt && <div className="text-xs text-[#8a8f94]">{t("sentAtLine", { time: sentAt })}</div>}
                                        </td>
                                        <td className="px-3 py-2 font-semibold text-[#191c1e]" title={row.toEmail ?? undefined}>
                                            {row.recipientUserName ?? row.toEmail ?? "-"}
                                        </td>
                                        <td className="px-3 py-2 text-[#191c1e]">{row.subject}</td>
                                        <td className="px-3 py-2">
                                            <span className="inline-flex items-center gap-1.5">
                                                {meta && <Badge variant={meta.variant}>{retrying ? t("statusRetrying", { attempts: row.attempts }) : t(meta.key)}</Badge>}
                                                {row.lastError && <IconFlag icon={AlertCircle} label={row.lastError} tone="danger" />}
                                            </span>
                                        </td>
                                        <td className="hidden px-3 py-2 text-[#5e3f3a] lg:table-cell">{row.requestedBy}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </TableScroll>

                <Pagination
                    pageIndex={pageIndex}
                    totalPages={totalPages}
                    onPageChange={setPageIndex}
                    disabled={isLoading}
                    summary={summary}
                    compactSummary={summary}
                    pageSize={pageSize}
                    onPageSizeChange={setPageSize}
                />
            </section>
        </div>
    );
}
