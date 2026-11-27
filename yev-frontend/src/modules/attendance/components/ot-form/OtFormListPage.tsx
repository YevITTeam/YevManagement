"use client";

import { useState, type ReactNode } from "react";
import { CalendarClock, Check, CheckCheck, ChevronLeft, ChevronRight, Eye, Pencil, SearchX, SlidersHorizontal, Users, X } from "lucide-react";
import { toast } from "react-toastify";
import { useLocale, useTranslations } from "next-intl";
import { getPathname, useRouter } from "@/navigation";

import { OtFormApi } from "@/modules/attendance/api/ot-form.api";
import type { OtFormApprovalSummaryItemDto, OtFormListItemDto, PendingApprovalDateCountDto } from "@/modules/attendance/types/ot-form.dto";
import { ProductionEmployeeApi } from "@/modules/attendance/api/production-employee.api";
import type { ProductionOptionDto } from "@/modules/attendance/types/production-employee.dto";
import { DepartmentApi } from "@/modules/attendance/api/department.api";
import { WorkshopApi } from "@/modules/attendance/api/workshop.api";
import type { DepartmentDto } from "@/modules/attendance/types/department.dto";
import type { WorkshopDto } from "@/modules/attendance/types/workshop.dto";
import { GroupApi } from "@/modules/attendance/api/group.api";
import type { GroupDto } from "@/modules/attendance/types/group.dto";
import { otFormStatusClasses, otFormStatusDotClasses } from "@/modules/attendance/types/enums";
import OtCaseBadge from "@/modules/attendance/components/OtCaseBadge";
import OtFormDetail from "@/modules/attendance/components/ot-form/OtFormDetail";
import { useEnumLabels } from "@/modules/attendance/lib/useEnumLabels";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { getApiErrorMessage } from "@/lib/apiError";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { StyledSelect } from "@/components/ui/StyledSelect";
import { Pagination } from "@/components/ui/Pagination";
import { readPersisted, usePersistOnChange, usePersistedState } from "@/modules/common/hooks/usePersistedState";
import { TableScroll } from "@/components/ui/TableScroll";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { DateRange, ErrorBar, FilterActions, ListToolbar, TableStatusRows, fieldClassName, theadRowClassName } from "@/components/ui/ListToolbar";

const PAGE_SIZE = 10;
const advancedTriggerClassName = `${fieldClassName} w-44 pr-8`;

// Name in the current locale (falls back to the other language); the other-language name goes to `title`.
function localeName(locale: string, vn: string | null | undefined, jp: string | null | undefined): [string, string | undefined] {
    const isJa = locale === "ja";
    const name = (isJa ? jp || vn : vn || jp) || "—";
    const other = (isJa ? vn : jp) || undefined;
    return [name, other === name ? undefined : other];
}

function toDateStr(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

// [first, last] day of (year, 0-indexed month).
function monthRange(year: number, month: number): { from: string; to: string } {
    return { from: toDateStr(new Date(year, month, 1)), to: toDateStr(new Date(year, month + 1, 0)) };
}

type OtFormListMode = "my-forms" | "pending-approvals" | "my-actions" | "my-participations" | "all-forms";

interface OtFormListPageProps {
    mode: OtFormListMode;
    // Tab bar rendered above the filter row so tabs, filters and table share one card.
    tabs?: ReactNode;
}

function formatDate(value: string) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("en-GB");
}

// The month switcher already shows the year.
function formatDayMonth(value: string) {
    return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" });
}

// The list has no approvalSteps, so the pending job title isn't shown; only "waiting for 1 of N" when
// several people hold the pending step, so viewers know it isn't theirs alone.
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
    // Processed steps show only an icon + job title (name in tooltip); the status pill already covers "waiting".
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

type FormTypeFilter = "" | "office" | "production";

const emptyAppliedFilters = {
    fromDate: "",
    toDate: "",
    status: "",
    formType: "" as FormTypeFilter,
    workshopId: "" as number | "",
    departmentId: "" as number | "",
    groupId: "" as number | "",
    productionTeamId: "" as number | "",
    productionLineId: "" as number | "",
    productionShiftTeamId: "" as number | "",
};

// What a tab keeps across opening a form and coming back.
type ListSnapshot = {
    pageIndex: number;
    showAdvancedFilter: boolean;
    fromDateInput: string;
    toDateInput: string;
    statusInput: string;
    formTypeInput: FormTypeFilter;
    workshopId: number | "";
    departmentId: number | "";
    groupId: number | "";
    productionTeamId: number | "";
    productionLineId: number | "";
    productionShiftTeamId: number | "";
    appliedFilters: typeof emptyAppliedFilters;
};

export default function OtFormListPage({ mode, tabs }: OtFormListPageProps) {
    const t = useTranslations("Attendance.OtFormList");
    const tCommon = useTranslations("Common");
    const enumLabels = useEnumLabels();
    const router = useRouter();
    const locale = useLocale();
    const { user } = useAuth();
    const canCreate = hasPermission(user, "Attendance.OTForm.Create");
    const isPendingTab = mode === "pending-approvals";
    const canBulkApprove = isPendingTab && hasPermission(user, "Attendance.OTForm.Approve");
    const [forms, setForms] = useState<OtFormListItemDto[]>([]);
    const listKey = `list:ot/forms:${mode}`;
    const [saved] = useState(() => readPersisted<ListSnapshot>(listKey));

    // FE doesn't filter by current-step candidate (same as single approve); BE rejects per form.
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [bulkAction, setBulkAction] = useState<"approve" | "reject" | null>(null);
    const [previewFormId, setPreviewFormId] = useState<number | null>(null);
    const [bulkComment, setBulkComment] = useState("");
    const [bulkSecondaryPassword, setBulkSecondaryPassword] = useState("");
    const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);

    const [pageIndex, setPageIndex] = useState(saved?.pageIndex ?? 1);
    const [pageSize, setPageSize] = usePersistedState("page-size:attendance/components/ot-form/OtFormListPage", PAGE_SIZE);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    // Draft filters, applied only on "Search".
    // Advanced filters collapsed by default; most searches only use date/status.
    const [showAdvancedFilter, setShowAdvancedFilter] = useState(saved?.showAdvancedFilter ?? false);
    const [fromDateInput, setFromDateInput] = useState(saved?.fromDateInput ?? "");
    const [toDateInput, setToDateInput] = useState(saved?.toDateInput ?? "");
    const [statusInput, setStatusInput] = useState(saved?.statusInput ?? "");
    // BE supports these filters on every list endpoint, so they show on all tabs.
    // "" = all; "production" = floor forms (by line), "office" = office forms (by group).
    const [formTypeInput, setFormTypeInput] = useState<FormTypeFilter>(saved?.formTypeInput ?? "");
    const [workshopId, setWorkshopId] = useState<number | "">(saved?.workshopId ?? "");
    const [departmentId, setDepartmentId] = useState<number | "">(saved?.departmentId ?? "");
    const [groupId, setGroupId] = useState<number | "">(saved?.groupId ?? "");
    const [productionTeamId, setProductionTeamId] = useState<number | "">(saved?.productionTeamId ?? "");
    const [productionLineId, setProductionLineId] = useState<number | "">(saved?.productionLineId ?? "");
    const [productionShiftTeamId, setProductionShiftTeamId] = useState<number | "">(saved?.productionShiftTeamId ?? "");
    const [appliedFilters, setAppliedFilters] = useState(saved?.appliedFilters ?? emptyAppliedFilters);
    usePersistOnChange(listKey, {
        pageIndex,
        showAdvancedFilter,
        fromDateInput,
        toDateInput,
        statusInput,
        formTypeInput,
        workshopId,
        departmentId,
        groupId,
        productionTeamId,
        productionLineId,
        productionShiftTeamId,
        appliedFilters,
    } satisfies ListSnapshot);

    // Switching type drops the filters that no longer apply (snapshot compare in render, frontend-conventions.md §3).
    const [prevFormTypeInput, setPrevFormTypeInput] = useState(formTypeInput);
    if (prevFormTypeInput !== formTypeInput) {
        setPrevFormTypeInput(formTypeInput);
        if (formTypeInput === "production") {
            setGroupId("");
        } else {
            setProductionTeamId("");
            setProductionLineId("");
            setProductionShiftTeamId("");
        }
    }

    // Mode change resets page and filters via render-time snapshot compare instead of an effect.
    const [prevMode, setPrevMode] = useState(mode);
    if (prevMode !== mode) {
        setPrevMode(mode);
        setPageIndex(1);
        setFromDateInput("");
        setToDateInput("");
        setStatusInput("");
        setFormTypeInput("");
        setWorkshopId("");
        setDepartmentId("");
        setGroupId("");
        setProductionTeamId("");
        setProductionLineId("");
        setProductionShiftTeamId("");
        setAppliedFilters(emptyAppliedFilters);
    }

    const listParams = {
        pageIndex,
        pageSize,
        fromDate: appliedFilters.fromDate || undefined,
        toDate: appliedFilters.toDate || undefined,
        // Every pending form is InApproval, so the tab has no status filter (and ignores a stale persisted one).
        status: !isPendingTab && appliedFilters.status !== "" ? Number(appliedFilters.status) : undefined,
        isProductionForm: appliedFilters.formType === "" ? undefined : appliedFilters.formType === "production",
        workshopId: appliedFilters.workshopId !== "" ? appliedFilters.workshopId : undefined,
        departmentId: appliedFilters.departmentId !== "" ? appliedFilters.departmentId : undefined,
        groupId: appliedFilters.groupId !== "" ? appliedFilters.groupId : undefined,
        productionTeamId: appliedFilters.productionTeamId !== "" ? appliedFilters.productionTeamId : undefined,
        productionLineId: appliedFilters.productionLineId !== "" ? appliedFilters.productionLineId : undefined,
        productionShiftTeamId: appliedFilters.productionShiftTeamId !== "" ? appliedFilters.productionShiftTeamId : undefined,
    };

    // Department change may orphan the selected group; reset via render-time snapshot (frontend-conventions.md §3).
    const [departmentOptions, setDepartmentOptions] = useState<DepartmentDto[]>([]);
    const [groupOptions, setGroupOptions] = useState<GroupDto[]>([]);

    useFetchEffect(() => DepartmentApi.getAllDepartments(), [], setDepartmentOptions, t("officeFilterLoadError"));
    const [workshopOptions, setWorkshopOptions] = useState<WorkshopDto[]>([]);
    useFetchEffect(() => WorkshopApi.getAllWorkshops(), [], setWorkshopOptions, t("officeFilterLoadError"));

    const [prevFilterDepartmentId, setPrevFilterDepartmentId] = useState(departmentId);
    const [prevFilterWorkshopId, setPrevFilterWorkshopId] = useState(workshopId);
    if (prevFilterDepartmentId !== departmentId || prevFilterWorkshopId !== workshopId) {
        setPrevFilterDepartmentId(departmentId);
        setPrevFilterWorkshopId(workshopId);
        setGroupId("");
    }

    useFetchEffect(
        () => (departmentId === "" ? Promise.resolve([]) : GroupApi.getGroupsByDepartment(departmentId, workshopId === "" ? undefined : workshopId)),
        [departmentId, workshopId],
        setGroupOptions,
        t("officeFilterLoadError")
    );

    // Team change may orphan the selected Line; reset via render-time snapshot.
    const [teamOptions, setTeamOptions] = useState<ProductionOptionDto[]>([]);
    const [lineOptions, setLineOptions] = useState<ProductionOptionDto[]>([]);
    const [shiftTeamOptions, setShiftTeamOptions] = useState<ProductionOptionDto[]>([]);
    // Team/Line/shift only apply to floor forms; other types don't show or load them.
    const showProductionFilter = formTypeInput === "production";
    const showOfficeGroupFilter = formTypeInput !== "production";

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

    // Mini calendar of dates with pending forms (pending-approvals tab only).
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
        [mode, pageIndex, pageSize, appliedFilters],
        (result) => {
            setForms(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
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
            formType: formTypeInput,
            workshopId,
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
        setFormTypeInput("");
        setWorkshopId("");
        setDepartmentId("");
        setGroupId("");
        setProductionTeamId("");
        setProductionLineId("");
        setProductionShiftTeamId("");
        setPageIndex(1);
        setAppliedFilters(emptyAppliedFilters);
    };

    // Clear the selection when the list changes, via render-time snapshot compare.
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

    const advancedFilterCount = [
        appliedFilters.workshopId,
        appliedFilters.departmentId,
        appliedFilters.groupId,
        appliedFilters.productionTeamId,
        appliedFilters.productionLineId,
        appliedFilters.productionShiftTeamId,
    ].filter((value) => value !== "").length;
    // Columns that would repeat one value on every row of this tab are hidden.
    const showCreator = mode !== "my-forms";
    const showActions = mode === "my-forms";
    const columnCount = 6 + (canBulkApprove ? 1 : 0) + (showCreator ? 1 : 0) + (showActions ? 1 : 0);

    const openForm = (id: number) => router.push({ pathname: "/ot/forms", query: { id: String(id) } });

    const statusLabel = (status: number) =>
        status === 0 ? t("statusPendingShort") : (enumLabels.otFormStatus[status] ?? t("unknownStatus"));

    const renderSelectBox = (id: number) => (
        <input
            type="checkbox"
            checked={selectedIds.includes(id)}
            onChange={() => toggleSelectOne(id)}
            aria-label={t("selectAllLabel")}
            className="h-4 w-4 cursor-pointer accent-[#e3000f]"
        />
    );

    const renderStatus = (status: number) => (
        <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${otFormStatusClasses[status] ?? otFormStatusClasses[0]}`}>
            {statusLabel(status)}
        </span>
    );

    const renderEditButton = (form: OtFormListItemDto) =>
        form.isEditable && !form.isProductionForm && canCreate ? (
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
        ) : null;

    // Office forms show the group; floor forms show "Line · shift team".
    const subUnit = (form: OtFormListItemDto): [string, string | undefined] =>
        form.isProductionForm
            ? [[form.productionLineNames, form.productionShiftTeamNames].filter(Boolean).join(" · ") || "—", undefined]
            : localeName(locale, form.groupNameVn, form.groupNameJp);

    const bulkApproveLabel = t("bulkApproveButton", { count: selectedIds.length });

    return (
        <div className="space-y-4">
            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                {/* Own row: five tabs plus the filters don't fit one line at 1366px. */}
                {tabs && <div className="px-3 pt-2.5">{tabs}</div>}
                <ListToolbar
                    actions={
                        canBulkApprove && selectedIds.length > 0 ? (
                            <>
                                <button
                                    type="button"
                                    onClick={() => openBulkAction("approve")}
                                    title={bulkApproveLabel}
                                    aria-label={bulkApproveLabel}
                                    className="inline-flex h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md bg-[#e3000f] px-2.5 text-sm font-semibold text-white transition hover:bg-[#b40009] sm:px-3"
                                >
                                    <CheckCheck className="h-4 w-4" />
                                    <span className="hidden sm:inline">{bulkApproveLabel}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => openBulkAction("reject")}
                                    title={t("bulkRejectButton")}
                                    aria-label={t("bulkRejectButton")}
                                    className="inline-flex h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-[#e0e3e5] bg-white px-2.5 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] sm:px-3"
                                >
                                    <X className="h-4 w-4" />
                                    <span className="hidden sm:inline">{t("bulkRejectButton")}</span>
                                </button>
                            </>
                        ) : undefined
                    }
                >
                    <DateRange
                        from={fromDateInput}
                        to={toDateInput}
                        onChange={(range) => {
                            setFromDateInput(range.fromDate);
                            setToDateInput(range.toDate);
                        }}
                    />
                    {!isPendingTab && (
                        <StyledSelect
                            value={statusInput}
                            onChange={setStatusInput}
                            ariaLabel={t("filterStatusLabel")}
                            triggerClassName={`${fieldClassName} w-44 pr-8`}
                            options={[
                                { value: "", label: t("filterAllStatus") },
                                ...Object.keys(enumLabels.otFormStatus).map((value) => ({
                                    value,
                                    label: statusLabel(Number(value)),
                                    dotClassName: otFormStatusDotClasses[Number(value)],
                                })),
                            ]}
                        />
                    )}
                    <StyledSelect
                        value={formTypeInput}
                        onChange={setFormTypeInput}
                        ariaLabel={t("filterTypeLabel")}
                        triggerClassName={`${fieldClassName} w-40 pr-8`}
                        options={[
                            { value: "", label: t("filterAllType") },
                            { value: "office", label: t("typeOffice") },
                            { value: "production", label: t("typeProduction") },
                        ]}
                    />
                    <button
                        type="button"
                        onClick={() => setShowAdvancedFilter((current) => !current)}
                        aria-expanded={showAdvancedFilter}
                        title={t("filterAdvancedButton")}
                        aria-label={t("filterAdvancedButton")}
                        className={`relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border transition ${
                            showAdvancedFilter ? "border-[#e9bcb6] bg-[#fff4f2] text-[#e3000f]" : "border-[#e0e3e5] bg-white text-[#5e3f3a] hover:bg-[#f2f4f6]"
                        }`}
                    >
                        <SlidersHorizontal className="h-4 w-4" />
                        {advancedFilterCount > 0 && (
                            <span className="absolute -right-1.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#e3000f] px-1 text-[10px] font-bold text-white">
                                {advancedFilterCount}
                            </span>
                        )}
                    </button>
                    <FilterActions onSearch={handleSearch} onReset={handleResetFilter} onRefresh={() => fetchForms()} disabled={isLoading} />
                </ListToolbar>

                {showAdvancedFilter && (
                    <ListToolbar>
                        <SearchableSelect
                            value={workshopId}
                            onChange={setWorkshopId}
                            ariaLabel={t("filterWorkshopLabel")}
                            placeholder={t("filterAllWorkshop")}
                            triggerClassName={advancedTriggerClassName}
                            options={workshopOptions.map((option) => ({
                                value: option.id,
                                label: localeName(locale, option.workshopNameVn, option.workshopNameJp)[0],
                                searchText: `${option.workshopNameVn} ${option.workshopNameJp ?? ""}`.toLowerCase(),
                            }))}
                        />
                        <SearchableSelect
                            value={departmentId}
                            onChange={setDepartmentId}
                            ariaLabel={t("filterDepartmentLabel")}
                            placeholder={t("filterAllDepartment")}
                            triggerClassName={advancedTriggerClassName}
                            options={departmentOptions.map((option) => ({
                                value: option.id,
                                label: localeName(locale, option.departmentNameVn, option.departmentNameJp)[0],
                                searchText: `${option.departmentNameVn} ${option.departmentNameJp ?? ""}`.toLowerCase(),
                            }))}
                        />
                        {showOfficeGroupFilter && (
                            <SearchableSelect
                                value={groupId}
                                onChange={setGroupId}
                                disabled={departmentId === ""}
                                ariaLabel={t("filterGroupLabel")}
                                placeholder={t("filterAllGroup")}
                                triggerClassName={advancedTriggerClassName}
                                options={groupOptions.map((option) => ({
                                    value: option.id,
                                    label: localeName(locale, option.groupNameVn, option.groupNameJp)[0],
                                    searchText: `${option.groupNameVn} ${option.groupNameJp ?? ""}`.toLowerCase(),
                                }))}
                            />
                        )}
                        {showProductionFilter && (
                            <>
                                <SearchableSelect
                                    value={productionTeamId}
                                    onChange={setProductionTeamId}
                                    ariaLabel={t("filterProductionTeamLabel")}
                                    placeholder={t("filterAllProductionTeam")}
                                    triggerClassName={advancedTriggerClassName}
                                    options={teamOptions.map((option) => ({
                                        value: option.id,
                                        label: option.nameVn || option.code,
                                        searchText: (option.nameVn || option.code).toLowerCase(),
                                    }))}
                                />
                                <SearchableSelect
                                    value={productionLineId}
                                    onChange={setProductionLineId}
                                    ariaLabel={t("filterProductionLineLabel")}
                                    placeholder={t("filterAllProductionLine")}
                                    triggerClassName={advancedTriggerClassName}
                                    options={lineOptions.map((option) => ({
                                        value: option.id,
                                        label: option.nameVn || option.code,
                                        searchText: (option.nameVn || option.code).toLowerCase(),
                                    }))}
                                />
                                <SearchableSelect
                                    value={productionShiftTeamId}
                                    onChange={setProductionShiftTeamId}
                                    ariaLabel={t("filterProductionShiftTeamLabel")}
                                    placeholder={t("filterAllProductionShiftTeam")}
                                    triggerClassName={advancedTriggerClassName}
                                    options={shiftTeamOptions.map((option) => ({
                                        value: option.id,
                                        label: option.nameVn || option.code,
                                        searchText: (option.nameVn || option.code).toLowerCase(),
                                    }))}
                                />
                            </>
                        )}
                    </ListToolbar>
                )}

                {isPendingTab && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[#e0e3e5] bg-[#f8fafc] px-3 py-2">
                        <span role="img" aria-label={t("calendarTitle")} title={t("calendarTitle")} className="text-[#5e3f3a]">
                            <CalendarClock className="h-4 w-4" aria-hidden />
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={goToPreviousMonth}
                                className="cursor-pointer rounded-md border border-[#e0e3e5] bg-white p-1 text-[#5e3f3a] transition hover:bg-[#f2f4f6]"
                                title={t("calendarPrevMonth")}
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
                                title={t("calendarNextMonth")}
                                aria-label={t("calendarNextMonth")}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                        {calendarCounts.length === 0 ? (
                            <span className="text-xs text-[#8a8f94]">{t("calendarEmpty")}</span>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {calendarCounts.map((item) => (
                                    <button
                                        key={item.date}
                                        type="button"
                                        onClick={() => pickCalendarDate(item.date)}
                                        title={formatDate(item.date)}
                                        className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold tabular-nums transition ${
                                            appliedFilters.fromDate === item.date && appliedFilters.toDate === item.date
                                                ? "border-[#e3000f] bg-[#fff4f2] text-[#e3000f]"
                                                : "border-[#e0e3e5] bg-white text-[#191c1e] hover:bg-[#f2f4f6]"
                                        }`}
                                    >
                                        {formatDayMonth(item.date)}
                                        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#e3000f] px-1 text-[10px] font-bold text-white">
                                            {item.count}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <ErrorBar message={error} />

                <TableScroll className="relative hidden md:block">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className={theadRowClassName}>
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
                                <th className="px-3 py-2.5">{t("colDepartmentGroup")}</th>
                                <th className="w-[1%] px-3 py-2.5">{t("colOtCase")}</th>
                                <th className="px-3 py-2.5">{t("colDate")}</th>
                                <th className="px-3 py-2.5 text-right">{t("colTotalHour")}</th>
                                <th className="px-3 py-2.5 text-right">{t("colNumberOfEmployee")}</th>
                                {showCreator && <th className="px-3 py-2.5">{t("colCreatedBy")}</th>}
                                <th className="px-3 py-2.5">{isPendingTab ? t("colApprovalProgress") : t("colStatus")}</th>
                                {showActions && <th className="px-3 py-2.5" aria-label={tCommon("actions")} />}
                            </tr>
                        </thead>
                        <tbody>
                            <TableStatusRows loading={isLoading} empty={forms.length === 0} columns={columnCount} emptyText={t("noData")} />
                            {forms.map((form) => {
                                const [department, departmentOther] = localeName(locale, form.departmentNameVn, form.departmentNameJp);
                                const [unit, unitOther] = subUnit(form);
                                return (
                                    <tr
                                        key={form.id}
                                        onClick={() => openForm(form.id)}
                                        className="cursor-pointer border-b border-[#f1f5f9] bg-white transition-colors even:bg-[#f2f4f7] hover:bg-[#e8ecf1]"
                                    >
                                        {canBulkApprove && (
                                            <td className="px-3 py-2.5 align-top" onClick={(event) => event.stopPropagation()}>
                                                {renderSelectBox(form.id)}
                                            </td>
                                        )}
                                        <td className="px-3 py-2.5 align-top">
                                            <div
                                                className="whitespace-nowrap text-sm font-semibold text-[#191c1e]"
                                                title={[departmentOther, form.workshopNameVn].filter(Boolean).join(" · ")}
                                            >
                                                {department}
                                            </div>
                                            <div className="text-xs text-[#5e3f3a]" title={unitOther}>
                                                {unit}
                                            </div>
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-2.5 align-top text-sm text-[#191c1e]">
                                            <OtCaseBadge code={form.otCaseCode} description={form.otCaseDescription} descriptionJp={form.otCaseDescriptionJp} />
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-2.5 align-top text-sm tabular-nums text-[#191c1e]">{formatDate(form.date)}</td>
                                        <td className="whitespace-nowrap px-3 py-2.5 text-right align-top text-sm font-semibold tabular-nums text-[#191c1e]">{form.totalHour}h</td>
                                        <td className="px-3 py-2.5 text-right align-top text-sm tabular-nums text-[#191c1e]">{form.numberOfEmployee}</td>
                                        {showCreator && (
                                            <td className="whitespace-nowrap px-3 py-2.5 align-top text-sm text-[#5e3f3a]">
                                                {form.createdByFullName ?? form.createdByUserName}
                                            </td>
                                        )}
                                        <td className="px-3 py-2.5 align-top">
                                            <div className="space-y-1">
                                                {!isPendingTab && renderStatus(form.status)}
                                                <ApprovalSummaryCell
                                                    summary={form.approvalSummary}
                                                    status={form.status}
                                                    currentStepCandidateCount={form.currentStepCandidateCount}
                                                />
                                            </div>
                                        </td>
                                        {showActions && <td className="px-3 py-2.5 text-right align-top">{renderEditButton(form)}</td>}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </TableScroll>

                <ul className="divide-y divide-[#f1f5f9] md:hidden">
                    {forms.length === 0 &&
                        (isLoading ? (
                            Array.from({ length: 5 }).map((_, index) => (
                                <li key={index} className="space-y-2 px-4 py-3">
                                    <Skeleton className="h-4 w-48" />
                                    <Skeleton className="h-3 w-32" />
                                </li>
                            ))
                        ) : (
                            <li>
                                <EmptyState icon={SearchX} title={t("noData")} />
                            </li>
                        ))}
                    {forms.map((form) => {
                        const [department, departmentOther] = localeName(locale, form.departmentNameVn, form.departmentNameJp);
                        const [unit, unitOther] = subUnit(form);
                        return (
                            <li key={form.id} className="flex items-start gap-3 px-4 py-3">
                                {canBulkApprove && <div className="pt-0.5">{renderSelectBox(form.id)}</div>}
                                <button
                                    type="button"
                                    onClick={() => openForm(form.id)}
                                    className="min-w-0 flex-1 cursor-pointer text-left"
                                >
                                    <span className="flex items-start justify-between gap-3">
                                        <span className="min-w-0 text-sm font-semibold text-[#191c1e]" title={departmentOther}>
                                            {department}
                                        </span>
                                        {!isPendingTab && renderStatus(form.status)}
                                    </span>
                                    <span className="mt-0.5 block truncate text-xs text-[#5e3f3a]" title={unitOther}>
                                        {unit}
                                    </span>
                                    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[#5e3f3a]">
                                        <span className="tabular-nums text-[#191c1e]">{formatDate(form.date)}</span>
                                        <span className="font-semibold tabular-nums text-[#191c1e]">{form.totalHour}h</span>
                                        <span className="inline-flex items-center gap-1 tabular-nums">
                                            <Users size={12} />
                                            {form.numberOfEmployee}
                                        </span>
                                        {showCreator && <span>{form.createdByFullName ?? form.createdByUserName}</span>}
                                    </span>
                                </button>
                                {showActions && renderEditButton(form)}
                            </li>
                        );
                    })}
                </ul>

                <Pagination
                    pageSize={pageSize}
                    onPageSizeChange={setPageSize}
                    pageIndex={pageIndex}
                    totalPages={totalPages}
                    onPageChange={setPageIndex}
                    disabled={isLoading}
                    summary={isLoading ? tCommon("loading") : tCommon("showingRecords", { shown: forms.length, total: totalCount })}
                    compactSummary={totalCount}
                />
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
                            {/* View opens a popup and edit a new tab, so the selection and this dialog survive. */}
                            <div className="rounded-lg border border-[#e0e3e5] bg-[#f8fafc] p-3">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">{t("bulkReviewTitle")}</p>
                                <div className="max-h-40 space-y-1 overflow-y-auto">
                                    {forms
                                        .filter((form) => selectedIds.includes(form.id))
                                        .map((form) => {
                                            const [department] = localeName(locale, form.departmentNameVn, form.departmentNameJp);
                                            const [unit] = subUnit(form);
                                            return (
                                                <div
                                                    key={form.id}
                                                    className="flex items-center justify-between gap-2 rounded-md border border-[#e0e3e5] bg-white px-2.5 py-1.5 text-xs"
                                                >
                                                    <span className="text-[#191c1e]" title={`#${form.id}`}>
                                                        <span className="tabular-nums">{formatDayMonth(form.date)}</span> · {department} / {unit}
                                                    </span>
                                                    <div className="flex shrink-0 items-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => setPreviewFormId(form.id)}
                                                            title={tCommon("viewDetail")}
                                                            aria-label={tCommon("viewDetail")}
                                                            className="cursor-pointer rounded-md p-1 text-[#5e3f3a] transition hover:bg-[#f2f4f6] hover:text-[#191c1e]"
                                                        >
                                                            <Eye className="h-3.5 w-3.5" />
                                                        </button>
                                                        {form.isEditable && !form.isProductionForm && (
                                                            <a
                                                                href={getPathname({ href: { pathname: "/ot/forms/edit", query: { id: String(form.id) } }, locale })}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                onClick={(event) => event.stopPropagation()}
                                                                title={t("editInNewTab")}
                                                                aria-label={t("editInNewTab")}
                                                                className="cursor-pointer rounded-md p-1 text-[#5e3f3a] transition hover:bg-[#f2f4f6] hover:text-[#191c1e]"
                                                            >
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
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
                                    className={`inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                        bulkAction === "approve" ? "bg-[#e3000f] hover:bg-[#b40009]" : "bg-[#930006] hover:bg-[#7a0005]"
                                    }`}
                                >
                                    {bulkAction === "approve" ? <CheckCheck className="h-4 w-4" /> : <X className="h-4 w-4" />}
                                    {isBulkSubmitting ? tCommon("processing") : bulkAction === "approve" ? t("approveConfirmButton") : t("bulkRejectButton")}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {previewFormId !== null && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/40" onClick={() => setPreviewFormId(null)} />
                    <div
                        role="dialog"
                        aria-modal="true"
                        className="relative max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-xl border border-[#e0e3e5] bg-[#f7f9fb] p-5 shadow-xl"
                    >
                        <button
                            type="button"
                            onClick={() => setPreviewFormId(null)}
                            className="absolute right-3 top-3 z-10 cursor-pointer rounded-md p-1 text-[#5e3f3a] transition hover:bg-[#f2f4f6] hover:text-[#191c1e]"
                            aria-label={tCommon("close")}
                        >
                            <X className="h-5 w-5" />
                        </button>
                        <div className="pr-8">
                            <OtFormDetail id={previewFormId} readOnly />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
