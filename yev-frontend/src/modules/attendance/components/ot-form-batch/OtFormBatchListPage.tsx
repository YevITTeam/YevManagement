"use client";

import { useState } from "react";
import { Inbox, RefreshCw } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { useRouter } from "@/navigation";

import { OtFormBatchApi } from "@/modules/attendance/api/ot-form-batch.api";
import type { OtFormBatchListItemDto } from "@/modules/attendance/types/ot-form-batch.dto";
import { bilingualText } from "@/modules/attendance/lib/bilingual";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

const PAGE_SIZE = 10;

const BATCH_STATUS_CLASSES: Record<number, string> = {
    0: "border border-[#f5d0a9] bg-[#fff4e5] text-[#9a5b00]",
    1: "border border-emerald-200 bg-emerald-50 text-emerald-600",
};

function formatDate(value: string) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("vi-VN");
}

function formatDateTime(value: string) {
    if (!value) return "-";
    return new Date(value).toLocaleString("vi-VN");
}

// Màn "Đơn tổng" trong app (dự phòng khi Trưởng phòng mất/quên link email) — docs/attendance-api-fe.md
// §Đơn tổng. Danh sách gồm cả batch đang chờ (Pending) lẫn đã xử lý (Processed), BE tự lọc theo
// UserApprovalScope(DepartmentManager) của người gọi (Admin thấy tất cả).
export default function OtFormBatchListPage() {
    const t = useTranslations("Attendance.OtFormBatchList");
    const tCommon = useTranslations("Common");
    const router = useRouter();
    const [batches, setBatches] = useState<OtFormBatchListItemDto[]>([]);

    const [pageIndex, setPageIndex] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [hasPreviousPage, setHasPreviousPage] = useState(false);

    const { isLoading, error, refetch: fetchBatches } = useFetchEffect(
        () => OtFormBatchApi.getGridList({ pageIndex, pageSize: PAGE_SIZE }),
        [pageIndex],
        (result) => {
            setBatches(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
            setHasNextPage(result.hasNextPage);
            setHasPreviousPage(result.hasPreviousPage);
        },
        t("loadError"),
        (message) => toast.error(message)
    );

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-semibold text-[#191c1e]">{t("title")}</h1>
                <p className="mt-1 text-[15px] text-[#5e3f3a]">{t("description")}</p>
            </div>

            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-[#e0e3e5] bg-[#f8fafc] p-4">
                    <div className="text-sm text-[#5e3f3a]">
                        {isLoading ? tCommon("loading") : tCommon("showingRecords", { shown: batches.length, total: totalCount })}
                    </div>
                    <button
                        onClick={() => fetchBatches()}
                        disabled={isLoading}
                        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50"
                    >
                        <RefreshCw className="h-3.5 w-3.5" /> {tCommon("refresh")}
                    </button>
                </div>

                {error && (
                    <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>
                )}

                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">
                                <th className="px-4 py-2.5">{t("colDepartment")}</th>
                                <th className="px-4 py-2.5">{t("colBatchDate")}</th>
                                <th className="px-4 py-2.5">{t("colFormCount")}</th>
                                <th className="px-4 py-2.5">{t("colEmployeeCount")}</th>
                                <th className="px-4 py-2.5">{t("colTotalHour")}</th>
                                <th className="px-4 py-2.5">{t("colStatus")}</th>
                                <th className="px-4 py-2.5">{t("colProcessedBy")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && batches.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12">
                                        <div className="flex flex-col items-center gap-2 text-center text-sm text-[#5e3f3a]">
                                            <Inbox className="h-8 w-8 text-[#c7ccd1]" />
                                            {t("noData")}
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {batches.map((batch) => (
                                <tr
                                    key={batch.id}
                                    onClick={() => router.push({ pathname: "/ot/batches/detail", query: { id: String(batch.id) } })}
                                    className="cursor-pointer border-b border-[#f1f5f9] transition-colors hover:bg-[#f8fafc]"
                                >
                                    <td className="px-4 py-3 align-top text-sm font-semibold text-[#191c1e]">
                                        {bilingualText(batch.departmentNameVn, batch.departmentNameJp)}
                                    </td>
                                    <td className="px-4 py-3 align-top text-sm text-[#191c1e]">{formatDate(batch.batchDate)}</td>
                                    <td className="px-4 py-3 align-top text-sm text-[#191c1e]">{batch.formCount}</td>
                                    <td className="px-4 py-3 align-top text-sm text-[#191c1e]">{batch.employeeCount}</td>
                                    <td className="px-4 py-3 align-top text-sm text-[#191c1e]">
                                        <span className="inline-flex items-center rounded-full border border-[#e0e3e5] bg-[#f8fafc] px-2.5 py-0.5 text-xs font-semibold text-[#191c1e]">
                                            {batch.totalHour}h
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <span
                                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${BATCH_STATUS_CLASSES[batch.status] ?? BATCH_STATUS_CLASSES[0]}`}
                                        >
                                            {batch.status === 1 ? t("statusProcessed") : t("statusPending")}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 align-top text-sm text-[#5e3f3a]">
                                        {batch.processedAt ? (
                                            <>
                                                {batch.processedByFullName ?? t("statusAutoClosed")}
                                                <br />
                                                <span className="text-xs text-[#9aa0a6]">{formatDateTime(batch.processedAt)}</span>
                                            </>
                                        ) : (
                                            "-"
                                        )}
                                    </td>
                                </tr>
                            ))}
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
