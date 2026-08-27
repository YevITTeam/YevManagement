"use client";

import { useState } from "react";
import { Check, Inbox, RefreshCw, X } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { useRouter } from "@/navigation";

import { OtFormApi } from "@/modules/attendance/api/ot-form.api";
import type { OtFormApprovalSummaryItemDto, OtFormListItemDto } from "@/modules/attendance/types/ot-form.dto";
import { otFormStatusClasses, otFormStatusLabels } from "@/modules/attendance/types/enums";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { bilingualText } from "@/modules/attendance/lib/bilingual";
import { getApiErrorMessage } from "@/lib/apiError";

const PAGE_SIZE = 10;

type OtFormListMode = "my-forms" | "pending-approvals" | "my-actions" | "my-participations";

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

// "Tiến độ duyệt" (approvalSummary) — mỗi phần tử 1 dòng đã Ký/Duyệt/Từ chối theo bước Chức vụ
// (StepOrder + jobTitleNameSnapshot, xem docs §Cây chức vụ), nối thêm dòng "Đang chờ duyệt" chung
// chung nếu đơn chưa Completed/Rejected — tên Chức vụ đang chờ nằm ở OtFormDto.approvalSteps (chỉ
// xem được khi mở chi tiết đơn, danh sách không có field này) — có ở cả 5 tab danh sách (§4.2).
// currentStepCandidateCount > 1 nghĩa là bước đang chờ có NHIỀU người cùng giữ Chức vụ đó — hiện rõ
// "đang chờ 1 trong N người" để người xem hiểu đây không phải riêng họ phải xử lý (2026-08-08, Giai
// đoạn 3.2 — polish UX "Chờ tôi duyệt", trước đây không có chỉ báo gì).
function ApprovalSummaryCell({
    summary,
    status,
    currentStepCandidateCount,
}: {
    summary: OtFormApprovalSummaryItemDto[];
    status: number;
    currentStepCandidateCount: number;
}) {
    const t = useTranslations("Attendance.OtFormList");
    const isWaiting = status === 0; // OtFormStatus.InApproval
    if (summary.length === 0 && !isWaiting) {
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
                        {item.jobTitleNameSnapshot})
                    </div>
                );
            })}
            {isWaiting && (
                <div className="text-xs text-[#9a5b00]">
                    {currentStepCandidateCount > 1 ? t("waitingForNextMulti", { count: currentStepCandidateCount }) : t("waitingForNext")}
                </div>
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
    const canBulkApprove = mode === "pending-approvals" && hasPermission(user, "Attendance.OTForm.Approve");
    const [forms, setForms] = useState<OtFormListItemDto[]>([]);

    // Ký/Từ chối hàng loạt (2026-08-27) — chỉ ở tab "Chờ tôi duyệt". Comment: FE KHÔNG tự lọc theo
    // candidate của bước hiện tại (giống nút Duyệt/Từ chối đơn lẻ) — BE là nguồn chặn thật, trả lỗi
    // riêng từng đơn nếu người bấm không phải candidate hợp lệ.
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [bulkAction, setBulkAction] = useState<"approve" | "reject" | null>(null);
    const [bulkComment, setBulkComment] = useState("");
    const [bulkSecondaryPassword, setBulkSecondaryPassword] = useState("");
    const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);

    const [pageIndex, setPageIndex] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [hasPreviousPage, setHasPreviousPage] = useState(false);

    // Ô nhập bộ lọc (chưa áp dụng) — tách khỏi appliedFilters để gõ/chọn xong mới bấm "Tìm kiếm" mới
    // gọi API, giống khuôn AuditTrailList.tsx.
    const [fromDateInput, setFromDateInput] = useState("");
    const [toDateInput, setToDateInput] = useState("");
    const [statusInput, setStatusInput] = useState("");
    const [appliedFilters, setAppliedFilters] = useState({ fromDate: "", toDate: "", status: "" });

    // Đổi mode (chuyển menu) → về trang 1 + xoá bộ lọc, phát hiện bằng so sánh snapshot ngay trong
    // render (React khuyến khích thay effect chỉ để "phản ứng" theo prop/state khác đổi).
    const [prevMode, setPrevMode] = useState(mode);
    if (prevMode !== mode) {
        setPrevMode(mode);
        setPageIndex(1);
        setFromDateInput("");
        setToDateInput("");
        setStatusInput("");
        setAppliedFilters({ fromDate: "", toDate: "", status: "" });
    }

    const listParams = {
        pageIndex,
        pageSize: PAGE_SIZE,
        fromDate: appliedFilters.fromDate || undefined,
        toDate: appliedFilters.toDate || undefined,
        status: appliedFilters.status !== "" ? Number(appliedFilters.status) : undefined,
    };

    const { isLoading, error, refetch: fetchForms } = useFetchEffect(
        () =>
            mode === "my-forms"
                ? OtFormApi.getMyForms(listParams)
                : mode === "pending-approvals"
                ? OtFormApi.getPendingApprovals(listParams)
                : mode === "my-actions"
                ? OtFormApi.getMyActions(listParams)
                : OtFormApi.getMyParticipations(listParams),
        [mode, pageIndex, appliedFilters],
        (result) => {
            setForms(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
            setHasNextPage(result.hasNextPage);
            setHasPreviousPage(result.hasPreviousPage);
        },
        t("loadError"),
        (message) => toast.error(message),
        "ot-forms"
    );

    const handleSearch = () => {
        setPageIndex(1);
        setAppliedFilters({ fromDate: fromDateInput, toDate: toDateInput, status: statusInput });
    };

    const handleResetFilter = () => {
        setFromDateInput("");
        setToDateInput("");
        setStatusInput("");
        setPageIndex(1);
        setAppliedFilters({ fromDate: "", toDate: "", status: "" });
    };

    // Xoá lựa chọn khi danh sách đổi (đổi trang/lọc/mode, hoặc sau khi xử lý xong) — so sánh snapshot
    // ngay trong render thay vì effect (CLAUDE.md §4.5).
    const formsKey = forms.map((form) => form.id).join(",");
    const [prevFormsKey, setPrevFormsKey] = useState(formsKey);
    if (prevFormsKey !== formsKey) {
        setPrevFormsKey(formsKey);
        setSelectedIds([]);
    }

    const toggleSelectOne = (id: number) => {
        setSelectedIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
    };

    const toggleSelectAll = () => {
        setSelectedIds((current) => (current.length === forms.length ? [] : forms.map((form) => form.id)));
    };

    const openBulkAction = (type: "approve" | "reject") => {
        setBulkComment("");
        setBulkSecondaryPassword("");
        setBulkAction(type);
    };

    const closeBulkAction = () => {
        if (isBulkSubmitting) return;
        setBulkAction(null);
    };

    const handleBulkSubmit = async () => {
        if (bulkAction === "reject" && !bulkComment.trim()) {
            toast.error(t("rejectCommentRequiredError"));
            return;
        }
        if (!bulkSecondaryPassword) {
            toast.error(t("secondaryPasswordRequiredError"));
            return;
        }
        setIsBulkSubmitting(true);
        try {
            const results =
                bulkAction === "approve"
                    ? await OtFormApi.bulkApprove({
                          otFormIds: selectedIds,
                          comment: bulkComment.trim() || null,
                          secondaryPassword: bulkSecondaryPassword,
                      })
                    : await OtFormApi.bulkReject({
                          otFormIds: selectedIds,
                          comment: bulkComment.trim(),
                          secondaryPassword: bulkSecondaryPassword,
                      });
            const successCount = results.filter((item) => item.success).length;
            const failedItems = results.filter((item) => !item.success);
            if (failedItems.length === 0) {
                toast.success(t("bulkActionAllSuccess", { count: successCount }));
            } else {
                toast.error(
                    t("bulkActionPartialError", { success: successCount, failed: failedItems.length }) +
                        " " +
                        failedItems.map((item) => `#${item.otFormId}: ${item.error}`).join("; ")
                );
            }
            setBulkAction(null);
            await fetchForms();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("bulkActionError")));
        } finally {
            setIsBulkSubmitting(false);
        }
    };

    const title =
        mode === "my-forms"
            ? t("titleMyForms")
            : mode === "pending-approvals"
            ? t("titlePendingApprovals")
            : mode === "my-actions"
            ? t("titleMyActions")
            : t("titleMyParticipations");
    const description =
        mode === "my-forms"
            ? t("descMyForms")
            : mode === "pending-approvals"
            ? t("descPendingApprovals")
            : mode === "my-actions"
            ? t("descMyActions")
            : t("descMyParticipations");
    const columnCount = (mode === "my-forms" ? 9 : 8) + (canBulkApprove ? 1 : 0);

    return (
        <div className="space-y-8">
            {!hideHeading && (
                <div>
                    <h1 className="text-2xl font-semibold text-[#191c1e]">{title}</h1>
                    <p className="mt-1 text-[15px] text-[#5e3f3a]">{description}</p>
                </div>
            )}

            <section className="rounded-xl border border-[#e0e3e5] bg-white p-4 shadow-sm">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                            {t("filterFromDateLabel")}
                        </span>
                        <input
                            type="date"
                            value={fromDateInput}
                            onChange={(event) => setFromDateInput(event.target.value)}
                            className="h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                            {t("filterToDateLabel")}
                        </span>
                        <input
                            type="date"
                            value={toDateInput}
                            onChange={(event) => setToDateInput(event.target.value)}
                            className="h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                            {t("filterStatusLabel")}
                        </span>
                        <select
                            value={statusInput}
                            onChange={(event) => setStatusInput(event.target.value)}
                            className="h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                        >
                            <option value="">{t("filterAllStatus")}</option>
                            {Object.entries(otFormStatusLabels).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <div className="flex items-end gap-2">
                        <button
                            onClick={handleResetFilter}
                            disabled={isLoading}
                            className="h-10 flex-1 cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50"
                        >
                            {t("resetFilterButton")}
                        </button>
                        <button
                            onClick={handleSearch}
                            disabled={isLoading}
                            className="h-10 flex-1 cursor-pointer rounded-lg bg-[#e3000f] px-4 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:opacity-50"
                        >
                            {tCommon("search")}
                        </button>
                    </div>
                </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e0e3e5] bg-[#f8fafc] p-4">
                    <div className="text-sm text-[#5e3f3a]">
                        {isLoading ? tCommon("loading") : tCommon("showingRecords", { shown: forms.length, total: totalCount })}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {canBulkApprove && selectedIds.length > 0 && (
                            <>
                                <span className="text-sm font-semibold text-[#191c1e]">{t("selectedCount", { count: selectedIds.length })}</span>
                                <button
                                    onClick={() => openBulkAction("approve")}
                                    className="cursor-pointer rounded-lg bg-[#e3000f] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#b40009]"
                                >
                                    {t("bulkApproveButton")}
                                </button>
                                <button
                                    onClick={() => openBulkAction("reject")}
                                    className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                                >
                                    {t("bulkRejectButton")}
                                </button>
                            </>
                        )}
                        <button
                            onClick={() => fetchForms()}
                            disabled={isLoading}
                            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50"
                        >
                            <RefreshCw className="h-3.5 w-3.5" /> {tCommon("refresh")}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>
                )}

                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">
                                {canBulkApprove && (
                                    <th className="w-10 px-4 py-2.5">
                                        <input
                                            type="checkbox"
                                            checked={forms.length > 0 && selectedIds.length === forms.length}
                                            onChange={toggleSelectAll}
                                            aria-label={t("selectAllLabel")}
                                            className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                                        />
                                    </th>
                                )}
                                <th className="px-4 py-2.5">{t("colDepartmentGroup")}</th>
                                <th className="px-4 py-2.5">{t("colOtCase")}</th>
                                <th className="px-4 py-2.5">{t("colDate")}</th>
                                <th className="px-4 py-2.5">{t("colTotalHour")}</th>
                                <th className="px-4 py-2.5">{t("colNumberOfEmployee")}</th>
                                <th className="px-4 py-2.5">{t("colCreatedBy")}</th>
                                <th className="px-4 py-2.5">{t("colStatus")}</th>
                                <th className="px-4 py-2.5">{t("colApprovalProgress")}</th>
                                {mode === "my-forms" && <th className="px-4 py-2.5 text-right">{tCommon("actions")}</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && forms.length === 0 && (
                                <tr>
                                    <td colSpan={columnCount} className="px-4 py-12">
                                        <div className="flex flex-col items-center gap-2 text-center text-sm text-[#5e3f3a]">
                                            <Inbox className="h-8 w-8 text-[#c7ccd1]" />
                                            {t("noData")}
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {forms.map((form) => (
                                <tr
                                    key={form.id}
                                    onClick={() => router.push({ pathname: "/ot/forms", query: { id: String(form.id) } })}
                                    className="cursor-pointer border-b border-[#f1f5f9] transition-colors hover:bg-[#f8fafc]"
                                >
                                    {canBulkApprove && (
                                        <td className="px-4 py-3 align-top" onClick={(event) => event.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(form.id)}
                                                onChange={() => toggleSelectOne(form.id)}
                                                aria-label={t("selectAllLabel")}
                                                className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                                            />
                                        </td>
                                    )}
                                    <td className="px-4 py-3 align-top">
                                        <div className="text-sm font-semibold text-[#191c1e]">
                                            {bilingualText(form.departmentNameVn, form.departmentNameJp)}
                                        </div>
                                        <div className="text-xs text-[#5e3f3a]">{bilingualText(form.groupNameVn, form.groupNameJp)}</div>
                                    </td>
                                    <td className="px-4 py-3 align-top text-sm text-[#191c1e]">{form.otCaseCode}</td>
                                    <td className="px-4 py-3 align-top text-sm text-[#191c1e]">{formatDate(form.date)}</td>
                                    <td className="px-4 py-3 align-top text-sm text-[#191c1e]">
                                        <span className="inline-flex items-center rounded-full border border-[#e0e3e5] bg-[#f8fafc] px-2.5 py-0.5 text-xs font-semibold text-[#191c1e]">
                                            {form.totalHour}h
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 align-top text-sm text-[#191c1e]">{form.numberOfEmployee}</td>
                                    <td className="px-4 py-3 align-top text-sm text-[#5e3f3a]">
                                        {form.createdByFullName ?? form.createdByUserName}
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <span
                                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${otFormStatusClasses[form.status] ?? otFormStatusClasses[0]}`}
                                        >
                                            {otFormStatusLabels[form.status] ?? t("unknownStatus")}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <ApprovalSummaryCell
                                            summary={form.approvalSummary}
                                            status={form.status}
                                            currentStepCandidateCount={form.currentStepCandidateCount}
                                        />
                                    </td>
                                    {mode === "my-forms" && (
                                        <td className="px-4 py-3 align-top text-right">
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

            {bulkAction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto py-8">
                    <div className="fixed inset-0 bg-black/40" onClick={closeBulkAction} />
                    <div
                        role="dialog"
                        aria-modal="true"
                        className="z-60 mx-4 w-full max-w-lg rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
                    >
                        <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                            <h3 className="text-lg font-semibold text-[#191c1e]">
                                {bulkAction === "approve"
                                    ? t("modalTitleBulkApprove", { count: selectedIds.length })
                                    : t("modalTitleBulkReject", { count: selectedIds.length })}
                            </h3>
                            <button
                                onClick={closeBulkAction}
                                className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                                aria-label={tCommon("close")}
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                    {t("commentLabel")} {bulkAction === "reject" && <span className="text-[#930006]">*</span>}
                                </span>
                                <textarea
                                    value={bulkComment}
                                    onChange={(event) => setBulkComment(event.target.value)}
                                    disabled={isBulkSubmitting}
                                    rows={3}
                                    required={bulkAction === "reject"}
                                    className="w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
                                />
                            </label>

                            <label className="block">
                                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                    {t("secondaryPasswordLabel")} <span className="text-[#930006]">*</span>
                                </span>
                                <input
                                    type="password"
                                    value={bulkSecondaryPassword}
                                    onChange={(event) => setBulkSecondaryPassword(event.target.value)}
                                    disabled={isBulkSubmitting}
                                    autoComplete="off"
                                    className="w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
                                />
                            </label>

                            <p className="rounded-lg border border-[#e0e3e5] bg-[#f8fafc] px-3 py-2 text-xs text-[#5e3f3a]">
                                {t("bulkActionHint")}
                            </p>

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={closeBulkAction}
                                    disabled={isBulkSubmitting}
                                    className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {tCommon("cancel")}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleBulkSubmit}
                                    disabled={isBulkSubmitting}
                                    className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {isBulkSubmitting ? tCommon("processing") : tCommon("confirm")}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
