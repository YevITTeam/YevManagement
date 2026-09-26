"use client";

import { useState } from "react";
import { Calendar, Check, ChevronLeft, ChevronRight, FilterX, Inbox, Pencil, RefreshCw, Search, SlidersHorizontal, Users, X } from "lucide-react";
import { toast } from "react-toastify";
import { useLocale, useTranslations } from "next-intl";
import { getPathname, useRouter } from "@/navigation";

import { OtFormApi } from "@/modules/attendance/api/ot-form.api";
import type { OtFormApprovalSummaryItemDto, OtFormListItemDto, PendingApprovalDateCountDto } from "@/modules/attendance/types/ot-form.dto";
import { ProductionEmployeeApi } from "@/modules/attendance/api/production-employee.api";
import type { ProductionOptionDto } from "@/modules/attendance/types/production-employee.dto";
import { DepartmentApi } from "@/modules/attendance/api/department.api";
import type { DepartmentDto } from "@/modules/attendance/types/department.dto";
import { GroupApi } from "@/modules/attendance/api/group.api";
import type { GroupDto } from "@/modules/attendance/types/group.dto";
import { otFormStatusClasses, otFormStatusLabels } from "@/modules/attendance/types/enums";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { bilingualText } from "@/modules/attendance/lib/bilingual";
import { getApiErrorMessage } from "@/lib/apiError";

const PAGE_SIZE = 10;

function toDateStr(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

// [ngày-đầu-tháng, ngày-cuối-tháng] của (year, month 0-indexed) — dùng cho lịch mini + gọi
// GET /pending-approvals/dates.
function monthRange(year: number, month: number): { from: string; to: string } {
    return { from: toDateStr(new Date(year, month, 1)), to: toDateStr(new Date(year, month + 1, 0)) };
}

type OtFormListMode = "my-forms" | "pending-approvals" | "my-actions" | "my-participations" | "all-forms";

interface OtFormListPageProps {
    mode: OtFormListMode;
    // true khi nhúng trong tab container (OtFormTabsPage) — ẩn hẳn tiêu đề/mô tả riêng của từng mode,
    // chỉ còn bảng + phân trang, vì tab container đã có 1 tiêu đề chung ở ngoài.
    hideHeading?: boolean;
}

function formatDate(value: string) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("en-GB");
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
    const showWaitingCount = isWaiting && currentStepCandidateCount > 1;
    if (summary.length === 0 && !showWaitingCount) return null;
    // Gọn: mỗi bước đã xử lý chỉ còn icon ✓/✗ + tên Chức vụ (tên người nằm trong tooltip); trạng thái "đang
    // chờ" đã có pill Trạng thái nên chỉ hiện thêm số người cùng giữ bước đang chờ khi > 1.
    return (
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
            {summary.map((item, index) => {
                const isRejected = item.action === 2;
                return (
                    <span
                        key={index}
                        title={`${item.approverFullName ?? item.approverUserName} (${item.jobTitleNameSnapshot})`}
                        className={`inline-flex items-center gap-0.5 whitespace-nowrap text-xs ${isRejected ? "text-[#930006]" : "text-emerald-700"}`}
                    >
                        {isRejected ? <X size={11} /> : <Check size={11} />}
                        {item.jobTitleNameSnapshot}
                    </span>
                );
            })}
            {showWaitingCount && (
                <span
                    title={t("waitingForNextMulti", { count: currentStepCandidateCount })}
                    className="inline-flex items-center gap-0.5 whitespace-nowrap text-xs text-[#9a5b00]"
                >
                    <Users size={11} />
                    {currentStepCandidateCount}
                </span>
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
    const locale = useLocale();
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
    // Bộ lọc nâng cao (Bộ phận/Nhóm/Team/Line/Nhóm ca) mặc định thu gọn — đa số lượt chỉ lọc theo ngày/trạng thái.
    const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
    const [fromDateInput, setFromDateInput] = useState("");
    const [toDateInput, setToDateInput] = useState("");
    const [statusInput, setStatusInput] = useState("");
    // Lọc theo Bộ phận/Nhóm (đơn văn phòng) và Line/Team/Nhóm ca (đơn dưới chuyền) — 2026-09-04, BE hỗ
    // trợ cả 5 param ở MỌI endpoint danh sách (xem GetOtFormListParams), nên hiện cùng lúc ở mọi tab.
    const [departmentId, setDepartmentId] = useState<number | "">("");
    const [groupId, setGroupId] = useState<number | "">("");
    const [productionTeamId, setProductionTeamId] = useState<number | "">("");
    const [productionLineId, setProductionLineId] = useState<number | "">("");
    const [productionShiftTeamId, setProductionShiftTeamId] = useState<number | "">("");
    const [appliedFilters, setAppliedFilters] = useState({
        fromDate: "",
        toDate: "",
        status: "",
        departmentId: "" as number | "",
        groupId: "" as number | "",
        productionTeamId: "" as number | "",
        productionLineId: "" as number | "",
        productionShiftTeamId: "" as number | "",
    });

    // Đổi mode (chuyển menu) → về trang 1 + xoá bộ lọc, phát hiện bằng so sánh snapshot ngay trong
    // render (React khuyến khích thay effect chỉ để "phản ứng" theo prop/state khác đổi).
    const [prevMode, setPrevMode] = useState(mode);
    if (prevMode !== mode) {
        setPrevMode(mode);
        setPageIndex(1);
        setFromDateInput("");
        setToDateInput("");
        setStatusInput("");
        setDepartmentId("");
        setGroupId("");
        setProductionTeamId("");
        setProductionLineId("");
        setProductionShiftTeamId("");
        setAppliedFilters({
            fromDate: "",
            toDate: "",
            status: "",
            departmentId: "",
            groupId: "",
            productionTeamId: "",
            productionLineId: "",
            productionShiftTeamId: "",
        });
    }

    const listParams = {
        pageIndex,
        pageSize: PAGE_SIZE,
        fromDate: appliedFilters.fromDate || undefined,
        toDate: appliedFilters.toDate || undefined,
        status: appliedFilters.status !== "" ? Number(appliedFilters.status) : undefined,
        departmentId: appliedFilters.departmentId !== "" ? appliedFilters.departmentId : undefined,
        groupId: appliedFilters.groupId !== "" ? appliedFilters.groupId : undefined,
        productionTeamId: appliedFilters.productionTeamId !== "" ? appliedFilters.productionTeamId : undefined,
        productionLineId: appliedFilters.productionLineId !== "" ? appliedFilters.productionLineId : undefined,
        productionShiftTeamId: appliedFilters.productionShiftTeamId !== "" ? appliedFilters.productionShiftTeamId : undefined,
    };

    // ── Chọn Phòng ban → Nhóm đang chọn (nếu có) có thể không còn thuộc Phòng ban mới, reset —
    // snapshot render (CLAUDE.md §4.5), cùng pattern Team→Line bên dưới. ──
    const [departmentOptions, setDepartmentOptions] = useState<DepartmentDto[]>([]);
    const [groupOptions, setGroupOptions] = useState<GroupDto[]>([]);

    useFetchEffect(() => DepartmentApi.getAllDepartments(), [], setDepartmentOptions, t("officeFilterLoadError"));

    const [prevFilterDepartmentId, setPrevFilterDepartmentId] = useState(departmentId);
    if (prevFilterDepartmentId !== departmentId) {
        setPrevFilterDepartmentId(departmentId);
        setGroupId("");
    }

    useFetchEffect(
        () => (departmentId === "" ? Promise.resolve([]) : GroupApi.getGroupsByDepartment(departmentId)),
        [departmentId],
        setGroupOptions,
        t("officeFilterLoadError")
    );

    // ── Chọn Team → Line đang chọn (nếu có) có thể không còn thuộc Team mới, reset — snapshot render
    // (CLAUDE.md §4.5), cùng pattern CreateOtFormPage.tsx. ──
    const [teamOptions, setTeamOptions] = useState<ProductionOptionDto[]>([]);
    const [lineOptions, setLineOptions] = useState<ProductionOptionDto[]>([]);
    const [shiftTeamOptions, setShiftTeamOptions] = useState<ProductionOptionDto[]>([]);
    // Trước đây chỉ hiện ở "Chờ tôi duyệt" — mở rộng ra mọi tab (kể cả "Tất cả đơn") theo yêu cầu
    // người dùng (2026-09-04), BE đã hỗ trợ filter này ở mọi endpoint danh sách.
    const showProductionFilter = true;

    useFetchEffect(
        () => (showProductionFilter ? ProductionEmployeeApi.getTeamOptions() : Promise.resolve([])),
        [showProductionFilter],
        setTeamOptions,
        t("productionFilterLoadError")
    );

    const [prevFilterTeamId, setPrevFilterTeamId] = useState(productionTeamId);
    if (prevFilterTeamId !== productionTeamId) {
        setPrevFilterTeamId(productionTeamId);
        setProductionLineId("");
    }

    useFetchEffect(
        () => (showProductionFilter ? ProductionEmployeeApi.getLineOptions(productionTeamId === "" ? undefined : productionTeamId) : Promise.resolve([])),
        [showProductionFilter, productionTeamId],
        setLineOptions,
        t("productionFilterLoadError")
    );

    const filterShiftTeamKey = `${productionLineId}|${productionTeamId}`;
    const [prevFilterShiftTeamKey, setPrevFilterShiftTeamKey] = useState(filterShiftTeamKey);
    if (prevFilterShiftTeamKey !== filterShiftTeamKey) {
        setPrevFilterShiftTeamKey(filterShiftTeamKey);
        setProductionShiftTeamId("");
    }

    useFetchEffect(
        () =>
            showProductionFilter
                ? ProductionEmployeeApi.getShiftTeamOptions(
                      productionLineId === "" ? undefined : productionLineId,
                      productionTeamId === "" ? undefined : productionTeamId
                  )
                : Promise.resolve([]),
        [showProductionFilter, productionLineId, productionTeamId],
        setShiftTeamOptions,
        t("productionFilterLoadError")
    );

    // ── Lịch mini "ngày nào có đơn chưa duyệt" (2026-09-04) — chỉ tab "Chờ tôi duyệt". ──
    const today = new Date();
    const [calendarYear, setCalendarYear] = useState(today.getFullYear());
    const [calendarMonthIndex, setCalendarMonthIndex] = useState(today.getMonth());
    const [calendarCounts, setCalendarCounts] = useState<PendingApprovalDateCountDto[]>([]);
    const calendarRange = monthRange(calendarYear, calendarMonthIndex);

    useFetchEffect(
        () =>
            mode === "pending-approvals"
                ? OtFormApi.getPendingApprovalDates(calendarRange.from, calendarRange.to)
                : Promise.resolve([]),
        [mode, calendarRange.from, calendarRange.to],
        setCalendarCounts,
        t("calendarLoadError")
    );

    const goToPreviousMonth = () => {
        if (calendarMonthIndex === 0) {
            setCalendarYear((y) => y - 1);
            setCalendarMonthIndex(11);
        } else {
            setCalendarMonthIndex((m) => m - 1);
        }
    };

    const goToNextMonth = () => {
        if (calendarMonthIndex === 11) {
            setCalendarYear((y) => y + 1);
            setCalendarMonthIndex(0);
        } else {
            setCalendarMonthIndex((m) => m + 1);
        }
    };

    const pickCalendarDate = (dateStr: string) => {
        setFromDateInput(dateStr);
        setToDateInput(dateStr);
        setPageIndex(1);
        setAppliedFilters((current) => ({ ...current, fromDate: dateStr, toDate: dateStr }));
    };

    const { isLoading, error, refetch: fetchForms } = useFetchEffect(
        () =>
            mode === "my-forms"
                ? OtFormApi.getMyForms(listParams)
                : mode === "pending-approvals"
                ? OtFormApi.getPendingApprovals(listParams)
                : mode === "my-actions"
                ? OtFormApi.getMyActions(listParams)
                : mode === "all-forms"
                ? OtFormApi.getAllForms(listParams)
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
        setAppliedFilters({
            fromDate: fromDateInput,
            toDate: toDateInput,
            status: statusInput,
            departmentId,
            groupId,
            productionTeamId,
            productionLineId,
            productionShiftTeamId,
        });
    };

    const handleResetFilter = () => {
        setFromDateInput("");
        setToDateInput("");
        setStatusInput("");
        setDepartmentId("");
        setGroupId("");
        setProductionTeamId("");
        setProductionLineId("");
        setProductionShiftTeamId("");
        setPageIndex(1);
        setAppliedFilters({
            fromDate: "",
            toDate: "",
            status: "",
            departmentId: "",
            groupId: "",
            productionTeamId: "",
            productionLineId: "",
            productionShiftTeamId: "",
        });
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
            : mode === "all-forms"
            ? t("titleAllForms")
            : t("titleMyParticipations");
    const advancedFilterCount = [
        appliedFilters.departmentId,
        appliedFilters.groupId,
        appliedFilters.productionTeamId,
        appliedFilters.productionLineId,
        appliedFilters.productionShiftTeamId,
    ].filter((value) => value !== "").length;
    const columnCount = (mode === "my-forms" ? 9 : 8) + (canBulkApprove ? 1 : 0);

    return (
        <div className="space-y-4">
            {!hideHeading && (
                <div>
                    <h1 className="text-xl font-semibold text-[#191c1e]">{title}</h1>
                </div>
            )}

            <section className="rounded-xl border border-[#e0e3e5] bg-white p-3 shadow-sm">
                <div className="flex flex-wrap items-end gap-x-3 gap-y-2 [&>label]:w-full sm:[&>label]:w-40">
                    <label className="block">
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-[#5e3f3a]">
                            {t("filterFromDateLabel")}
                        </span>
                        <input
                            type="date"
                            value={fromDateInput}
                            onChange={(event) => setFromDateInput(event.target.value)}
                            className="h-9 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-[#5e3f3a]">
                            {t("filterToDateLabel")}
                        </span>
                        <input
                            type="date"
                            value={toDateInput}
                            onChange={(event) => setToDateInput(event.target.value)}
                            className="h-9 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-[#5e3f3a]">
                            {t("filterStatusLabel")}
                        </span>
                        <select
                            value={statusInput}
                            onChange={(event) => setStatusInput(event.target.value)}
                            className="h-9 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
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
                            type="button"
                            onClick={() => setShowAdvancedFilter((current) => !current)}
                            aria-expanded={showAdvancedFilter}
                            title={t("filterAdvancedButton")}
                            aria-label={t("filterAdvancedButton")}
                            className="relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#e0e3e5] bg-white text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <SlidersHorizontal className="h-4 w-4" />
                            {advancedFilterCount > 0 && (
                                <span className="absolute -right-1.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#e3000f] px-1 text-[10px] font-bold text-white">
                                    {advancedFilterCount}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={handleResetFilter}
                            disabled={isLoading}
                            title={t("resetFilterButton")}
                            aria-label={t("resetFilterButton")}
                            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#e0e3e5] bg-white text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <FilterX className="h-4 w-4" />
                        </button>
                        <button
                            onClick={handleSearch}
                            disabled={isLoading}
                            title={tCommon("search")}
                            aria-label={tCommon("search")}
                            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-[#e3000f] text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Search className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {showAdvancedFilter && (
                    <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-2 border-t border-[#f1f5f9] pt-2.5 [&>label]:w-full sm:[&>label]:w-48">
                    <label className="block">
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-[#5e3f3a]">
                            {t("filterDepartmentLabel")}
                        </span>
                        <select
                            value={departmentId}
                            onChange={(event) => setDepartmentId(event.target.value ? Number(event.target.value) : "")}
                            className="h-9 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                        >
                            <option value="">{t("filterAllDepartment")}</option>
                            {departmentOptions.map((option) => (
                                <option key={option.id} value={option.id}>{option.departmentNameVn}</option>
                            ))}
                        </select>
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-[#5e3f3a]">
                            {t("filterGroupLabel")}
                        </span>
                        <select
                            value={groupId}
                            onChange={(event) => setGroupId(event.target.value ? Number(event.target.value) : "")}
                            disabled={departmentId === ""}
                            className="h-9 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
                        >
                            <option value="">{t("filterAllGroup")}</option>
                            {groupOptions.map((option) => (
                                <option key={option.id} value={option.id}>{option.groupNameVn}</option>
                            ))}
                        </select>
                    </label>
                    {showProductionFilter && (
                        <>
                            <label className="block">
                                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-[#5e3f3a]">
                                    {t("filterProductionTeamLabel")}
                                </span>
                                <select
                                    value={productionTeamId}
                                    onChange={(event) => setProductionTeamId(event.target.value ? Number(event.target.value) : "")}
                                    className="h-9 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                                >
                                    <option value="">{t("filterAllProductionTeam")}</option>
                                    {teamOptions.map((option) => (
                                        <option key={option.id} value={option.id}>{option.nameVn || option.code}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="block">
                                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-[#5e3f3a]">
                                    {t("filterProductionLineLabel")}
                                </span>
                                <select
                                    value={productionLineId}
                                    onChange={(event) => setProductionLineId(event.target.value ? Number(event.target.value) : "")}
                                    className="h-9 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                                >
                                    <option value="">{t("filterAllProductionLine")}</option>
                                    {lineOptions.map((option) => (
                                        <option key={option.id} value={option.id}>{option.nameVn || option.code}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="block">
                                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-[#5e3f3a]">
                                    {t("filterProductionShiftTeamLabel")}
                                </span>
                                <select
                                    value={productionShiftTeamId}
                                    onChange={(event) => setProductionShiftTeamId(event.target.value ? Number(event.target.value) : "")}
                                    className="h-9 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                                >
                                    <option value="">{t("filterAllProductionShiftTeam")}</option>
                                    {shiftTeamOptions.map((option) => (
                                        <option key={option.id} value={option.id}>{option.nameVn || option.code}</option>
                                    ))}
                                </select>
                            </label>
                        </>
                    )}
                
                    </div>
                )}

                {mode === "pending-approvals" && (
                    <div className="mt-4 rounded-lg border border-[#e0e3e5] bg-[#f8fafc] p-3">
                        <div className="mb-2 flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                <Calendar className="h-3.5 w-3.5" /> {t("calendarTitle")}
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={goToPreviousMonth}
                                    className="cursor-pointer rounded-md border border-[#e0e3e5] bg-white p-1 text-[#5e3f3a] transition hover:bg-[#f2f4f6]"
                                    aria-label={t("calendarPrevMonth")}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <span className="min-w-[80px] text-center text-sm font-semibold text-[#191c1e]">
                                    {t("calendarMonthLabel", { month: calendarMonthIndex + 1, year: calendarYear })}
                                </span>
                                <button
                                    type="button"
                                    onClick={goToNextMonth}
                                    className="cursor-pointer rounded-md border border-[#e0e3e5] bg-white p-1 text-[#5e3f3a] transition hover:bg-[#f2f4f6]"
                                    aria-label={t("calendarNextMonth")}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                        {calendarCounts.length === 0 ? (
                            <p className="text-xs text-[#9aa0a6]">{t("calendarEmpty")}</p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {calendarCounts.map((item) => (
                                    <button
                                        key={item.date}
                                        type="button"
                                        onClick={() => pickCalendarDate(item.date)}
                                        className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                                            appliedFilters.fromDate === item.date && appliedFilters.toDate === item.date
                                                ? "border-[#e3000f] bg-[#fff4f2] text-[#e3000f]"
                                                : "border-[#e0e3e5] bg-white text-[#191c1e] hover:bg-[#f2f4f6]"
                                        }`}
                                    >
                                        {formatDate(item.date)}
                                        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#e3000f] px-1 text-[10px] font-bold text-white">
                                            {item.count}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </section>

            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e0e3e5] bg-[#f8fafc] p-3">
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
                            title={tCommon("refresh")}
                            aria-label={tCommon("refresh")}
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#e0e3e5] bg-white text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50"
                        >
                            <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>
                )}

                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.1em] text-[#5e3f3a]">
                                {canBulkApprove && (
                                    <th className="w-10 px-3 py-2.5">
                                        <input
                                            type="checkbox"
                                            checked={forms.length > 0 && selectedIds.length === forms.length}
                                            onChange={toggleSelectAll}
                                            aria-label={t("selectAllLabel")}
                                            className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                                        />
                                    </th>
                                )}
                                <th className="whitespace-nowrap px-3 py-2.5">{t("colDepartmentGroup")}</th>
                                <th className="whitespace-nowrap px-3 py-2.5">{t("colProductionLine")}</th>
                                <th className="whitespace-nowrap px-3 py-2.5">{t("colOtCase")}</th>
                                <th className="whitespace-nowrap px-3 py-2.5">{t("colDate")}</th>
                                <th className="whitespace-nowrap px-3 py-2.5">{t("colTotalHour")}</th>
                                <th className="whitespace-nowrap px-3 py-2.5">{t("colNumberOfEmployee")}</th>
                                <th className="whitespace-nowrap px-3 py-2.5">{t("colCreatedBy")}</th>
                                <th className="whitespace-nowrap px-3 py-2.5">{t("colStatus")}</th>
                                {mode === "my-forms" && <th className="whitespace-nowrap px-3 py-2.5 text-right">{tCommon("actions")}</th>}
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
                                    className="cursor-pointer border-b border-[#f1f5f9] bg-white transition-colors even:bg-[#f2f4f7] hover:bg-[#e8ecf1]"
                                >
                                    {canBulkApprove && (
                                        <td className="px-3 py-2.5 align-top" onClick={(event) => event.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(form.id)}
                                                onChange={() => toggleSelectOne(form.id)}
                                                aria-label={t("selectAllLabel")}
                                                className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                                            />
                                        </td>
                                    )}
                                    <td className="px-3 py-2.5 align-top">
                                        <div className="text-sm font-semibold text-[#191c1e]">
                                            {bilingualText(form.departmentNameVn, form.departmentNameJp)}
                                        </div>
                                        <div className="text-xs text-[#5e3f3a]">{bilingualText(form.groupNameVn, form.groupNameJp)}</div>
                                    </td>
                                    <td className="px-3 py-2.5 align-top text-xs text-[#5e3f3a]">
                                        {form.isProductionForm ? (
                                            <>
                                                <div>{form.productionLineNames || "—"}</div>
                                                {form.productionShiftTeamNames && (
                                                    <div className="text-[#9aa0a6]">{form.productionShiftTeamNames}</div>
                                                )}
                                            </>
                                        ) : (
                                            "—"
                                        )}
                                    </td>
                                    <td className="px-3 py-2.5 align-top text-sm text-[#191c1e]">{form.otCaseCode}</td>
                                    <td className="whitespace-nowrap px-3 py-2.5 align-top text-sm text-[#191c1e]">{formatDate(form.date)}</td>
                                    <td className="px-3 py-2.5 align-top text-sm text-[#191c1e]">
                                        <span className="inline-flex items-center rounded-full border border-[#e0e3e5] bg-[#f8fafc] px-2.5 py-0.5 text-xs font-semibold text-[#191c1e]">
                                            {form.totalHour}h
                                        </span>
                                    </td>
                                    <td className="px-3 py-2.5 align-top text-sm text-[#191c1e]">{form.numberOfEmployee}</td>
                                    <td className="px-3 py-2.5 align-top text-sm text-[#5e3f3a]">
                                        {form.createdByFullName ?? form.createdByUserName}
                                    </td>
                                    <td className="px-3 py-2.5 align-top">
                                        <div className="space-y-1">
                                            <span
                                                className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${otFormStatusClasses[form.status] ?? otFormStatusClasses[0]}`}
                                            >
                                                {otFormStatusLabels[form.status] ?? t("unknownStatus")}
                                            </span>
                                            <ApprovalSummaryCell
                                                summary={form.approvalSummary}
                                                status={form.status}
                                                currentStepCandidateCount={form.currentStepCandidateCount}
                                            />
                                        </div>
                                    </td>
                                    {mode === "my-forms" && (
                                        <td className="px-3 py-2.5 align-top text-right">
                                            {form.isEditable && canCreate && (
                                                <button
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        router.push({ pathname: "/ot/forms/edit", query: { id: String(form.id) } });
                                                    }}
                                                    title={tCommon("edit")}
                                                    aria-label={tCommon("edit")}
                                                    className="cursor-pointer rounded-md p-1.5 text-[#5e3f3a] transition hover:bg-[#f2f4f6] hover:text-[#191c1e]"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </button>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex items-center justify-between border-t border-[#e0e3e5] p-3">
                    <button
                        title={tCommon("prevPage")}
                        aria-label={tCommon("prevPage")}
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#e0e3e5] bg-white text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={!hasPreviousPage || isLoading}
                        onClick={() => setPageIndex((current) => Math.max(1, current - 1))}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <div className="flex h-8 items-center px-3 text-sm font-semibold text-[#191c1e]">
                        {tCommon("pageOf", { current: pageIndex, total: totalPages })}
                    </div>
                    <button
                        title={tCommon("nextPage")}
                        aria-label={tCommon("nextPage")}
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#e0e3e5] bg-white text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={!hasNextPage || isLoading}
                        onClick={() => setPageIndex((current) => current + 1)}
                    >
                        <ChevronRight className="h-4 w-4" />
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
                            {/* Xem/sửa từng đơn trước khi xác nhận hàng loạt (2026-09-04, theo yêu cầu người
                                dùng) — "Sửa" mở đúng màn Sửa đơn (đã gộp thêm/xóa NV, Phần 1) ở TAB MỚI để
                                không mất lựa chọn/modal hàng loạt đang mở; sửa xong tự refetch danh sách khi
                                đóng modal như bình thường. */}
                            <div className="rounded-lg border border-[#e0e3e5] bg-[#f8fafc] p-3">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                    {t("bulkReviewTitle", { count: selectedIds.length })}
                                </p>
                                <div className="max-h-40 space-y-1 overflow-y-auto">
                                    {forms
                                        .filter((form) => selectedIds.includes(form.id))
                                        .map((form) => (
                                            <div
                                                key={form.id}
                                                className="flex items-center justify-between gap-2 rounded-md border border-[#e0e3e5] bg-white px-2.5 py-1.5 text-xs"
                                            >
                                                <span className="text-[#191c1e]">
                                                    #{form.id} — {bilingualText(form.departmentNameVn, form.departmentNameJp)}
                                                    {form.groupNameVn ? ` / ${bilingualText(form.groupNameVn, form.groupNameJp)}` : ""}{" "}
                                                    ({formatDate(form.date)})
                                                </span>
                                                {form.isEditable && (
                                                    <a
                                                        href={getPathname({ href: { pathname: "/ot/forms/edit", query: { id: String(form.id) } }, locale })}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={(event) => event.stopPropagation()}
                                                        title={tCommon("edit")}
                                                        aria-label={tCommon("edit")}
                                                        className="shrink-0 cursor-pointer rounded-md p-1 text-[#5e3f3a] transition hover:bg-[#f2f4f6] hover:text-[#191c1e]"
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </a>
                                                )}
                                            </div>
                                        ))}
                                </div>
                            </div>

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
