"use client";

import { useState } from "react";
import { Check, RefreshCw, X } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { useRouter } from "@/navigation";

import { OtFormApi } from "@/modules/attendance/api/ot-form.api";
import type { OtFormApprovalSummaryItemDto, OtFormListItemDto } from "@/modules/attendance/types/ot-form.dto";
import {
    approvalLevelLabels,
    nextApprovalLevelFromStatus,
    otFormStatusClasses,
    otFormStatusLabels,
} from "@/modules/attendance/types/enums";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { bilingualText } from "@/modules/attendance/lib/bilingual";

const PAGE_SIZE = 10;

type OtFormListMode = "my-forms" | "pending-submissions" | "pending-approvals" | "my-actions" | "my-participations";

interface OtFormListPageProps {
    mode: OtFormListMode;
    // true khi nhúng trong tab container (OtFormTabsPage) — ẩn hẳn tiêu đề/mô tả riêng của từng mode,
    // chỉ còn bảng + phân trang, vì tab container đã có 1 tiêu đề chung ở ngoài.
    hideHeading?: boolean;
}

function formatDate(value: string) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("vi-VN");
}

// "Tiến độ duyệt" (approvalSummary, mới 2026-07-17) — mỗi phần tử 1 dòng đã Ký/Duyệt/Từ chối, nối thêm
// dòng "Đang chờ..." suy từ status nếu đơn chưa Completed/Rejected — có ở cả 5 tab danh sách (§4.2).
function ApprovalSummaryCell({ summary, status }: { summary: OtFormApprovalSummaryItemDto[]; status: number }) {
    const t = useTranslations("Attendance.OtFormList");
    const nextLevel = nextApprovalLevelFromStatus(status);
    if (summary.length === 0 && nextLevel === null) {
        return <span className="text-xs text-[#9aa0a6]">-</span>;
    }
    return (
        <div className="space-y-0.5">
            {summary.map((item, index) => {
                const isRejected = item.action === 2;
                return (
                    <div
                        key={index}
                        className={`flex items-center gap-1 text-xs ${isRejected ? "text-[#930006]" : "text-emerald-700"}`}
                    >
                        {isRejected ? <X size={12} /> : <Check size={12} />} {item.approverFullName ?? item.approverUserName} (
                        {approvalLevelLabels[item.approvalLevel] ?? "?"})
                    </div>
                );
            })}
            {nextLevel !== null && (
                <div className="text-xs text-[#9a5b00]">{t("waitingFor", { level: approvalLevelLabels[nextLevel] ?? "?" })}</div>
            )}
        </div>
    );
}

// docs/attendance-api-fe.md §4.2 — my-forms (đơn do chính mình tạo) và pending-approvals (đơn chờ chính
// mình duyệt, BE tự lọc theo cấp/scope) dùng chung shape OtFormListItemDto + phân trang.
export default function OtFormListPage({ mode, hideHeading = false }: OtFormListPageProps) {
    const t = useTranslations("Attendance.OtFormList");
    const tCommon = useTranslations("Common");
    const router = useRouter();
    const { user } = useAuth();
    const canCreate = hasPermission(user, "Attendance.OTForm.Create");
    const [forms, setForms] = useState<OtFormListItemDto[]>([]);

    const [pageIndex, setPageIndex] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [hasPreviousPage, setHasPreviousPage] = useState(false);

    // Đổi mode (chuyển menu) → về trang 1, phát hiện bằng so sánh snapshot ngay trong render
    // (React khuyến khích thay effect chỉ để "phản ứng" theo prop/state khác đổi).
    const [prevMode, setPrevMode] = useState(mode);
    if (prevMode !== mode) {
        setPrevMode(mode);
        setPageIndex(1);
    }

    const { isLoading, error, refetch: fetchForms } = useFetchEffect(
        () =>
            mode === "my-forms"
                ? OtFormApi.getMyForms({ pageIndex, pageSize: PAGE_SIZE })
                : mode === "pending-submissions"
                ? OtFormApi.getPendingSubmissions({ pageIndex, pageSize: PAGE_SIZE })
                : mode === "pending-approvals"
                ? OtFormApi.getPendingApprovals({ pageIndex, pageSize: PAGE_SIZE })
                : mode === "my-actions"
                ? OtFormApi.getMyActions({ pageIndex, pageSize: PAGE_SIZE })
                : OtFormApi.getMyParticipations({ pageIndex, pageSize: PAGE_SIZE }),
        [mode, pageIndex],
        (result) => {
            setForms(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
            setHasNextPage(result.hasNextPage);
            setHasPreviousPage(result.hasPreviousPage);
        },
        t("loadError"),
        (message) => toast.error(message)
    );

    const title =
        mode === "my-forms"
            ? t("titleMyForms")
            : mode === "pending-submissions"
            ? t("titlePendingSubmissions")
            : mode === "pending-approvals"
            ? t("titlePendingApprovals")
            : mode === "my-actions"
            ? t("titleMyActions")
            : t("titleMyParticipations");
    const description =
        mode === "my-forms"
            ? t("descMyForms")
            : mode === "pending-submissions"
            ? t("descPendingSubmissions")
            : mode === "pending-approvals"
            ? t("descPendingApprovals")
            : mode === "my-actions"
            ? t("descMyActions")
            : t("descMyParticipations");
    const columnCount = mode === "my-forms" ? 9 : 8;

    return (
        <div className="space-y-8">
            {!hideHeading && (
                <div>
                    <h1 className="text-2xl font-semibold text-[#191c1e]">{title}</h1>
                    <p className="mt-1 text-[15px] text-[#5e3f3a]">{description}</p>
                </div>
            )}

            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-[#e0e3e5] bg-[#f8fafc] p-4">
                    <div className="text-sm text-[#5e3f3a]">
                        {isLoading ? tCommon("loading") : tCommon("showingRecords", { shown: forms.length, total: totalCount })}
                    </div>
                    <button
                        onClick={() => fetchForms()}
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
                                <th className="px-6 py-3">{t("colDepartmentGroup")}</th>
                                <th className="px-6 py-3">{t("colOtCase")}</th>
                                <th className="px-6 py-3">{t("colDate")}</th>
                                <th className="px-6 py-3">{t("colTotalHour")}</th>
                                <th className="px-6 py-3">{t("colNumberOfEmployee")}</th>
                                <th className="px-6 py-3">{t("colCreatedBy")}</th>
                                <th className="px-6 py-3">{t("colStatus")}</th>
                                <th className="px-6 py-3">{t("colApprovalProgress")}</th>
                                {mode === "my-forms" && <th className="px-6 py-3 text-right">{tCommon("actions")}</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && forms.length === 0 && (
                                <tr>
                                    <td colSpan={columnCount} className="px-6 py-8 text-center text-sm text-[#5e3f3a]">
                                        {t("noData")}
                                    </td>
                                </tr>
                            )}
                            {forms.map((form) => (
                                <tr
                                    key={form.id}
                                    onClick={() => router.push({ pathname: "/ot/forms", query: { id: String(form.id) } })}
                                    className="cursor-pointer border-b border-[#f1f5f9] transition-colors hover:bg-[#f8fafc]"
                                >
                                    <td className="px-6 py-4 align-top">
                                        <div className="text-sm font-semibold text-[#191c1e]">
                                            {bilingualText(form.departmentNameVn, form.departmentNameJp)}
                                        </div>
                                        <div className="text-xs text-[#5e3f3a]">{bilingualText(form.groupNameVn, form.groupNameJp)}</div>
                                    </td>
                                    <td className="px-6 py-4 align-top text-sm text-[#191c1e]">{form.otCaseCode}</td>
                                    <td className="px-6 py-4 align-top text-sm text-[#191c1e]">{formatDate(form.date)}</td>
                                    <td className="px-6 py-4 align-top text-sm text-[#191c1e]">{form.totalHour}</td>
                                    <td className="px-6 py-4 align-top text-sm text-[#191c1e]">{form.numberOfEmployee}</td>
                                    <td className="px-6 py-4 align-top text-sm text-[#5e3f3a]">
                                        {form.createdByFullName ?? form.createdByUserName}
                                    </td>
                                    <td className="px-6 py-4 align-top">
                                        <span
                                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${otFormStatusClasses[form.status] ?? otFormStatusClasses[0]}`}
                                        >
                                            {otFormStatusLabels[form.status] ?? t("unknownStatus")}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 align-top">
                                        <ApprovalSummaryCell summary={form.approvalSummary} status={form.status} />
                                    </td>
                                    {mode === "my-forms" && (
                                        <td className="px-6 py-4 align-top text-right">
                                            {form.isEditable && canCreate && (
                                                <button
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        router.push({ pathname: "/ot/forms/edit", query: { id: String(form.id) } });
                                                    }}
                                                    className="cursor-pointer font-semibold text-[#5e3f3a] transition hover:text-[#191c1e]"
                                                >
                                                    {tCommon("edit")}
                                                </button>
                                            )}
                                        </td>
                                    )}
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
