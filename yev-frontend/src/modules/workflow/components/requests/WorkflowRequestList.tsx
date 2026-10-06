"use client";

import { useState } from "react";
import { RefreshCw, Plus, Inbox } from "lucide-react";
import { toast } from "react-toastify";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/navigation";
import { WorkflowRequestApi } from "@/modules/workflow/api/workflow-request.api";
import type { WorkflowRequestListItemDto } from "@/modules/workflow/types/workflow-request.dto";
import { RequestStatus } from "@/modules/workflow/types/workflow-request.dto";
import { EmptyState } from "@/components/common/EmptyState";
import { TableSkeletonRows } from "@/components/common/TableSkeletonRows";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { Skeleton } from "@/components/ui/Skeleton";
import { StyledSelect } from "@/components/ui/StyledSelect";
import { Tabs } from "@/components/ui/Tabs";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { hasPermission } from "@/modules/auth/lib/permissions";
import { useAuth } from "@/modules/auth/context/AuthContext";

const PAGE_SIZE = 10;

type TabKey = "mine" | "pending" | "all";

const STATUS_META: Record<number, { labelKey: string; variant: BadgeVariant; dotClassName: string }> = {
    [RequestStatus.Draft]: { labelKey: "statusDraft", variant: "neutral", dotClassName: "bg-[#8a8f94]" },
    [RequestStatus.Submitted]: { labelKey: "statusSubmitted", variant: "info", dotClassName: "bg-[#1a56db]" },
    [RequestStatus.InProgress]: { labelKey: "statusInProgress", variant: "info", dotClassName: "bg-[#1a56db]" },
    [RequestStatus.Approved]: { labelKey: "statusApproved", variant: "success", dotClassName: "bg-[#16a34a]" },
    [RequestStatus.Rejected]: { labelKey: "statusRejected", variant: "danger", dotClassName: "bg-[#dc2626]" },
    [RequestStatus.SentBack]: { labelKey: "statusSentBack", variant: "warning", dotClassName: "bg-[#f59e0b]" },
    [RequestStatus.Cancelled]: { labelKey: "statusCancelled", variant: "neutral", dotClassName: "bg-[#8a8f94]" },
};

const filterTriggerClassName =
    "h-9 w-44 rounded-lg border border-[#e0e3e5] bg-white px-3 pr-9 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]";

const headerCellClassName = "whitespace-nowrap px-4 py-2.5";

export default function WorkflowRequestList() {
    const t = useTranslations("Workflow.WorkflowRequest");
    const tCommon = useTranslations("Common");
    const locale = useLocale();
    const { user } = useAuth();
    const canViewAll = hasPermission(user, "Workflow.Request.ViewAll");
    const router = useRouter();

    const [tab, setTab] = useState<TabKey>("mine");
    const [statusFilter, setStatusFilter] = useState<number | "">("");
    const [items, setItems] = useState<WorkflowRequestListItemDto[]>([]);
    const [pageIndex, setPageIndex] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

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
        },
        t("loadError"),
        (message) => toast.error(message)
    );

    // Reset page when the tab or filter changes by comparing a snapshot during render (AGENTS.md §4.5).
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

    const statusOptions = [
        { value: "" as number | "", label: t("statusAll") },
        ...Object.entries(STATUS_META).map(([value, meta]) => ({
            value: Number(value) as number | "",
            label: t(meta.labelKey),
            dotClassName: meta.dotClassName,
        })),
    ];

    // The "mine" list is always the viewer's own requests, so the applicant column would repeat one name.
    const showApplicant = tab !== "mine";
    const columnCount = showApplicant ? 5 : 4;

    const formatDate = (iso: string | null) =>
        iso
            ? new Date(iso).toLocaleString(locale === "ja" ? "ja-JP" : "vi-VN", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
              })
            : "—";

    const renderStatus = (status: number) => {
        const meta = STATUS_META[status];
        return (
            <Badge variant={meta?.variant ?? "neutral"} withDot>
                {meta ? t(meta.labelKey) : status}
            </Badge>
        );
    };

    const renderCode = (item: WorkflowRequestListItemDto) =>
        item.requestCode ?? <span className="font-medium text-[#6b7075]">{t("draftLabel")}</span>;

    const rangeFrom = (pageIndex - 1) * PAGE_SIZE + 1;
    const rangeTo = rangeFrom + items.length - 1;
    const isEmpty = !isLoading && items.length === 0;

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h1 className="text-2xl font-semibold text-[#191c1e]">{t("listTitle")}</h1>
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

            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e0e3e5] px-4 py-2.5">
                    <Tabs tabs={tabs} activeKey={tab} onChange={setTab} />
                    {tab !== "pending" && (
                        <StyledSelect
                            options={statusOptions}
                            value={statusFilter}
                            onChange={setStatusFilter}
                            triggerClassName={filterTriggerClassName}
                            ariaLabel={t("colStatus")}
                        />
                    )}
                </div>

                {error && <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>}

                {isEmpty ? (
                    <EmptyState icon={Inbox} title={tab === "pending" ? t("noPending") : t("noData")} />
                ) : (
                    <>
                        <div className="hidden overflow-x-auto md:block">
                            <table className="min-w-full border-collapse text-left text-sm">
                                <thead>
                                    <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                        <th className={headerCellClassName}>{t("colRequestCode")}</th>
                                        <th className={headerCellClassName}>{t("colFormDefinition")}</th>
                                        {showApplicant && <th className={headerCellClassName}>{t("colCreatedBy")}</th>}
                                        <th className={headerCellClassName}>{t("colStatus")}</th>
                                        <th className={headerCellClassName}>{t("colSubmittedAt")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoading && <TableSkeletonRows rows={5} columns={columnCount} />}
                                    {!isLoading &&
                                        items.map((item) => (
                                            <tr
                                                key={item.id}
                                                tabIndex={0}
                                                onClick={() => goToDetail(item.id)}
                                                onKeyDown={(event) => event.key === "Enter" && goToDetail(item.id)}
                                                className="cursor-pointer border-b border-[#f1f5f9] transition-colors hover:bg-[#f8fafc] focus-visible:bg-[#f8fafc] focus-visible:outline-none"
                                            >
                                                <td className="whitespace-nowrap px-4 py-2.5 font-semibold tabular-nums text-[#191c1e]">{renderCode(item)}</td>
                                                <td className="px-4 py-2.5 text-[#191c1e]">
                                                    <span className="block max-w-[26rem] truncate" title={item.formDefinitionNameVn}>
                                                        {item.formDefinitionNameVn}
                                                    </span>
                                                </td>
                                                {showApplicant && (
                                                    <td className="whitespace-nowrap px-4 py-2.5 text-[#5e3f3a]">{item.createdByEmployeeName}</td>
                                                )}
                                                <td className="whitespace-nowrap px-4 py-2.5">{renderStatus(item.status)}</td>
                                                <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-[#5e3f3a]">{formatDate(item.submittedAt)}</td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>

                        <ul className="divide-y divide-[#f1f5f9] md:hidden">
                            {isLoading
                                ? [0, 1, 2, 3].map((index) => (
                                      <li key={index} className="space-y-2 px-4 py-3">
                                          <Skeleton className="h-4 w-1/3" />
                                          <Skeleton className="h-3 w-2/3" />
                                      </li>
                                  ))
                                : items.map((item) => (
                                      <li key={item.id}>
                                          <button
                                              type="button"
                                              onClick={() => goToDetail(item.id)}
                                              className="block w-full cursor-pointer px-4 py-3 text-left transition-colors hover:bg-[#f8fafc]"
                                          >
                                              <span className="flex items-center justify-between gap-3">
                                                  <span className="text-sm font-semibold tabular-nums text-[#191c1e]">{renderCode(item)}</span>
                                                  {renderStatus(item.status)}
                                              </span>
                                              <span className="mt-1 block truncate text-sm text-[#191c1e]">{item.formDefinitionNameVn}</span>
                                              <span className="mt-0.5 block text-xs text-[#5e3f3a]">
                                                  {showApplicant ? `${item.createdByEmployeeName} · ` : ""}
                                                  {formatDate(item.submittedAt)}
                                              </span>
                                          </button>
                                      </li>
                                  ))}
                        </ul>

                        {!isLoading && (
                            <Pagination
                                pageIndex={pageIndex}
                                totalPages={totalPages}
                                onPageChange={setPageIndex}
                                summary={t("rangeLabel", { from: rangeFrom, to: rangeTo, total: totalCount })}
                                compactSummary={totalCount}
                            />
                        )}
                    </>
                )}
            </section>
        </div>
    );
}
