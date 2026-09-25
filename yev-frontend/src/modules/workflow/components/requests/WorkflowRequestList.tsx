"use client";

import { useState } from "react";
import { RefreshCw, Plus, Inbox } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { useRouter } from "@/navigation";
import { WorkflowRequestApi } from "@/modules/workflow/api/workflow-request.api";
import type { WorkflowRequestListItemDto } from "@/modules/workflow/types/workflow-request.dto";
import { RequestStatus } from "@/modules/workflow/types/workflow-request.dto";
import { EmptyState } from "@/components/common/EmptyState";
import { TableSkeletonRows } from "@/components/common/TableSkeletonRows";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { hasPermission } from "@/modules/auth/lib/permissions";
import { useAuth } from "@/modules/auth/context/AuthContext";

const PAGE_SIZE = 10;

type TabKey = "mine" | "pending" | "all";

const STATUS_META: Record<number, { labelKey: string; variant: BadgeVariant }> = {
    [RequestStatus.Draft]: { labelKey: "statusDraft", variant: "neutral" },
    [RequestStatus.Submitted]: { labelKey: "statusSubmitted", variant: "info" },
    [RequestStatus.InProgress]: { labelKey: "statusInProgress", variant: "info" },
    [RequestStatus.Approved]: { labelKey: "statusApproved", variant: "success" },
    [RequestStatus.Rejected]: { labelKey: "statusRejected", variant: "danger" },
    [RequestStatus.SentBack]: { labelKey: "statusSentBack", variant: "warning" },
    [RequestStatus.Cancelled]: { labelKey: "statusCancelled", variant: "neutral" },
};

export default function WorkflowRequestList() {
    const t = useTranslations("Workflow.WorkflowRequest");
    const tCommon = useTranslations("Common");
    const { user } = useAuth();
    const canViewAll = hasPermission(user, "Workflow.Request.ViewAll");
    const router = useRouter();

    const [tab, setTab] = useState<TabKey>("mine");
    const [statusFilter, setStatusFilter] = useState<number | "">("");
    const [items, setItems] = useState<WorkflowRequestListItemDto[]>([]);
    const [pageIndex, setPageIndex] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [hasPreviousPage, setHasPreviousPage] = useState(false);

    const { isLoading, error, refetch } = useFetchEffect(
        () => {
            const params = { pageIndex, pageSize: PAGE_SIZE, status: statusFilter === "" ? undefined : statusFilter };
            if (tab === "pending") return WorkflowRequestApi.getPendingMyApproval({ pageIndex, pageSize: PAGE_SIZE });
            if (tab === "all") return WorkflowRequestApi.getVisibleToMe(params);
            return WorkflowRequestApi.getMyRequests(params);
        },
        [tab, pageIndex, statusFilter],
        (result) => {
            setItems(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
            setHasNextPage(result.hasNextPage);
            setHasPreviousPage(result.hasPreviousPage);
        },
        t("loadError"),
        (message) => toast.error(message)
    );

    // Reset trang khi đổi tab/filter — so sánh snapshot trong thân render, không dùng effect
    // (CLAUDE.md §4.5, mirror pattern các list khác đã dùng).
    const filterKey = `${tab}:${statusFilter}`;
    const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
    if (prevFilterKey !== filterKey) {
        setPrevFilterKey(filterKey);
        setPageIndex(1);
    }

    const goToDetail = (id: number) => router.push({ pathname: "/workflow/requests/detail", query: { id: String(id) } });

    const tabs: { key: TabKey; label: string }[] = [
        { key: "mine", label: t("tabMine") },
        { key: "pending", label: t("tabPending") },
        ...(canViewAll ? [{ key: "all" as TabKey, label: t("tabAll") }] : []),
    ];

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-[#191c1e]">{t("listTitle")}</h1>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => refetch()}
                        disabled={isLoading}
                        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50"
                    >
                        <RefreshCw className="h-3.5 w-3.5" /> {tCommon("refresh")}
                    </button>
                    <button
                        onClick={() => router.push({ pathname: "/workflow/requests/new" })}
                        className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#e3000f] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#b40009]"
                    >
                        <Plus className="h-3.5 w-3.5" /> {t("createNew")}
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-1 border-b border-[#e0e3e5]">
                {tabs.map((tabItem) => (
                    <button
                        key={tabItem.key}
                        onClick={() => setTab(tabItem.key)}
                        className={`cursor-pointer border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                            tab === tabItem.key ? "border-[#e3000f] text-[#e3000f]" : "border-transparent text-[#5e3f3a] hover:text-[#191c1e]"
                        }`}
                    >
                        {tabItem.label}
                    </button>
                ))}
            </div>

            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-[#e0e3e5] bg-[#f8fafc] p-4 md:flex-row md:items-center md:justify-between">
                    {tab !== "pending" ? (
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value === "" ? "" : Number(e.target.value))}
                            className="h-10 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none focus:border-[#e3000f]"
                        >
                            <option value="">{t("statusAll")}</option>
                            {Object.entries(STATUS_META).map(([value, meta]) => (
                                <option key={value} value={value}>
                                    {t(meta.labelKey)}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <div />
                    )}
                    <div className="text-sm text-[#5e3f3a]">
                        {isLoading ? tCommon("loading") : tCommon("showingRecords", { shown: items.length, total: totalCount })}
                    </div>
                </div>

                {error && <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>}

                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">
                                <th className="px-6 py-3">{t("colRequestCode")}</th>
                                <th className="px-6 py-3">{t("colFormDefinition")}</th>
                                <th className="px-6 py-3">{t("colCreatedBy")}</th>
                                <th className="px-6 py-3">{t("colStatus")}</th>
                                <th className="px-6 py-3">{t("colSubmittedAt")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading && <TableSkeletonRows rows={5} columns={5} />}
                            {!isLoading && items.length === 0 && (
                                <tr>
                                    <td colSpan={5}>
                                        <EmptyState icon={Inbox} title={t("noData")} />
                                    </td>
                                </tr>
                            )}
                            {!isLoading && items.map((item) => {
                                const meta = STATUS_META[item.status];
                                return (
                                    <tr
                                        key={item.id}
                                        onClick={() => goToDetail(item.id)}
                                        className="cursor-pointer border-b border-[#f1f5f9] bg-white transition-colors even:bg-[#f2f4f7] hover:bg-[#e8ecf1]"
                                    >
                                        <td className="px-6 py-4 text-sm font-semibold text-[#191c1e]">{item.requestCode ?? t("draftLabel")}</td>
                                        <td className="px-6 py-4 text-sm text-[#191c1e]">{item.formDefinitionNameVn}</td>
                                        <td className="px-6 py-4 text-sm text-[#5e3f3a]">{item.createdByEmployeeName}</td>
                                        <td className="px-6 py-4 text-sm">
                                            <Badge variant={meta?.variant ?? "neutral"} withDot>
                                                {meta ? t(meta.labelKey) : item.status}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-[#5e3f3a]">
                                            {item.submittedAt ? new Date(item.submittedAt).toLocaleString("vi-VN") : "—"}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="flex items-center justify-between border-t border-[#e0e3e5] p-4">
                    <button
                        className="cursor-pointer text-sm text-[#5e3f3a] disabled:opacity-50"
                        disabled={!hasPreviousPage || isLoading}
                        onClick={() => setPageIndex((current) => Math.max(1, current - 1))}
                    >
                        {tCommon("prevPage")}
                    </button>
                    <div className="flex h-8 items-center px-3 text-sm font-semibold text-[#191c1e]">
                        {tCommon("pageOf", { current: pageIndex, total: totalPages })}
                    </div>
                    <button
                        className="cursor-pointer text-sm text-[#5e3f3a] disabled:opacity-50"
                        disabled={!hasNextPage || isLoading}
                        onClick={() => setPageIndex((current) => current + 1)}
                    >
                        {tCommon("nextPage")}
                    </button>
                </div>
            </section>
        </div>
    );
}
