"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Car, Check, Printer, RefreshCw, Undo2, UserMinus, Users, X } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { useRouter } from "@/navigation";

import { DepartmentApi } from "@/modules/attendance/api/department.api";
import type { DepartmentDto } from "@/modules/attendance/types/department.dto";
import { GroupApi } from "@/modules/attendance/api/group.api";
import type { GroupDto } from "@/modules/attendance/types/group.dto";
import { ReasonApi } from "@/modules/attendance/api/reason.api";
import type { ReasonDto } from "@/modules/attendance/types/reason.dto";
import { OtCaseApi } from "@/modules/attendance/api/ot-case.api";
import { WorkCalendarApi } from "@/modules/attendance/api/work-calendar.api";
import type { WorkCalendarDayDto } from "@/modules/attendance/types/work-calendar.dto";
import type { OtCaseDto } from "@/modules/attendance/types/ot-case.dto";
import { EmployeeApi } from "@/modules/attendance/api/employee.api";
import type { EmployeeDto } from "@/modules/attendance/types/employee.dto";
import { ProductionEmployeeApi } from "@/modules/attendance/api/production-employee.api";
import type { ProductionEmployeeSearchItemDto, ProductionOptionDto } from "@/modules/attendance/types/production-employee.dto";
import { OtFormApi } from "@/modules/attendance/api/ot-form.api";
import type {
    CreateOtFormDto,
    MyCreateScopeItemDto,
    MyProductionCreateScopeItemDto,
    OtFormEmployeeDto,
    OtFormEmployeeInputDto,
    ProcessPartDto,
} from "@/modules/attendance/types/ot-form.dto";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { RequiredMark } from "@/components/ui/RequiredMark";
import InfoTooltip from "@/components/ui/InfoTooltip";
import TimePicker24h from "@/components/ui/TimePicker24h";
import { UserSignatureApi } from "@/modules/attendance/api/user-signature.api";
import SecondaryPasswordDialog from "@/modules/attendance/components/secondary-password/SecondaryPasswordDialog";
import { SecondaryPasswordApi } from "@/modules/attendance/api/secondary-password.api";
import { getApiErrorMessage } from "@/lib/apiError";
import { normalizeText } from "@/lib/normalizeText";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";
import { useAttendanceSetting } from "@/modules/attendance/hooks/useAttendanceSetting";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { useDragScroll } from "@/modules/common/hooks/useDragScroll";
import { MEAL_TICKET_MAIN, MEAL_TICKET_NONE, MEAL_TICKET_SECONDARY, computeActualHours, computeMealTicketType, isEarlyMealWindowOt } from "@/modules/attendance/lib/mealTicket";
import { MealTicketTypeBadge } from "./MealTicketTypeBadge";

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-9 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

function toMinutes(time: string): number {
    if (!time) return NaN;
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
}

function getTodayStr(offsetDays = 0): string {
    const now = new Date();
    now.setDate(now.getDate() + offsetDays);
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

// No overnight shifts: end must be after start on the same day (BE compares TimeOnly without dates).
// Returns 0 when invalid; isTimeRangeInvalid shows the error.
function computeTotalHour(startTime: string, endTime: string): number {
    if (!startTime || !endTime) return 0;
    const diffMinutes = toMinutes(endTime) - toMinutes(startTime);
    if (diffMinutes <= 0) return 0;
    return Math.round((diffMinutes / 60) * 100) / 100;
}

type AccumulationKind = "Daily" | "Monthly" | "Yearly";

// One accumulation value cell (day/month/year). extraHours is this form's own hours for a selected employee, so the
// cell turns on as soon as picking the employee would pass the limit. Daily is red (BE blocks the form); monthly
// and yearly are amber (the form must be TH3). Early warning only; mirrors OtFormService.ValidateOtHourLimitsAsync /
// ExceedsMonthYearLimitAsync, which are the real guards.
function AccumulationCell({
    t,
    code,
    kind,
    hours,
    limit,
    extraHours = 0,
}: {
    t: (key: string, values?: Record<string, string | number>) => string;
    code: string;
    kind: AccumulationKind;
    hours: number;
    limit: number;
    extraHours?: number;
}) {
    const total = Math.round((hours + extraHours) * 100) / 100;
    const isOver = total > limit;
    const overClassName = kind === "Daily" ? "font-semibold text-[#930006]" : "font-semibold text-[#b45309]";
    return (
        <td
            className={`whitespace-nowrap px-3 py-2 text-center align-top text-sm ${isOver ? overClassName : "text-[#5e3f3a]"}`}
            title={isOver ? t(`employeeOver${kind}Limit`, { code, hours: total, limit }) : undefined}
        >
            <span className="inline-flex items-center gap-1">
                {isOver && <AlertTriangle className="h-3 w-3" />}
                {hours}h
                {extraHours > 0 && <span className="text-[11px] font-normal text-[#8a8f94]">+{Math.round(extraHours * 100) / 100}h</span>}
            </span>
        </td>
    );
}

// Pills next to the employee name: red when the day total would pass the daily limit (form is blocked), amber when the
// month/year total would pass the limit (form becomes TH3).
function OverLimitBadges({ t, overDay, overTh3 }: { t: (key: string) => string; overDay: boolean; overTh3: boolean }) {
    if (!overDay && !overTh3) return null;
    return (
        <span className="ml-1.5 inline-flex items-center gap-1">
            {overDay && (
                <span title={t("badgeOverDailyTooltip")} className="inline-flex items-center rounded-full border border-[#ffdad6] bg-[#fff0ef] px-1.5 py-0.5 text-[10px] font-semibold text-[#930006]">
                    {t("badgeOverDaily")}
                </span>
            )}
            {overTh3 && (
                <span title={t("badgeTh3Tooltip")} className="inline-flex items-center rounded-full border border-[#fde68a] bg-[#fffbeb] px-1.5 py-0.5 text-[10px] font-semibold text-[#b45309]">
                    TH3
                </span>
            )}
        </span>
    );
}

const emptyProcessPart: ProcessPartDto = {
    // Meals are mandatory for every form; BE always stores IsEat=true regardless.
    isEat: true,
    mainTicketCount: 0,
    secondaryTicketCount: 0,
    milkCount: 0,
    isTransportation: false,
    isUseCopyRoom: false,
    anotherSuggestionVn: null,
    anotherSuggestionJp: null,
};

interface EmployeeOverride {
    // "" = follow the form's start time; otherwise a per-employee start within the form's time range.
    startTime: string;
    endTime: string;
    // BE field: true = eats during the shift (MealBreakDeductionHours deducted). Production forms always send true;
    // office forms show it inverted as "eat later" (ticked = false, no deduction).
    didEat: boolean;
    noteVn: string;
    noteJp: string;
}

// Faint vertical rules (th darker than td) to track rows across many columns.
const tableClassName =
    "min-w-full border-collapse text-left [&_td]:border-r [&_td]:border-[#eef1f3] [&_td:last-child]:border-r-0 [&_th]:border-r [&_th]:border-[#e0e3e5]";
const compactFieldClassName = fieldClassName.replace("h-10", "h-9");
// Pinned right so actions stay visible while scrolling; bg-inherit takes the row's solid background
// (every row needs one, see zebra) to cover content scrolling underneath.
const stickyActionCellClassName =
    "sticky right-0 z-10 bg-inherit px-2 py-2 align-middle text-center shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.15)]";

// <button role="checkbox"> instead of a sr-only input in a label: focusing the hidden input makes the browser
// scrollIntoView it, jumping the <main> scroll area on pages with long tables.
function ToggleOptionCard({
    icon,
    label,
    checked,
    onChange,
    disabled,
}: {
    icon: ReactNode;
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            disabled={disabled}
            className={`flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                checked
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-[#e0e3e5] bg-white text-[#191c1e] hover:bg-[#f8fafc]"
            } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
        >
            <span className={checked ? "text-emerald-600" : "text-[#5e3f3a]"}>{icon}</span>
            {label}
        </button>
    );
}

interface CreateOtFormPageProps {
    // Set = edit mode: prefilled, submits PUT instead of POST.
    otFormId?: number;
}

export default function CreateOtFormPage({ otFormId }: CreateOtFormPageProps) {
    const t = useTranslations("Attendance.CreateOtForm");
    const tCommon = useTranslations("Common");
    const router = useRouter();
    const { user } = useAuth();
    const isEditMode = otFormId !== undefined;
    // Admin-only permission used as the "unrestricted" signal when my-create-scopes is empty, to tell Admin apart
    // from an unconfigured account (which must be blocked).
    const isUnrestrictedAdmin = hasPermission(user, "Attendance.Department.Create");
    // Hide the production tab without its dedicated permission.
    const canCreateProductionForm = hasPermission(user, "Attendance.OTForm.CreateProduction");
    // CreateProduction alone doesn't grant group mode; hide the tab rather than show it and block it.
    const canUseGroupMode = isUnrestrictedAdmin || hasPermission(user, "Attendance.OTForm.Create");

    // Chosen only on create (an existing form keeps isProductionForm). Production-only accounts start in production
    // mode from `user` permissions directly; the my-create-scopes effect still switches as a fallback for empty group scope.
    const [formMode, setFormMode] = useState<"group" | "production">(() =>
        canCreateProductionForm && !canUseGroupMode ? "production" : "group"
    );

    // Office (group) forms can edit everything but Department/Group; production forms only their employees.
    const isOfficeEdit = isEditMode && formMode === "group";
    const isHeaderLocked = isEditMode && formMode === "production";

    const [departments, setDepartments] = useState<DepartmentDto[]>([]);
    const [groups, setGroups] = useState<GroupDto[]>([]);
    const [reasons, setReasons] = useState<ReasonDto[]>([]);
    const [otCases, setOtCases] = useState<OtCaseDto[]>([]);
    // Group-mode create loads one list per selected group; edit mode keeps the form's single group.
    const [employeeGroups, setEmployeeGroups] = useState<{ groupId: number; employees: EmployeeDto[] }[]>([]);
    const groupEmployees = useMemo(() => employeeGroups.flatMap((g) => g.employees), [employeeGroups]);

    // ── Production mode: filters + ProductionEmployee search ──
    const [lineOptions, setLineOptions] = useState<ProductionOptionDto[]>([]);
    const [teamOptions, setTeamOptions] = useState<ProductionOptionDto[]>([]);
    const [shiftTeamOptions, setShiftTeamOptions] = useState<ProductionOptionDto[]>([]);
    const [productionLineId, setProductionLineId] = useState<number | "">("");
    const [productionTeamId, setProductionTeamId] = useState<number | "">("");
    const [productionShiftTeamId, setProductionShiftTeamId] = useState<number | "">("");
    const [productionKeyword, setProductionKeyword] = useState("");
    const [productionResults, setProductionResults] = useState<ProductionEmployeeSearchItemDto[]>([]);
    // Team/Line/shift-group combos where the creator is Line Leader; null = still loading.
    const [productionCreateScopes, setProductionCreateScopes] = useState<MyProductionCreateScopeItemDto[] | null>(null);
    const isProductionScopeRestricted = productionCreateScopes !== null && productionCreateScopes.length > 0;
    // One combo → lock all three dropdowns; several → only restrict the choices. Declared here because the
    // Team/Line reset blocks below need it before the fetch effect.
    const isProductionScopeLocked = isProductionScopeRestricted && productionCreateScopes!.length === 1;

    const [departmentId, setDepartmentId] = useState<number | null>(null);
    const [groupIds, setGroupIds] = useState<number[]>([]);
    const groupId = groupIds[0] ?? null;
    const [reasonId, setReasonId] = useState<number | null>(null);
    // OT case of the form being edited. On create the case is derived, never chosen (see otCaseId below).
    const [loadedOtCaseId, setLoadedOtCaseId] = useState<number | null>(null);
    const [date, setDate] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [subReason, setSubReason] = useState("");

    // Company non-working-day calendar for the year of the form date. A date in it is a non-working day:
    // the OT case becomes TH2 and the daily OT limit switches to the holiday limit.
    const calendarYear = date ? Number(date.slice(0, 4)) : null;
    const [calendarDays, setCalendarDays] = useState<WorkCalendarDayDto[]>([]);
    useFetchEffect(
        () => (calendarYear ? WorkCalendarApi.getByYear(calendarYear) : Promise.resolve([])),
        [calendarYear],
        setCalendarDays,
        t("workCalendarLoadError")
    );
    // A year with no calendar rows falls back to Sundays, same as the BE.
    const isNonWorkingDay =
        Boolean(date) &&
        (calendarDays.length > 0
            ? calendarDays.some((day) => day.date === date)
            : new Date(`${date}T00:00:00Z`).getUTCDay() === 0);
    const baseOtCaseCode = date ? (isNonWorkingDay ? "TH2" : "TH1") : null;
    const baseOtCaseId = isEditMode ? loadedOtCaseId : (otCases.find((c) => c.code === baseOtCaseCode)?.id ?? null);

    // Hide the employee list until the core fields are filled so users fill the form top-down. groupId is
    // checked separately (group mode only).
    const isCoreFormInfoFilled = Boolean(departmentId && reasonId && baseOtCaseId && date && startTime && endTime);

    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
    const [employeeOverrides, setEmployeeOverrides] = useState<Record<number, EmployeeOverride>>({});
    // Edit mode only: the form's own employees (removed ones filtered out), not groupEmployees.
    const [editEmployees, setEditEmployees] = useState<OtFormEmployeeDto[]>([]);

    // Adds/removals while editing are staged and applied in one PUT on save. employeeAddedMeta only holds
    // display info, since newly added people have no OtFormEmployeeDto or accumulation until saved.
    const [employeeAddedMeta, setEmployeeAddedMeta] = useState<Record<number, { employeeCode: string; fullName: string }>>({});
    const [addSearchQuery, setAddSearchQuery] = useState("");
    const addSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [addSearchResults, setAddSearchResults] = useState<{ employeeId: number; employeeCode: string; fullName: string }[]>([]);
    const [pendingRemovals, setPendingRemovals] = useState<Record<number, string>>({});
    const [removeTarget, setRemoveTarget] = useState<{ employeeId: number; employeeCode: string; fullName: string } | null>(null);
    const [removeReasonInput, setRemoveReasonInput] = useState("");
    // The creator removes people from their own form without giving a reason.
    const [isFormCreator, setIsFormCreator] = useState(false);

    // Keyed by groupId in group-mode create (each group has its own support request), 0 otherwise.
    const [processParts, setProcessParts] = useState<Record<number, ProcessPartDto>>({});
    // Keys whose meal ticket counts the user typed; others always show and send the live computed counts.
    const [manualMealTicketKeys, setManualMealTicketKeys] = useState<Record<number, boolean>>({});

    const { setting } = useAttendanceSetting();

    // Production forms: always true (meals mandatory); office forms: false = "eat later" ticked, no deduction.
    const defaultDidEatForNewEmployee = formMode === "production";

    // Groups that disallow eating later always eat during the shift (BE forces the same); unknown groups stay allowed.
    const noEatLaterGroupIds = useMemo(() => new Set(groups.filter((g) => !g.allowEatLater).map((g) => g.id)), [groups]);
    const groupIdByEmployeeId = useMemo(() => new Map(groupEmployees.map((e) => [e.id, e.groupId])), [groupEmployees]);
    const canEatLater = (employeeId: number) => {
        if (formMode === "production") return false;
        const employeeGroupId = isEditMode ? groupId : groupIdByEmployeeId.get(employeeId);
        return employeeGroupId == null || !noEatLaterGroupIds.has(employeeGroupId);
    };
    const didEatOf = (employeeId: number) =>
        !canEatLater(employeeId) || (employeeOverrides[employeeId]?.didEat ?? defaultDidEatForNewEmployee);
    const showAteLaterColumn = formMode !== "production" && groupIds.some((id) => !noEatLaterGroupIds.has(id));

    const dailyOtHourLimit = isNonWorkingDay ? setting.dailyOtHourLimitHoliday : setting.dailyOtHourLimit;

    // TH3 is forced when any selected employee's projected month/year accumulation plus this form's own
    // hours passes their month/year limit (own custom limit first, else the shared one). The daily total never
    // forces it. Mirrors OtFormService.ExceedsMonthYearLimitAsync, which is the real guard.
    const accumulationById = useMemo(() => {
        const accumulationById = new Map<number, { month: number; year: number; monthLimit: number; yearLimit: number }>();
        for (const employee of groupEmployees) {
            accumulationById.set(employee.id, {
                month: employee.projectedMonthToDate,
                year: employee.projectedYearToDate,
                monthLimit: employee.customMonthlyOtHourLimit ?? setting.monthlyOtHourLimit,
                yearLimit: employee.customYearlyOtHourLimit ?? setting.yearlyOtHourLimit,
            });
        }
        for (const item of productionResults) {
            accumulationById.set(item.employeeId, {
                month: item.projectedMonthToDate,
                year: item.projectedYearToDate,
                monthLimit: item.customMonthlyOtHourLimit ?? setting.monthlyOtHourLimit,
                yearLimit: item.customYearlyOtHourLimit ?? setting.yearlyOtHourLimit,
            });
        }
        return accumulationById;
    }, [groupEmployees, productionResults, setting]);
    const exceedsTh3For = (employeeIds: number[]) => {
        if (isEditMode || !date || !startTime || !endTime) return false;
        return employeeIds.some((employeeId) => {
            const accumulation = accumulationById.get(employeeId);
            if (!accumulation) return false;
            const hours = computeActualHours(
                employeeOverrides[employeeId]?.startTime || startTime,
                employeeOverrides[employeeId]?.endTime || endTime,
                didEatOf(employeeId),
                setting
            );
            return accumulation.month + hours > accumulation.monthLimit || accumulation.year + hours > accumulation.yearLimit;
        });
    };
    const otCaseCodeFor = (employeeIds: number[]) => (exceedsTh3For(employeeIds) ? "TH3" : baseOtCaseCode);
    const exceedsTh3 = exceedsTh3For(selectedEmployeeIds);
    const otCaseCode = exceedsTh3 ? "TH3" : baseOtCaseCode;
    const otCaseId = isEditMode ? loadedOtCaseId : (otCases.find((c) => c.code === otCaseCode)?.id ?? null);

    // Group-mode create: narrows the table only; hidden rows keep their selection.
    const [employeeQuery, setEmployeeQuery] = useState("");
    const employeeKeyword = normalizeText(employeeQuery.trim());
    const matchesEmployeeQuery = (employee: EmployeeDto) =>
        !employeeKeyword || normalizeText(`${employee.code} ${employee.lastName} ${employee.firstName}`).includes(employeeKeyword);

    // Group-mode create: one form per selected group, each with its own OT case and support request.
    const isGroupCreate = !isEditMode && formMode === "group";
    const isMultiGroup = isGroupCreate && groupIds.length > 1;
    const groupSections = isGroupCreate
        ? groupIds.map((id) => {
              const employees = employeeGroups.find((g) => g.groupId === id)?.employees ?? [];
              return {
                  groupId: id,
                  employees,
                  visibleEmployees: employees.filter(matchesEmployeeQuery),
                  selectedIds: employees.filter((e) => selectedEmployeeIds.includes(e.id)).map((e) => e.id),
              };
          })
        : [];
    const visibleGroupEmployees = groupSections.flatMap((section) => section.visibleEmployees);

    // Signature is only required at approval, so this is a soft hint that never blocks submit.
    const [hasSignature, setHasSignature] = useState<boolean | null>(null);
    // Secondary password is required to save, both create and edit.
    const [hasSecondaryPassword, setHasSecondaryPassword] = useState<boolean | null>(null);
    const [secondaryPassword, setSecondaryPassword] = useState("");
    const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
    const [tableScrollRef, onTableScrollMouseDown] = useDragScroll<HTMLDivElement>();

    const [resubmitKind, setResubmitKind] = useState<number | null>(null);
    const [resubmitReason, setResubmitReason] = useState("");

    const [isLoadingInitial, setIsLoadingInitial] = useState(isEditMode);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [overlappingEmployeeIds, setOverlappingEmployeeIds] = useState<number[]>([]);

    // Prefill (one item) or narrow (several) the department dropdowns. null = loading, [] = Admin bypass OR unconfigured account.
    const [createScopes, setCreateScopes] = useState<MyCreateScopeItemDto[] | null>(null);

    useEffect(() => {
        DepartmentApi.getAllDepartments().then(setDepartments).catch((err) => console.error(err));
        ReasonApi.getAllReasons().then(setReasons).catch((err) => console.error(err));
        OtCaseApi.getAllOtCases().then(setOtCases).catch((err) => console.error(err));
        ProductionEmployeeApi.getTeamOptions().then(setTeamOptions).catch((err) => console.error(err));
    }, []);

    // Reset Line when Team changes, via render-time snapshot instead of an effect. Skipped when locked, otherwise
    // the auto-prefill of Team/Line/shift group in one render would clear the Line it just set.
    const [prevProductionTeamId, setPrevProductionTeamId] = useState(productionTeamId);
    if (prevProductionTeamId !== productionTeamId) {
        setPrevProductionTeamId(productionTeamId);
        if (!isProductionScopeLocked) {
            setProductionLineId("");
        }
    }

    // Lines are real children of a Team (FK); an empty Team makes BE return all Lines.
    useFetchEffect(
        () => ProductionEmployeeApi.getLineOptions(productionTeamId === "" ? undefined : productionTeamId),
        [productionTeamId],
        setLineOptions,
        t("lineOptionsLoadError")
    );

    // Shift groups aren't FK children of Line/Team, so options are derived from who actually works in the filtered
    // Line/Team. Reset via render-time snapshot, skipped when locked (same reason as the Line reset).
    const shiftTeamFilterKey = `${productionLineId}|${productionTeamId}`;
    const [prevShiftTeamFilterKey, setPrevShiftTeamFilterKey] = useState(shiftTeamFilterKey);
    if (prevShiftTeamFilterKey !== shiftTeamFilterKey) {
        setPrevShiftTeamFilterKey(shiftTeamFilterKey);
        if (!isProductionScopeLocked) {
            setProductionShiftTeamId("");
        }
    }

    useFetchEffect(
        () =>
            ProductionEmployeeApi.getShiftTeamOptions(
                productionLineId === "" ? undefined : productionLineId,
                productionTeamId === "" ? undefined : productionTeamId
            ),
        [productionLineId, productionTeamId],
        setShiftTeamOptions,
        t("shiftTeamOptionsLoadError")
    );

    // Require Team + Line + shift group: partial filters return thousands of rows and make the table lag.
    const canSearchProduction =
        isCoreFormInfoFilled && productionTeamId !== "" && productionLineId !== "" && productionShiftTeamId !== "";
    useFetchEffect(
        () =>
            formMode === "production" && !isEditMode && canSearchProduction
                ? ProductionEmployeeApi.search({
                      productionLineId,
                      teamId: productionTeamId,
                      // canSearchProduction guarantees a number here.
                      shiftTeamId: productionShiftTeamId,
                      keyword: productionKeyword.trim() || undefined,
                      date: date || undefined,
                  })
                : Promise.resolve([]),
        [formMode, isEditMode, canSearchProduction, productionLineId, productionTeamId, productionShiftTeamId, productionKeyword, date],
        setProductionResults,
        t("productionSearchError")
    );

    useEffect(() => {
        OtFormApi.getMyCreateScopes()
            .then((scopes) => {
                setCreateScopes(scopes);
                // Prefill only on create; edit mode already holds the form's real data. Several scopes share one department.
                if (!isEditMode && scopes.length > 0) {
                    setDepartmentId(scopes[0].departmentId);
                    if (scopes.length === 1) setGroupIds([scopes[0].groupId]);
                }
                // Production-only accounts have empty group scopes and would be blocked in group mode; switch them to
                // production without locking the tab.
                if (!isEditMode && scopes.length === 0 && !isUnrestrictedAdmin && canCreateProductionForm) {
                    setFormMode("production");
                }
            })
            .catch((err) => {
                console.error(err);
                setCreateScopes([]); // On error don't block the page; fall back to free dropdowns.
            });
        // Both flags derive from `user`, stable for the page's lifetime.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEditMode]);

    // Same prefill/lock mechanism for the production dropdowns. Only called with CreateProduction, otherwise always 403.
    useEffect(() => {
        if (isEditMode || !canCreateProductionForm) return;
        OtFormApi.getMyProductionCreateScopes()
            .then((scopes) => {
                setProductionCreateScopes(scopes);
                // The department is the caller's own and identical across items, so it is always prefilled and locked.
                if (scopes.length > 0) {
                    setDepartmentId(scopes[0].departmentId);
                }
                if (scopes.length === 1) {
                    setProductionTeamId(scopes[0].teamId);
                    setProductionLineId(scopes[0].productionLineId);
                    setProductionShiftTeamId(scopes[0].shiftTeamId);
                }
            })
            .catch((err) => {
                console.error(err);
                setProductionCreateScopes([]); // On error don't block the page; fall back to free dropdowns.
            });
    }, [isEditMode, canCreateProductionForm]);

    const isScopeRestricted = createScopes !== null && createScopes.length > 0;
    // Lock only on create; edit still allows changing within scope.
    const isScopeLocked = !isEditMode && isScopeRestricted && createScopes!.length === 1;
    const isScopeDepartmentLocked = !isEditMode && isScopeRestricted && new Set(createScopes!.map((s) => s.departmentId)).size === 1;
    // Empty scopes and not Admin → no department to create for; block instead of failing with 400 later.
    // Group mode only: production forms don't need createScopes.
    const isBlockedNoScope =
        !isEditMode && formMode === "group" && createScopes !== null && createScopes.length === 0 && !isUnrestrictedAdmin;

    const visibleDepartments = useMemo(() => {
        if (!isScopeRestricted) return departments.map((d) => ({ id: d.id, label: d.departmentNameVn }));
        const map = new Map<number, string>();
        createScopes!.forEach((s) => map.set(s.departmentId, s.departmentNameVn));
        if (departmentId && !map.has(departmentId)) {
            const existing = departments.find((d) => d.id === departmentId);
            if (existing) map.set(existing.id, existing.departmentNameVn);
        }
        return Array.from(map, ([id, label]) => ({ id, label }));
    }, [isScopeRestricted, createScopes, departments, departmentId]);

    const visibleGroups = useMemo(() => {
        if (!isScopeRestricted) {
            const multipleWorkshops = new Set(groups.map((g) => g.workshopId)).size > 1;
            return groups.map((g) => ({ id: g.id, label: multipleWorkshops ? `${g.groupNameVn} · ${g.workshopNameVn}` : g.groupNameVn }));
        }
        const options = createScopes!
            .filter((s) => !departmentId || s.departmentId === departmentId)
            .map((s) => ({ id: s.groupId, label: s.groupNameVn }));
        for (const id of groupIds) {
            if (options.some((o) => o.id === id)) continue;
            const existing = groups.find((g) => g.id === id);
            if (existing) options.push({ id: existing.id, label: existing.groupNameVn });
        }
        return options;
    }, [isScopeRestricted, createScopes, groups, departmentId, groupIds]);
    const groupLabel = (id: number) => visibleGroups.find((g) => g.id === id)?.label ?? String(id);

    // When restricted, build options from productionCreateScopes instead of the catalog; Line depends on Team,
    // shift group on both, same as the unrestricted dropdowns.
    const visibleTeamOptions = useMemo((): ProductionOptionDto[] => {
        if (!isProductionScopeRestricted) return teamOptions;
        const map = new Map<number, ProductionOptionDto>();
        productionCreateScopes!.forEach((s) => map.set(s.teamId, { id: s.teamId, code: s.teamCode, nameVn: s.teamNameVn }));
        return Array.from(map.values());
    }, [isProductionScopeRestricted, productionCreateScopes, teamOptions]);

    const visibleLineOptions = useMemo((): ProductionOptionDto[] => {
        if (!isProductionScopeRestricted) return lineOptions;
        const map = new Map<number, ProductionOptionDto>();
        productionCreateScopes!
            .filter((s) => productionTeamId === "" || s.teamId === productionTeamId)
            .forEach((s) => map.set(s.productionLineId, { id: s.productionLineId, code: s.lineCode, nameVn: s.lineNameVn }));
        return Array.from(map.values());
    }, [isProductionScopeRestricted, productionCreateScopes, lineOptions, productionTeamId]);

    const visibleShiftTeamOptions = useMemo((): ProductionOptionDto[] => {
        if (!isProductionScopeRestricted) return shiftTeamOptions;
        const map = new Map<number, ProductionOptionDto>();
        productionCreateScopes!
            .filter(
                (s) =>
                    (productionTeamId === "" || s.teamId === productionTeamId) &&
                    (productionLineId === "" || s.productionLineId === productionLineId)
            )
            .forEach((s) => map.set(s.shiftTeamId, { id: s.shiftTeamId, code: s.shiftTeamCode, nameVn: s.shiftTeamNameVn }));
        return Array.from(map.values());
    }, [isProductionScopeRestricted, productionCreateScopes, shiftTeamOptions, productionTeamId, productionLineId]);

    useEffect(() => {
        if (isEditMode) return; // Edits are not re-signed.
        UserSignatureApi.getMySignature()
            .then((data) => setHasSignature(Boolean(data)))
            .catch(() => setHasSignature(false));
    }, [isEditMode]);

    // Unlike the signature, the secondary password applies to both create and edit.
    useEffect(() => {
        SecondaryPasswordApi.getMyStatus()
            .then((data) => setHasSecondaryPassword(data.isRegistered))
            .catch(() => setHasSecondaryPassword(false));
    }, []);

    // Set state directly (not via handlers) so the effects below don't clear the prefilled department/employees.
    useEffect(() => {
        if (!isEditMode || !otFormId) return;
        OtFormApi.getOtFormById(otFormId)
            .then((data) => {
                // Account names differ only in case between login ("YEV\x") and imported data ("yev\x").
                const myUserName = user?.userName.toLowerCase();
                const canResubmit =
                    data.resubmitKind != null &&
                    (data.resubmitUserNames.some((n) => n.toLowerCase() === myUserName) || (data.resubmitKind === 2 && Boolean(user?.roles.includes("Admin"))));
                if (!data.isEditable && !canResubmit) {
                    setLoadError(t("notEditableError"));
                    return;
                }
                setResubmitKind(data.isEditable ? null : data.resubmitKind);
                // Without this, editing a production form would render the group-mode UI.
                setFormMode(data.isProductionForm ? "production" : "group");
                setDepartmentId(data.departmentId);
                setGroupIds(data.groupId ? [data.groupId] : []);
                setReasonId(data.reasonId);
                setLoadedOtCaseId(data.otCaseId);
                setIsFormCreator(data.createdByUserName.toLowerCase() === myUserName);
                setDate(data.date);
                setStartTime(data.startTime.slice(0, 5));
                setEndTime(data.endTime.slice(0, 5));
                setSubReason(data.subReason ?? "");
                // BE only accepts the currently active employees; including removed ones fails with 400.
                const activeEmployees = data.employees.filter((e) => !e.isRemoved);
                setEditEmployees(activeEmployees);
                setSelectedEmployeeIds(activeEmployees.map((e) => e.employeeId));
                setEmployeeOverrides(
                    Object.fromEntries(
                        activeEmployees.map((e) => [
                            e.employeeId,
                            {
                                // "" = follows the form's own time, so changing the form time moves these rows too.
                                startTime: e.startTime === data.startTime ? "" : e.startTime.slice(0, 5),
                                endTime: e.endTime === data.endTime ? "" : e.endTime.slice(0, 5),
                                didEat: e.didEat,
                                noteVn: e.noteVn ?? "",
                                noteJp: e.noteJp ?? "",
                            },
                        ])
                    )
                );
                setProcessParts({ 0: data.processPart ?? emptyProcessPart });
            })
            .catch((err) => {
                console.error(err);
                setLoadError(getApiErrorMessage(err, t("loadEditError")));
            })
            .finally(() => setIsLoadingInitial(false));
        // Reloading on a locale change would discard the edits in progress.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEditMode, otFormId]);

    // Only loads the list; clearing the selection is left to handleDepartmentChange so edit-mode prefill survives.
    const [prevDepartmentId, setPrevDepartmentId] = useState(departmentId);
    if (prevDepartmentId !== departmentId) {
        setPrevDepartmentId(departmentId);
        if (!departmentId) setGroups([]);
    }

    useEffect(() => {
        if (!departmentId) return;
        GroupApi.getGroupsByDepartment(departmentId)
            .then(setGroups)
            .catch((err) => console.error(err));
    }, [departmentId]);

    // Loads only, doesn't clear the selection (same reason as above).
    const [prevGroupIds, setPrevGroupIds] = useState(groupIds);
    if (prevGroupIds !== groupIds) {
        setPrevGroupIds(groupIds);
        if (groupIds.length === 0) setEmployeeGroups([]);
    }

    useEffect(() => {
        // Edit mode takes its list from the form itself.
        if (groupIds.length === 0 || isEditMode) return;
        let isStale = false;
        // Pass the form's date so projected accumulation uses that month/year; changing the date must reload.
        Promise.all(
            groupIds.map((id) => EmployeeApi.getEmployeesByGroup(id, date || undefined).then((employees) => ({ groupId: id, employees })))
        )
            .then((result) => {
                if (!isStale) setEmployeeGroups(result);
            })
            .catch((err) => console.error(err));
        return () => {
            isStale = true;
        };
    }, [groupIds, isEditMode, date]);

    const totalHour = useMemo(() => computeTotalHour(startTime, endTime), [startTime, endTime]);
    const isTimeRangeInvalid = Boolean(startTime && endTime && toMinutes(endTime) <= toMinutes(startTime));

    // Lists every distinct Line/Team/shift group on the form, since people added later may differ from the creator's.
    const editProductionSummary = useMemo(() => {
        if (!isEditMode || formMode !== "production") return null;
        const distinct = (values: (string | null)[]) => Array.from(new Set(values.filter((v): v is string => Boolean(v))));
        return {
            lines: distinct(editEmployees.map((e) => e.blockCodeSnapshot)),
            teams: distinct(editEmployees.map((e) => e.teamCodeSnapshot)),
            shiftTeams: distinct(editEmployees.map((e) => e.shiftTeamCodeSnapshot)),
        };
    }, [isEditMode, formMode, editEmployees]);

    // Tiers from lib/mealTicket.ts on each person's actual hours; milk is never auto-computed.
    const countMealTickets = (employeeIds: number[]) => {
        let main = 0;
        let secondary = 0;
        for (const employeeId of employeeIds) {
            const employeeEndTime = employeeOverrides[employeeId]?.endTime || endTime;
            const didEat = didEatOf(employeeId);
            const employeeStartTime = employeeOverrides[employeeId]?.startTime || startTime;
            const ticketType = computeMealTicketType(employeeStartTime, employeeEndTime, didEat, setting);
            if (ticketType === MEAL_TICKET_MAIN) main += 1;
            else if (ticketType === MEAL_TICKET_SECONDARY) secondary += 1;
        }
        return { main, secondary };
    };

    // Group-mode create: one support block per selected group; otherwise a single block under key 0.
    const supportSections =
        isGroupCreate && groupSections.length > 0
            ? groupSections.map((section) => ({ key: section.groupId, employeeIds: section.selectedIds }))
            : [{ key: 0, employeeIds: selectedEmployeeIds }];

    // Edit mode sends the stored block as-is (BE recalculates the counts after save).
    const getSubmitProcessPart = (key: number, employeeIds: number[]): ProcessPartDto => {
        const part = processParts[key] ?? emptyProcessPart;
        if (isEditMode || manualMealTicketKeys[key]) return { ...part, isEat: true };
        const counts = countMealTickets(employeeIds);
        return { ...part, mainTicketCount: counts.main, secondaryTicketCount: counts.secondary, isEat: true };
    };

    const updateProcessPart = (key: number, patch: Partial<ProcessPartDto>) =>
        setProcessParts((current) => ({ ...current, [key]: { ...(current[key] ?? emptyProcessPart), ...patch } }));

    // Freezes both counts at their current values so editing one doesn't zero the other.
    const overrideMealTicket = (key: number, employeeIds: number[], patch: Partial<ProcessPartDto>) => {
        const counts = countMealTickets(employeeIds);
        if (!manualMealTicketKeys[key]) {
            updateProcessPart(key, { mainTicketCount: counts.main, secondaryTicketCount: counts.secondary, ...patch });
            setManualMealTicketKeys((current) => ({ ...current, [key]: true }));
        } else {
            updateProcessPart(key, patch);
        }
    };

    // setState only inside callbacks, never synchronously in the effect body (react-hooks/set-state-in-effect).
    useEffect(() => {
        const timeout = setTimeout(() => {
            if (!date || !startTime || selectedEmployeeIds.length === 0) {
                setOverlappingEmployeeIds([]);
                return;
            }

            const reqEmployees = selectedEmployeeIds.map(id => ({
                employeeId: id,
                startTime: `${employeeOverrides[id]?.startTime || startTime}:00`,
                endTime: `${employeeOverrides[id]?.endTime || endTime}:00`,
            }));

            OtFormApi.checkOverlap({
                date,
                startTime: `${startTime}:00`,
                employees: reqEmployees,
                excludeFormId: isEditMode ? otFormId : null,
            })
                .then(setOverlappingEmployeeIds)
                .catch(err => console.error("Failed to check overlap", err));
        }, 500);

        return () => clearTimeout(timeout);
    }, [date, startTime, endTime, selectedEmployeeIds, employeeOverrides, isEditMode, otFormId]);

    // Clicks on a row's own controls stay with those controls.
    const isControlClick = (event: React.MouseEvent) =>
        Boolean((event.target as HTMLElement).closest("input, button, select, textarea, a, label"));

    const toggleEmployee = (employeeId: number) => {
        setSelectedEmployeeIds((current) =>
            current.includes(employeeId) ? current.filter((id) => id !== employeeId) : [...current, employeeId]
        );
        setEmployeeOverrides((current) =>
            current[employeeId]
                ? current
                : { ...current, [employeeId]: { startTime: "", endTime: isEditMode ? "" : endTime, didEat: defaultDidEatForNewEmployee, noteVn: "", noteJp: "" } }
        );
    };

    // Affects only the rows visible under the current filter, keeping selections made under other filters.
    const setEmployeesSelected = (employeeIds: number[], selected: boolean) => {
        setSelectedEmployeeIds((current) => {
            if (selected) {
                const toAdd = employeeIds.filter((id) => !current.includes(id));
                return toAdd.length > 0 ? [...current, ...toAdd] : current;
            }
            const idsToRemove = new Set(employeeIds);
            return current.filter((id) => !idsToRemove.has(id));
        });
        if (selected) {
            setEmployeeOverrides((current) => {
                const next = { ...current };
                for (const id of employeeIds) {
                    if (!next[id]) next[id] = { startTime: "", endTime, didEat: defaultDidEatForNewEmployee, noteVn: "", noteJp: "" };
                }
                return next;
            });
        }
    };

    const handleEmployeeOverrideChange = (employeeId: number, field: "startTime" | "endTime" | "noteVn" | "noteJp", value: string) => {
        setEmployeeOverrides((current) => ({
            ...current,
            [employeeId]: {
                startTime: current[employeeId]?.startTime ?? "",
                endTime: current[employeeId]?.endTime ?? endTime,
                didEat: current[employeeId]?.didEat ?? defaultDidEatForNewEmployee,
                noteVn: current[employeeId]?.noteVn ?? "",
                noteJp: current[employeeId]?.noteJp ?? "",
                [field]: value,
            },
        }));
    };

    const setEmployeesDidEat = (employeeIds: number[], didEat: boolean) => {
        setEmployeeOverrides((current) => {
            const next = { ...current };
            for (const id of employeeIds) {
                next[id] = {
                    startTime: current[id]?.startTime ?? "",
                    endTime: current[id]?.endTime ?? endTime,
                    didEat,
                    noteVn: current[id]?.noteVn ?? "",
                    noteJp: current[id]?.noteJp ?? "",
                };
            }
            return next;
        });
    };
    const handleEmployeeDidEatChange = (employeeId: number, didEat: boolean) => setEmployeesDidEat([employeeId], didEat);

    // Bulk toggle covers only the rows that show the checkbox: selected, group allows it, outside the early window.
    const ateLaterBulkIds = selectedEmployeeIds.filter(
        (id) =>
            canEatLater(id) &&
            !isEarlyMealWindowOt(employeeOverrides[id]?.startTime || startTime, employeeOverrides[id]?.endTime || endTime, setting)
    );
    const allAteLater = ateLaterBulkIds.length > 0 && ateLaterBulkIds.every((id) => !didEatOf(id));
    const ateLaterHeader = (
        <th rowSpan={2} className="h-px w-px whitespace-normal p-0 text-center align-bottom leading-tight">
            <label className="flex h-full cursor-pointer flex-col items-center justify-end gap-1 px-2 py-2 has-disabled:cursor-not-allowed">
                {t("colAteLater")}
                <input
                    type="checkbox"
                    checked={allAteLater}
                    onChange={() => setEmployeesDidEat(ateLaterBulkIds, allAteLater)}
                    disabled={isSubmitting || ateLaterBulkIds.length === 0}
                    aria-label={t("ateLaterAllLabel")}
                    className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                />
            </label>
        </th>
    );

    // Candidates for "add employee" while editing. Group forms: the whole Group (small), filtered by the
    // dropdown itself. Production forms: searched on the server by the typed keyword (empty = nothing).
    // The server (UpdateAsync) is what rejects a wrong Line/shift team on save.
    const handleAddQueryChange = (query: string) => {
        if (addSearchTimer.current) clearTimeout(addSearchTimer.current);
        addSearchTimer.current = setTimeout(() => setAddSearchQuery(query.trim()), 300);
    };

    useFetchEffect(
        async () => {
            if (!isEditMode) return [];
            if (formMode === "production") {
                if (!addSearchQuery) return [];
                const results = await ProductionEmployeeApi.search({ keyword: addSearchQuery, date: date || undefined });
                return results.map((item) => ({ employeeId: item.employeeId, employeeCode: item.employeeCode, fullName: item.fullName }));
            }
            if (!groupId) return [];
            const results = await EmployeeApi.getEmployeesByGroup(groupId, date || undefined);
            return results.map((item) => ({ employeeId: item.id, employeeCode: item.code, fullName: `${item.lastName} ${item.firstName}` }));
        },
        [isEditMode, formMode, groupId, date, formMode === "production" ? addSearchQuery : ""],
        setAddSearchResults,
        t("productionSearchError")
    );

    const handlePickAddEmployee = (item: { employeeId: number; employeeCode: string; fullName: string }) => {
        toggleEmployee(item.employeeId);
        setEmployeeAddedMeta((current) => ({ ...current, [item.employeeId]: { employeeCode: item.employeeCode, fullName: item.fullName } }));
        setAddSearchResults((current) => current.filter((r) => r.employeeId !== item.employeeId));
    };

    // Never saved to the form, so no reason is needed.
    const cancelAddedEmployee = (employeeId: number) => {
        setSelectedEmployeeIds((current) => current.filter((id) => id !== employeeId));
        setEmployeeAddedMeta((current) => {
            const next = { ...current };
            delete next[employeeId];
            return next;
        });
    };

    // A reason is required (the form is an official record); staged until save (UpdateOtFormDto.removedEmployees).
    const openRemoveEmployee = (employee: OtFormEmployeeDto) => {
        if (isFormCreator) {
            setPendingRemovals((current) => ({ ...current, [employee.employeeId]: "" }));
            setSelectedEmployeeIds((current) => current.filter((id) => id !== employee.employeeId));
            return;
        }
        setRemoveReasonInput("");
        setRemoveTarget({ employeeId: employee.employeeId, employeeCode: employee.employeeCode, fullName: employee.fullName });
    };

    const closeRemoveEmployee = () => setRemoveTarget(null);

    const confirmRemoveEmployee = () => {
        if (!removeTarget) return;
        if (!removeReasonInput.trim()) {
            toast.error(t("removeReasonRequiredError"));
            return;
        }
        setPendingRemovals((current) => ({ ...current, [removeTarget.employeeId]: removeReasonInput.trim() }));
        setSelectedEmployeeIds((current) => current.filter((id) => id !== removeTarget.employeeId));
        setRemoveTarget(null);
    };

    const undoRemoveEmployee = (employeeId: number) => {
        setPendingRemovals((current) => {
            const next = { ...current };
            delete next[employeeId];
            return next;
        });
        setSelectedEmployeeIds((current) => (current.includes(employeeId) ? current : [...current, employeeId]));
    };

    const handleDepartmentChange = (nextId: number | "") => {
        setDepartmentId(nextId === "" ? null : nextId);
        setGroupIds([]);
        setSelectedEmployeeIds([]);
        setEmployeeOverrides({});
    };

    // Keeps the selection of groups that stay; drops people of the removed ones.
    const handleGroupIdsChange = (nextIds: number[]) => {
        const removedEmployeeIds = new Set(
            employeeGroups.filter((g) => !nextIds.includes(g.groupId)).flatMap((g) => g.employees.map((e) => e.id))
        );
        setGroupIds(nextIds);
        setSelectedEmployeeIds((current) => current.filter((id) => !removedEmployeeIds.has(id)));
    };

    const handleModeChange = (nextMode: "group" | "production") => {
        setFormMode(nextMode);
        setGroupIds([]);
        setSelectedEmployeeIds([]);
        setEmployeeOverrides({});
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        // Edit mode locks the other fields, so only require at least one person. groupId is required in group mode only.
        if (
            (!isEditMode || isOfficeEdit) &&
            ((formMode === "group" && groupIds.length === 0) || !departmentId || !reasonId || !otCaseId || !date || !startTime || !endTime)
        ) {
            toast.error(t("requiredFieldsError"));
            return;
        }
        if (selectedEmployeeIds.length === 0) {
            toast.error(t("requiredFieldsError"));
            return;
        }
        const emptyGroup = groupSections.find((section) => section.selectedIds.length === 0);
        if (emptyGroup) {
            toast.error(t("groupNoEmployeeError", { group: groupLabel(emptyGroup.groupId) }));
            return;
        }
        if ((!isEditMode || isOfficeEdit) && isTimeRangeInvalid) {
            toast.error(t("endTimeBeforeStartError"));
            return;
        }
        if (hasSecondaryPassword === false) {
            toast.error(t("secondaryPasswordMissingError"));
            return;
        }
        if (resubmitKind != null && !resubmitReason.trim()) {
            toast.error(t("resubmitReasonRequiredError"));
            return;
        }

        // No overnight shifts: each person's end time lies within the form's time range on the same day.
        const orderStartMinutes = toMinutes(`${startTime}:00`);
        const orderEndMinutes = toMinutes(`${endTime}:00`);
        for (const employeeId of selectedEmployeeIds) {
            const employeeStartMinutes = toMinutes(`${employeeOverrides[employeeId]?.startTime || startTime}:00`);
            const employeeEndTime = employeeOverrides[employeeId]?.endTime || endTime;
            const employeeEndMinutes = toMinutes(`${employeeEndTime}:00`);
            if (
                employeeStartMinutes < orderStartMinutes ||
                employeeEndMinutes <= employeeStartMinutes ||
                employeeEndMinutes > orderEndMinutes
            ) {
                const code = isEditMode
                    ? (editEmployees.find((e) => e.employeeId === employeeId)?.employeeCode ??
                      employeeAddedMeta[employeeId]?.employeeCode)
                    : groupEmployees.find((e) => e.id === employeeId)?.code;
                toast.error(t("employeeEndTimeError", { code: code ?? String(employeeId) }));
                return;
            }
        }

        // The secondary password is entered in the popup; performSubmit runs on confirm.
        setSecondaryPassword("");
        setIsPasswordDialogOpen(true);
    };

    const performSubmit = async () => {
        if (!secondaryPassword) {
            toast.error(t("secondaryPasswordRequiredError"));
            return;
        }
        setIsSubmitting(true);
        const toEmployeeInput = (employeeId: number): OtFormEmployeeInputDto => ({
            employeeId,
            startTime: `${employeeOverrides[employeeId]?.startTime || startTime}:00`,
            endTime: `${employeeOverrides[employeeId]?.endTime || endTime}:00`,
            didEat: didEatOf(employeeId),
            noteVn: employeeOverrides[employeeId]?.noteVn?.trim() ? employeeOverrides[employeeId].noteVn.trim() : null,
            noteJp: employeeOverrides[employeeId]?.noteJp?.trim() ? employeeOverrides[employeeId].noteJp.trim() : null,
        });
        const buildCreateDto = (employeeIds: number[], processPartKey: number, formGroupId: number | null): CreateOtFormDto => ({
            groupId: formGroupId,
            isProductionForm: formGroupId === null,
            departmentId: departmentId!,
            reasonId: reasonId!,
            otCaseId: otCases.find((c) => c.code === otCaseCodeFor(employeeIds))?.id ?? otCaseId!,
            startTime: `${startTime}:00`,
            endTime: `${endTime}:00`,
            subReason: subReason.trim() || null,
            totalHour,
            date,
            employees: employeeIds.map(toEmployeeInput),
            processPart: getSubmitProcessPart(processPartKey, employeeIds),
            secondaryPassword,
        });
        try {
            let result;
            if (isEditMode && otFormId) {
                // selectedEmployeeIds already reflects staged adds/removals; removedEmployees carries the required reasons.
                const removedEmployees = Object.entries(pendingRemovals).map(([employeeId, reason]) => ({
                    employeeId: Number(employeeId),
                    reason,
                }));
                result = await OtFormApi.updateOtForm(otFormId, {
                    header: isOfficeEdit
                        ? {
                              date,
                              startTime: `${startTime}:00`,
                              endTime: `${endTime}:00`,
                              reasonId: reasonId!,
                              subReason: subReason.trim() || null,
                              processPart: getSubmitProcessPart(0, selectedEmployeeIds),
                          }
                        : null,
                    employees: selectedEmployeeIds.map(toEmployeeInput),
                    removedEmployees,
                    secondaryPassword,
                    resubmitReason: resubmitKind != null ? resubmitReason.trim() : null,
                });
            } else if (formMode === "group") {
                const created = await OtFormApi.createOtForms({
                    secondaryPassword,
                    forms: groupSections.map((section) => buildCreateDto(section.selectedIds, section.groupId, section.groupId)),
                });
                if (created.length !== 1) {
                    toast.success(t("createManySuccess", { count: created.length }));
                    router.push("/ot/list");
                    return;
                }
                result = created[0];
            } else {
                result = await OtFormApi.createOtForm(buildCreateDto(selectedEmployeeIds, 0, null));
            }
            toast.success(isEditMode ? t("updateSuccess") : t("createSuccess"));
            router.push({ pathname: "/ot/forms", query: { id: String(result.id) } });
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, isEditMode ? t("updateError") : t("createError")));
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoadingInitial) {
        return <div className="py-16 text-center text-sm text-[#5e3f3a]">{tCommon("loading")}</div>;
    }

    if (loadError) {
        return <div className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{loadError}</div>;
    }

    if (isBlockedNoScope) {
        // Keep the header and mode tabs instead of returning early, so users with both permissions can still switch to production.
        return (
            <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h1 className="text-xl font-semibold text-[#191c1e]">{t("titleCreate")}</h1>
                    {canCreateProductionForm && canUseGroupMode && (
                        <div className="inline-flex gap-1 rounded-lg border border-[#e0e3e5] bg-[#f8fafc] p-1">
                            {(["group", "production"] as const).map((mode) => (
                                <button
                                    key={mode}
                                    type="button"
                                    onClick={() => handleModeChange(mode)}
                                    className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                                        formMode === mode
                                            ? "bg-white text-[#e3000f] shadow-sm"
                                            : "text-[#5e3f3a] hover:text-[#191c1e]"
                                    }`}
                                >
                                    {mode === "group" ? t("modeGroupLabel") : t("modeProductionLabel")}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <div className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">
                    {t("blockedNoScopeMessage")}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-xl font-semibold text-[#191c1e]">{isEditMode ? t("titleEdit", { id: otFormId }) : t("titleCreate")}</h1>
                {!isEditMode && canCreateProductionForm && canUseGroupMode && (
                    <div className="inline-flex gap-1 rounded-lg border border-[#e0e3e5] bg-[#f8fafc] p-1">
                        {(["group", "production"] as const).map((mode) => (
                            <button
                                key={mode}
                                type="button"
                                onClick={() => handleModeChange(mode)}
                                className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                                    formMode === mode
                                        ? "bg-white text-[#e3000f] shadow-sm"
                                        : "text-[#5e3f3a] hover:text-[#191c1e]"
                                }`}
                            >
                                {mode === "group" ? t("modeGroupLabel") : t("modeProductionLabel")}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Same rule: a single combo is already prefilled and locked; several need the banner. */}
            {!isEditMode && formMode === "production" && isProductionScopeRestricted && !isProductionScopeLocked && (
                <div className="rounded-lg border border-[#e0e3e5] bg-[#f8fafc] px-4 py-3 text-sm text-[#5e3f3a]">
                    {t("productionScopeRestrictedMessage", {
                        combos: productionCreateScopes!
                            .map((s) => `${s.teamNameVn || s.teamCode} / ${s.lineCode} / ${s.shiftTeamNameVn || s.shiftTeamCode}`)
                            .join(", "),
                    })}
                </div>
            )}

            {!isEditMode && hasSignature === false && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#f5d0a9] bg-[#fff4e5] px-4 py-3 text-sm text-[#9a5b00]">
                    <span>{t("noSignatureMessage")}</span>
                    <button
                        type="button"
                        onClick={() => router.push("/ot/signature")}
                        className="cursor-pointer rounded-lg border border-[#9a5b00] px-3 py-1.5 text-xs font-semibold text-[#9a5b00] transition hover:bg-[#fff0d8]"
                    >
                        {t("registerSignatureButton")}
                    </button>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid items-start gap-4 lg:min-h-[34rem] lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] lg:items-stretch">
                <section className="space-y-3.5 rounded-xl border border-[#e0e3e5] bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">{t("formInfoTitle")}</h2>

                    </div>
                    <div className="grid gap-x-3 gap-y-3 sm:grid-cols-2">
                        <label className="block">
                            <span className={fieldLabelClassName}>{t("fieldDepartment")}<RequiredMark /></span>
                            <SearchableSelect
                                options={visibleDepartments.map((d) => ({ value: d.id, label: d.label, searchText: d.label.toLowerCase() }))}
                                value={departmentId ?? ""}
                                onChange={handleDepartmentChange}
                                placeholder={t("fieldDepartmentPlaceholder")}
                                // Production mode locks as soon as any scope exists: the Line Leader's department is known from one combo.
                                disabled={isSubmitting || isEditMode || (formMode === "group" ? isScopeDepartmentLocked : isProductionScopeRestricted)}
                            />
                        </label>

                        {formMode === "group" && (
                            <label className="block">
                                <span className={fieldLabelClassName}>{t("fieldGroup")}<RequiredMark /></span>
                                {isEditMode || isScopeLocked ? (
                                    <SearchableSelect
                                        options={visibleGroups.map((g) => ({ value: g.id, label: g.label, searchText: g.label.toLowerCase() }))}
                                        value={groupId ?? ""}
                                        onChange={() => {}}
                                        placeholder={t("fieldGroupPlaceholder")}
                                        disabled
                                    />
                                ) : (
                                    <MultiSelect
                                        options={visibleGroups.map((g) => ({ value: g.id, label: g.label, searchText: g.label.toLowerCase() }))}
                                        values={groupIds}
                                        onChange={handleGroupIdsChange}
                                        placeholder={departmentId ? t("fieldGroupPlaceholder") : t("fieldGroupPlaceholderNeedDepartment")}
                                        disabled={isSubmitting || !departmentId}
                                    />
                                )}
                            </label>
                        )}

                        {editProductionSummary && (
                            <>
                                <label className="block">
                                    <span className={fieldLabelClassName}>{t("colBlockCode")}</span>
                                    <input value={editProductionSummary.lines.join(", ") || "—"} disabled className={fieldClassName} />
                                </label>
                                <label className="block">
                                    <span className={fieldLabelClassName}>{t("colTeamCode")}</span>
                                    <input value={editProductionSummary.teams.join(", ") || "—"} disabled className={fieldClassName} />
                                </label>
                                <label className="block">
                                    <span className={fieldLabelClassName}>{t("colShiftTeam")}</span>
                                    <input value={editProductionSummary.shiftTeams.join(", ") || "—"} disabled className={fieldClassName} />
                                </label>
                            </>
                        )}

                        <div className="sm:col-span-2">
                            <div className="flex flex-wrap items-end gap-3">
                                <label className="block">
                                    <span className={fieldLabelClassName}>{t("fieldDate")}<RequiredMark /></span>
                                    <input
                                        type="date"
                                        value={date}
                                        onChange={(event) => setDate(event.target.value)}
                                        disabled={isSubmitting || isHeaderLocked}
                                        required
                                        min={isEditMode ? undefined : getTodayStr(-setting.backdateDays)}
                                        className={fieldClassName.replace("w-full", "w-40")}
                                    />
                                </label>
                                <div className="flex items-end gap-3">
                                    <label className="block">
                                        <span className={fieldLabelClassName}>{t("fieldStartTime")}<RequiredMark /></span>
                                        <TimePicker24h value={startTime} onChange={setStartTime} disabled={isSubmitting || isHeaderLocked} />
                                    </label>
                                    <label className="block">
                                        <span className={fieldLabelClassName}>{t("fieldEndTime")}<RequiredMark /></span>
                                        <TimePicker24h value={endTime} onChange={setEndTime} disabled={isSubmitting || isHeaderLocked} />
                                    </label>
                                    {/* Form hours are only the outer frame; the daily limit is warned per employee row. */}
                                    <span className="flex h-9 items-center" title={t("fieldTotalHour")}>
                                        <span className="rounded-full border border-[#e0e3e5] bg-[#f8fafc] px-2 py-0.5 text-xs font-semibold tabular-nums text-[#5e3f3a]">
                                            {totalHour}h
                                        </span>
                                    </span>
                                </div>
                            </div>
                            {isTimeRangeInvalid && (
                                <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-[#930006]">
                                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                    {t("endTimeBeforeStartError")}
                                </p>
                            )}
                        </div>

                        <label className="block sm:col-span-2">
                            <span className={fieldLabelClassName}>{t("fieldReason")}<RequiredMark /></span>
                            <SearchableSelect
                                options={reasons.map((r) => ({ value: r.id, label: r.reasonNameVn, searchText: r.reasonNameVn.toLowerCase() }))}
                                value={reasonId ?? ""}
                                onChange={(v) => setReasonId(v === "" ? null : v)}
                                placeholder={t("fieldReasonPlaceholder")}
                                disabled={isSubmitting || isHeaderLocked}
                            />
                        </label>

                        {/* With several groups each group header shows its own case. */}
                        {!isMultiGroup && (
                        <label className="block sm:col-span-2">
                            <span className={`${fieldLabelClassName.replace("block", "flex")} items-center gap-1`}>
                                {t("fieldOtCase")}<RequiredMark />
                                {!isEditMode && otCaseCode && (
                                    <InfoTooltip
                                        text={t(exceedsTh3 ? "otCaseAutoHintTh3" : isNonWorkingDay ? "otCaseAutoHintNonWorking" : "otCaseAutoHintWorking")}
                                    />
                                )}
                                {isOfficeEdit && <InfoTooltip text={t("otCaseAutoHintEdit")} />}
                            </span>
                            <SearchableSelect
                                options={otCases.map((otCase) => ({
                                    value: otCase.id,
                                    label: otCase.description ? `${otCase.code}: ${otCase.description}` : otCase.code,
                                    searchText: `${otCase.code} ${otCase.description ?? ""}`.toLowerCase(),
                                }))}
                                value={otCaseId ?? ""}
                                onChange={() => {}}
                                placeholder={t("fieldOtCasePlaceholder")}
                                disabled
                            />
                        </label>
                        )}

                        
                    </div>

                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldSubReason")}</span>
                        <textarea
                            value={subReason}
                            onChange={(event) => setSubReason(event.target.value)}
                            disabled={isSubmitting || isHeaderLocked}
                            rows={2}
                            className="w-full resize-none rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
                        />
                    </label>

                    <div className="space-y-2.5 border-t border-[#e0e3e5] pt-3">
                    {/* Always shown: meals are mandatory, only shuttle/photo room are optional. */}
                    <span className="block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                        {t("otherSupportLabel")}
                    </span>

                    {supportSections.map((section) => {
                        const part = processParts[section.key] ?? emptyProcessPart;
                        const isManual = Boolean(manualMealTicketKeys[section.key]);
                        const counts = countMealTickets(section.employeeIds);
                        return (
                    <div key={section.key} className="space-y-2.5">
                        {isMultiGroup && <span className="block text-sm font-semibold text-[#191c1e]">{groupLabel(section.key)}</span>}
                        <div className="flex flex-nowrap gap-1.5">
                            <ToggleOptionCard
                                icon={<Car size={13} />}
                                label={t("transportationLabel")}
                                checked={part.isTransportation}
                                onChange={(value) => updateProcessPart(section.key, { isTransportation: value })}
                                disabled={isSubmitting || isHeaderLocked}
                            />
                            <ToggleOptionCard
                                icon={<Printer size={13} />}
                                label={t("copyRoomLabel")}
                                checked={part.isUseCopyRoom}
                                onChange={(value) => updateProcessPart(section.key, { isUseCopyRoom: value })}
                                disabled={isSubmitting || isHeaderLocked}
                            />
                        </div>

                        <div className="space-y-1.5">
                            {/* Counts are auto-filled from each person's OT hours; once overridden, "Recalculate" restores them. */}
                            <div className="flex items-center justify-between gap-2 text-xs">
                                <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">{t("mealTicketCountsTitle")}</span>
                                {!isEditMode &&
                                    (!isManual ? (
                                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-700">
                                            <Check className="h-3 w-3" /> {t("mealTicketAutoBadge")}
                                        </span>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => setManualMealTicketKeys((current) => ({ ...current, [section.key]: false }))}
                                            disabled={isSubmitting}
                                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-2.5 py-1 font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <RefreshCw className="h-3.5 w-3.5" /> {t("mealTicketRecalcButton")}
                                        </button>
                                    ))}
                            </div>

                            <div className="flex flex-wrap items-end gap-x-4 gap-y-2.5">
                            <label className="block">
                                <span className={fieldLabelClassName}>{t("mainTicketLabel")}</span>
                                <input
                                    type="number"
                                    min={0}
                                    // Edit mode never overrides (BE recalculates after save), so it shows the live computed value.
                                    value={isManual ? part.mainTicketCount : counts.main}
                                    onChange={(event) =>
                                        overrideMealTicket(section.key, section.employeeIds, { mainTicketCount: Number(event.target.value) })
                                    }
                                    disabled={isSubmitting || isEditMode}
                                    className={`${compactFieldClassName.replace("w-full", "w-20")} text-center`}
                                />
                            </label>
                            <label className="block">
                                <span className={fieldLabelClassName}>{t("secondaryTicketLabel")}</span>
                                <input
                                    type="number"
                                    min={0}
                                    value={isManual ? part.secondaryTicketCount : counts.secondary}
                                    onChange={(event) =>
                                        overrideMealTicket(section.key, section.employeeIds, { secondaryTicketCount: Number(event.target.value) })
                                    }
                                    disabled={isSubmitting || isEditMode}
                                    className={`${compactFieldClassName.replace("w-full", "w-20")} text-center`}
                                />
                            </label>
                            <label className="block">
                                <span className={fieldLabelClassName}>{t("milkLabel")}</span>
                                <input
                                    type="number"
                                    min={0}
                                    value={part.milkCount}
                                    onChange={(event) => updateProcessPart(section.key, { milkCount: Number(event.target.value) })}
                                    disabled={isSubmitting || isHeaderLocked}
                                    className={`${compactFieldClassName.replace("w-full", "w-20")} text-center`}
                                />
                            </label>
                            </div>
                        </div>

                        <label className="block">
                            <span className={fieldLabelClassName}>{t("anotherSuggestionVnLabel")}</span>
                            <input
                                value={part.anotherSuggestionVn ?? ""}
                                onChange={(event) => updateProcessPart(section.key, { anotherSuggestionVn: event.target.value })}
                                disabled={isSubmitting || isHeaderLocked}
                                className={compactFieldClassName}
                            />
                        </label>
                    </div>
                        );
                    })}
                    </div>
                </section>

                <section className="flex flex-col gap-4 rounded-xl border border-[#e0e3e5] bg-white p-5 shadow-sm lg:h-0 lg:min-h-full">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                            {t("employeeListTitle")}
                        </h2>
                        <div className={`flex flex-wrap items-center justify-end gap-2 ${isEditMode || isGroupCreate ? "w-full sm:w-auto" : ""}`}>
                            {isGroupCreate && groupEmployees.length > 0 && (
                                <input
                                    value={employeeQuery}
                                    onChange={(event) => setEmployeeQuery(event.target.value)}
                                    placeholder={t("employeeSearchPlaceholder")}
                                    aria-label={t("employeeSearchPlaceholder")}
                                    className="h-8 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-xs text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] sm:w-56"
                                />
                            )}
                            {isEditMode && (
                                <div className="w-full sm:w-64">
                                    <SearchableSelect
                                        options={addSearchResults
                                            .filter((item) => !selectedEmployeeIds.includes(item.employeeId))
                                            .map((item) => ({
                                                value: item.employeeId,
                                                label: `${item.fullName} (${item.employeeCode})`,
                                                searchText: `${item.employeeCode} ${item.fullName}`.toLowerCase(),
                                            }))}
                                        value=""
                                        onChange={(employeeId) => {
                                            const item = addSearchResults.find((r) => r.employeeId === employeeId);
                                            if (item) handlePickAddEmployee(item);
                                        }}
                                        onQueryChange={handleAddQueryChange}
                                        placeholder={t("addEmployeeSectionTitle")}
                                        disabled={isSubmitting}
                                        triggerClassName="h-8 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 pr-8 text-xs! text-[#191c1e] outline-none transition focus:border-[#e3000f]"
                                    />
                                </div>
                            )}
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e0e3e5] bg-[#f8fafc] px-3 py-1 text-xs font-medium text-[#5e3f3a]">
                                <Users className="h-3.5 w-3.5" />
                                {t("selectedCount", { count: selectedEmployeeIds.length })}
                            </span>
                        </div>
                    </div>
                    {isEditMode ? (
                        // editEmployees stays the original list; adds/removals are staged and applied in one save (one secondary password).
                        <div className="space-y-4 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
                        <div
                            ref={tableScrollRef}
                            onMouseDown={onTableScrollMouseDown}
                            className="-mx-5 max-h-[70vh] cursor-grab overflow-auto border-y lg:max-h-none lg:min-h-0 lg:flex-1 border-[#e0e3e5]"
                        >
                            <table className={tableClassName}>
                                <thead className="sticky top-0 z-10 bg-white">
                                    <tr className="whitespace-nowrap text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                        <th rowSpan={2} className="px-3 py-2 align-bottom">{t("colEmployeeCode")}</th>
                                        <th rowSpan={2} className="px-3 py-2 align-bottom">{t("colFullName")}</th>
                                        {formMode === "production" && (
                                            <>
                                                <th rowSpan={2} className="px-3 py-2 align-bottom">{t("colBlockCode")}</th>
                                                <th rowSpan={2} className="px-3 py-2 align-bottom">{t("colTeamCode")}</th>
                                                <th rowSpan={2} className="px-3 py-2 align-bottom">{t("colShiftTeam")}</th>
                                            </>
                                        )}
                                        <th colSpan={2} className="border-b border-[#e0e3e5] px-3 py-2 text-center">{t("colAccumulation")}</th>
                                        <th rowSpan={2} className="px-3 py-2 align-bottom">{t("colStartTime")}</th>
                                        <th rowSpan={2} className="px-3 py-2 align-bottom">{t("colEndTime")}</th>
                                        {/* Production forms: meals mandatory, nothing to choose. Office forms show it inverted as "eat later". */}
                                        {showAteLaterColumn && ateLaterHeader}
                                        <th rowSpan={2} className="px-3 py-2 align-bottom">{t("colMealTicketType")}</th>
                                        <th rowSpan={2} className="px-3 py-2 align-bottom">{t("colNote")}</th>
                                        <th rowSpan={2} className="sticky right-0 z-10 bg-white px-2 py-2" />
                                    </tr>
                                    <tr className="whitespace-nowrap border-b border-[#e0e3e5] text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                        <th className="px-3 py-2 text-center">{t("colMonth")}</th>
                                        <th className="px-3 py-2 text-center">{t("colYear")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {editEmployees.map((employee) => {
                                        const removalReason = pendingRemovals[employee.employeeId];
                                        if (removalReason !== undefined) {
                                            return (
                                                <tr key={employee.employeeId} className="border-b border-[#f1f5f9] bg-[#fff4f2] opacity-70">
                                                    <td className="whitespace-nowrap px-3 py-2 align-top text-sm font-semibold text-[#191c1e] line-through">
                                                        {employee.employeeCode}
                                                    </td>
                                                    <td
                                                        className="px-3 py-2 align-top text-sm text-[#930006]"
                                                        colSpan={formMode === "production" ? 10 : showAteLaterColumn ? 8 : 7}
                                                    >
                                                        <span className="line-through">{employee.fullName}</span> —{" "}
                                                        {removalReason ? t("willBeRemovedNote", { reason: removalReason }) : t("willBeRemovedNoteNoReason")}
                                                    </td>
                                                    <td className={stickyActionCellClassName}>
                                                        <button
                                                            type="button"
                                                            onClick={() => undoRemoveEmployee(employee.employeeId)}
                                                            title={t("undoRemoveButton")}
                                                            aria-label={t("undoRemoveButton")}
                                                            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#e0e3e5] bg-white text-[#5e3f3a] hover:bg-[#f2f4f6] transition disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            <Undo2 className="h-4 w-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        }
                                        // No daily data here (monthToDate/yearToDate are actuals, not projections), so warn month/year only.
                                        const currentStartTime = employeeOverrides[employee.employeeId]?.startTime || startTime;
                                        const currentEndTime = employeeOverrides[employee.employeeId]?.endTime || endTime;
                                        const currentDidEat = didEatOf(employee.employeeId);
                                        const currentAteLater = !currentDidEat;
                                        const earlyWindow = isEarlyMealWindowOt(currentStartTime, currentEndTime, setting);
                                        const mealTicketType = computeMealTicketType(currentStartTime, currentEndTime, currentDidEat, setting);
                                        return (
                                            <tr key={employee.employeeId} className="border-b border-[#f1f5f9] bg-white even:bg-[#f8fafc]">
                                                <td className="whitespace-nowrap px-3 py-2 align-top text-sm font-semibold text-[#191c1e]">
                                                    {employee.employeeCode}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-2 align-top text-sm text-[#191c1e]">{employee.fullName}</td>
                                                {formMode === "production" && (
                                                    <>
                                                        <td className="whitespace-nowrap px-3 py-2 align-top text-sm text-[#5e3f3a]">
                                                            {employee.blockCodeSnapshot || "—"}
                                                        </td>
                                                        <td className="whitespace-nowrap px-3 py-2 align-top text-sm text-[#5e3f3a]">
                                                            {employee.teamCodeSnapshot || "—"}
                                                        </td>
                                                        <td className="whitespace-nowrap px-3 py-2 align-top text-sm text-[#5e3f3a]">
                                                            {employee.shiftTeamCodeSnapshot || "—"}
                                                        </td>
                                                    </>
                                                )}
                                                <AccumulationCell t={t} code={employee.employeeCode} kind="Monthly" hours={employee.monthToDate} limit={employee.customMonthlyOtHourLimit ?? setting.monthlyOtHourLimit} />
                                                <AccumulationCell t={t} code={employee.employeeCode} kind="Yearly" hours={employee.yearToDate} limit={employee.customYearlyOtHourLimit ?? setting.yearlyOtHourLimit} />
                                                <td className="px-3 py-2 align-top">
                                                    <TimePicker24h compact
                                                        value={currentStartTime}
                                                        onChange={(value) => handleEmployeeOverrideChange(employee.employeeId, "startTime", value)}
                                                        disabled={isSubmitting}
                                                    />
                                                </td>
                                                <td className="relative px-3 py-2 align-top">
                                                    <TimePicker24h compact
                                                        value={currentEndTime}
                                                        onChange={(value) => handleEmployeeOverrideChange(employee.employeeId, "endTime", value)}
                                                        disabled={isSubmitting}
                                                    />
                                                </td>
                                                {showAteLaterColumn && (
                                                    <td className="h-px p-0 align-top">
                                                        {earlyWindow || !canEatLater(employee.employeeId) ? null : (
                                                            <label className="flex h-full cursor-pointer justify-center px-3 py-2 has-disabled:cursor-not-allowed">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={currentAteLater}
                                                                    onChange={(event) =>
                                                                        handleEmployeeDidEatChange(employee.employeeId, !event.target.checked)
                                                                    }
                                                                    disabled={isSubmitting}
                                                                    aria-label={t("ateLaterLabel")}
                                                                    className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                                                                />
                                                            </label>
                                                        )}
                                                    </td>
                                                )}
                                                <td className="px-3 py-2 align-top">
                                                    {mealTicketType !== MEAL_TICKET_NONE && <MealTicketTypeBadge type={mealTicketType} t={t} />}
                                                </td>
                                                <td className="px-3 py-2 align-top">
                                                    <input
                                                        value={employeeOverrides[employee.employeeId]?.noteVn ?? ""}
                                                        onChange={(event) =>
                                                            handleEmployeeOverrideChange(employee.employeeId, "noteVn", event.target.value)
                                                        }
                                                        placeholder={t("notePlaceholder")}
                                                        disabled={isSubmitting}
                                                        className="h-9 w-full rounded-lg border border-[#e0e3e5] bg-white px-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
                                                    />
                                                </td>
                                                <td className={stickyActionCellClassName}>
                                                    {selectedEmployeeIds.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => openRemoveEmployee(employee)}
                                                            disabled={isSubmitting}
                                                            title={t("removeEmployeeButton")}
                                                            aria-label={t("removeEmployeeButton")}
                                                            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#e9bcb6] bg-white text-[#930006] hover:bg-[#fff4f2] transition disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            <UserMinus className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {selectedEmployeeIds
                                        .filter((employeeId) => !editEmployees.some((e) => e.employeeId === employeeId))
                                        .map((employeeId) => {
                                            const meta = employeeAddedMeta[employeeId];
                                            if (!meta) return null;
                                            const currentStartTime = employeeOverrides[employeeId]?.startTime || startTime;
                                            const currentEndTime = employeeOverrides[employeeId]?.endTime || endTime;
                                            const currentDidEat = didEatOf(employeeId);
                                            const currentAteLater = !currentDidEat;
                                            const earlyWindow = isEarlyMealWindowOt(currentStartTime, currentEndTime, setting);
                                            const mealTicketType = computeMealTicketType(currentStartTime, currentEndTime, currentDidEat, setting);
                                            return (
                                                <tr key={employeeId} className="border-b border-[#f1f5f9] bg-emerald-50">
                                                    <td className="whitespace-nowrap px-3 py-2 align-top text-sm font-semibold text-[#191c1e]">{meta.employeeCode}</td>
                                                    <td className="whitespace-nowrap px-3 py-2 align-top text-sm text-[#191c1e]">
                                                        {meta.fullName}{" "}
                                                        <span className="ml-1 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                                                            {t("newlyAddedBadge")}
                                                        </span>
                                                    </td>
                                                    {formMode === "production" && (
                                                        <>
                                                            <td className="px-3 py-2 align-top text-sm text-[#8a8f94]">—</td>
                                                            <td className="px-3 py-2 align-top text-sm text-[#8a8f94]">—</td>
                                                            <td className="px-3 py-2 align-top text-sm text-[#8a8f94]">—</td>
                                                        </>
                                                    )}
                                                    <td className="px-3 py-2 text-center align-top text-sm text-[#8a8f94]">—</td>
                                                    <td className="px-3 py-2 text-center align-top text-sm text-[#8a8f94]">—</td>
                                                    <td className="px-3 py-2 align-top">
                                                        <TimePicker24h compact
                                                            value={currentStartTime}
                                                            onChange={(value) => handleEmployeeOverrideChange(employeeId, "startTime", value)}
                                                            disabled={isSubmitting}
                                                        />
                                                    </td>
                                                    <td className="relative px-3 py-2 align-top">
                                                        <TimePicker24h compact
                                                            value={currentEndTime}
                                                            onChange={(value) => handleEmployeeOverrideChange(employeeId, "endTime", value)}
                                                            disabled={isSubmitting}
                                                        />
                                                    </td>
                                                    {showAteLaterColumn && (
                                                        <td className="h-px p-0 align-top">
                                                            {earlyWindow || !canEatLater(employeeId) ? null : (
                                                                <label className="flex h-full cursor-pointer justify-center px-3 py-2 has-disabled:cursor-not-allowed">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={currentAteLater}
                                                                        onChange={(event) => handleEmployeeDidEatChange(employeeId, !event.target.checked)}
                                                                        disabled={isSubmitting}
                                                                        aria-label={t("ateLaterLabel")}
                                                                        className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                                                                    />
                                                                </label>
                                                            )}
                                                        </td>
                                                    )}
                                                    <td className="px-3 py-2 align-top">
                                                        {mealTicketType !== MEAL_TICKET_NONE && <MealTicketTypeBadge type={mealTicketType} t={t} />}
                                                    </td>
                                                    <td className="px-3 py-2 align-top">
                                                        <input
                                                            value={employeeOverrides[employeeId]?.noteVn ?? ""}
                                                            onChange={(event) => handleEmployeeOverrideChange(employeeId, "noteVn", event.target.value)}
                                                            placeholder={t("notePlaceholder")}
                                                            disabled={isSubmitting}
                                                            className="h-9 w-full rounded-lg border border-[#e0e3e5] bg-white px-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
                                                        />
                                                    </td>
                                                    <td className={stickyActionCellClassName}>
                                                        <button
                                                            type="button"
                                                            onClick={() => cancelAddedEmployee(employeeId)}
                                                            disabled={isSubmitting}
                                                            title={t("cancelAddButton")}
                                                            aria-label={t("cancelAddButton")}
                                                            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#e0e3e5] bg-white text-[#5e3f3a] hover:bg-[#f2f4f6] transition disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>

                        {removeTarget && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto py-8">
                                <div className="fixed inset-0 bg-black/40" onClick={closeRemoveEmployee} />
                                <div role="dialog" aria-modal="true" className="z-60 mx-4 w-full max-w-md rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl">
                                    <h3 className="mb-3 text-lg font-semibold text-[#191c1e]">
                                        {t("removeModalTitle", { name: removeTarget.fullName })}
                                    </h3>
                                    <p className="mb-3 text-sm text-[#5e3f3a]">{t("removeModalDesc")}</p>
                                    <label className={fieldLabelClassName}>
                                        {t("removeReasonLabel")} <span className="text-[#930006]">*</span>
                                    </label>
                                    <textarea
                                        value={removeReasonInput}
                                        onChange={(event) => setRemoveReasonInput(event.target.value)}
                                        rows={3}
                                        className="w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                                    />
                                    <div className="mt-4 flex justify-end gap-3">
                                        <button
                                            type="button"
                                            onClick={closeRemoveEmployee}
                                            className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                                        >
                                            {tCommon("cancel")}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={confirmRemoveEmployee}
                                            className="cursor-pointer rounded-lg bg-[#930006] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#7a0005]"
                                        >
                                            {t("confirmRemove")}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                        </div>
                    ) : formMode === "production" ? (
                        <div className="space-y-4 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
                            <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
                                {/* Team first: Line is its FK child, so Line stays locked until a Team is picked. */}
                                <label className="block w-full sm:w-44">
                                    <span className={fieldLabelClassName}>{t("productionFilterTeamLabel")}</span>
                                    <SearchableSelect
                                        options={visibleTeamOptions.map((option) => ({
                                            value: option.id,
                                            label: option.nameVn || option.code,
                                            searchText: `${option.code} ${option.nameVn ?? ""}`.toLowerCase(),
                                        }))}
                                        value={productionTeamId}
                                        onChange={setProductionTeamId}
                                        placeholder={t("productionFilterTeamPlaceholder")}
                                        disabled={!isCoreFormInfoFilled || isProductionScopeLocked}
                                    />
                                </label>
                                <label className="block w-full sm:w-44">
                                    <span className={fieldLabelClassName}>{t("productionFilterLineLabel")}</span>
                                    <SearchableSelect
                                        options={visibleLineOptions.map((option) => ({
                                            value: option.id,
                                            label: option.nameVn || option.code,
                                            searchText: `${option.code} ${option.nameVn ?? ""}`.toLowerCase(),
                                        }))}
                                        value={productionLineId}
                                        onChange={(v) => setProductionLineId(v)}
                                        placeholder={
                                            productionTeamId === "" ? t("productionFilterLinePlaceholderNeedTeam") : t("productionFilterLinePlaceholder")
                                        }
                                        disabled={!isCoreFormInfoFilled || productionTeamId === "" || isProductionScopeLocked}
                                    />
                                </label>
                                <label className="block w-full sm:w-44">
                                    <span className={fieldLabelClassName}>{t("productionFilterShiftTeamLabel")}</span>
                                    <SearchableSelect
                                        options={visibleShiftTeamOptions.map((option) => ({
                                            value: option.id,
                                            label: option.nameVn || option.code,
                                            searchText: `${option.code} ${option.nameVn ?? ""}`.toLowerCase(),
                                        }))}
                                        value={productionShiftTeamId}
                                        onChange={setProductionShiftTeamId}
                                        placeholder={t("productionFilterShiftTeamPlaceholder")}
                                        disabled={!isCoreFormInfoFilled || isProductionScopeLocked}
                                    />
                                </label>
                                <label className="block w-full sm:w-64">
                                    <span className={fieldLabelClassName}>{t("productionFilterKeywordLabel")}</span>
                                    <input
                                        value={productionKeyword}
                                        onChange={(event) => setProductionKeyword(event.target.value)}
                                        placeholder={t("productionFilterKeywordPlaceholder")}
                                        disabled={!isCoreFormInfoFilled}
                                        className={fieldClassName}
                                    />
                                </label>
                            </div>

                            {!isCoreFormInfoFilled ? null : !canSearchProduction ? (
                                <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-[#e0e3e5] bg-[#f8fafc] px-4 py-16 text-center text-sm text-[#5e3f3a]">
                                    <Users className="h-8 w-8 text-[#c7ccd1]" />
                                    {t("chooseTeamLineFirstHint")}
                                </div>
                            ) : productionResults.length === 0 ? (
                                <p className="text-sm text-[#5e3f3a]">{t("noProductionResults")}</p>
                            ) : (
                                <div
                            ref={tableScrollRef}
                            onMouseDown={onTableScrollMouseDown}
                            className="-mx-5 -mb-5 max-h-[70vh] cursor-grab overflow-auto rounded-b-xl border-y lg:max-h-none lg:min-h-0 lg:flex-1 border-[#e0e3e5]"
                        >
                                    <table className={tableClassName}>
                                        <thead className="sticky top-0 z-10 bg-white">
                                            <tr className="whitespace-nowrap text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                                <th rowSpan={2} className="h-px w-10 p-0 align-bottom">
                                                    <label className="flex h-full cursor-pointer items-end justify-center px-3 py-2 has-disabled:cursor-not-allowed">
                                                        <input
                                                            type="checkbox"
                                                            checked={productionResults.length > 0 && productionResults.every((item) => selectedEmployeeIds.includes(item.employeeId))}
                                                            onChange={() =>
                                                                setEmployeesSelected(
                                                                    productionResults.map((item) => item.employeeId),
                                                                    !productionResults.every((item) => selectedEmployeeIds.includes(item.employeeId))
                                                                )
                                                            }
                                                            disabled={isSubmitting}
                                                            aria-label={t("selectAllLabel")}
                                                            className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                                                        />
                                                    </label>
                                                </th>
                                                <th rowSpan={2} className="px-3 py-2 align-bottom">{t("colEmployeeCode")}</th>
                                                <th rowSpan={2} className="px-3 py-2 align-bottom">{t("colFullName")}</th>
                                                {/* No Block/shift-group columns: every row matches the filter above. Process stays since it isn't filtered. */}
                                                <th rowSpan={2} className="px-3 py-2 align-bottom">{t("colCongDoan")}</th>
                                                <th colSpan={3} className="border-b border-[#e0e3e5] px-3 py-2 text-center">{t("colAccumulation")}</th>
                                                <th rowSpan={2} className="px-3 py-2 align-bottom">{t("colStartTime")}</th>
                                                <th rowSpan={2} className="px-3 py-2 align-bottom">{t("colEndTime")}</th>
                                                {/* No "ate" column: meals are mandatory for production forms. */}
                                                <th rowSpan={2} className="px-3 py-2 align-bottom">{t("colMealTicketType")}</th>
                                                <th rowSpan={2} className="px-3 py-2 align-bottom">{t("colNote")}</th>
                                            </tr>
                                            <tr className="whitespace-nowrap border-b border-[#e0e3e5] text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                                <th className="px-3 py-2 text-center">{t("colDay")}</th>
                                                <th className="px-3 py-2 text-center">{t("colMonth")}</th>
                                                <th className="px-3 py-2 text-center">{t("colYear")}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {productionResults.map((item) => {
                                                const checked = selectedEmployeeIds.includes(item.employeeId);
                                                // Early warning only (per-employee custom limits first); BE ValidateOtHourLimitsAsync is the real guard.
                                                const currentStartTime = employeeOverrides[item.employeeId]?.startTime || startTime;
                                                const currentEndTime = employeeOverrides[item.employeeId]?.endTime || endTime;
                                                // Meals mandatory: ticket type always computed as having eaten.
                                                const mealTicketType = computeMealTicketType(currentStartTime, currentEndTime, true, setting);
                                                const monthLimit = item.customMonthlyOtHourLimit ?? setting.monthlyOtHourLimit;
                                                const yearLimit = item.customYearlyOtHourLimit ?? setting.yearlyOtHourLimit;
                                                const extraHours = checked && currentStartTime && currentEndTime && !isTimeRangeInvalid ? computeActualHours(currentStartTime, currentEndTime, true, setting) : 0;
                                                const overDay = item.projectedDayToDate + extraHours > dailyOtHourLimit;
                                                const overTh3 = item.projectedMonthToDate + extraHours > monthLimit || item.projectedYearToDate + extraHours > yearLimit;
                                                const isTimeOutOfRange =
                                                    checked &&
                                                    Boolean(startTime && endTime && currentStartTime && currentEndTime) &&
                                                    (toMinutes(`${currentStartTime}:00`) < toMinutes(`${startTime}:00`) ||
                                                        toMinutes(`${currentEndTime}:00`) <= toMinutes(`${currentStartTime}:00`) ||
                                                        toMinutes(`${currentEndTime}:00`) > toMinutes(`${endTime}:00`));
                                                return (
                                                    <tr
                                                        key={item.employeeId}
                                                        onClick={(event) => {
                                                            if (!isSubmitting && !isControlClick(event)) toggleEmployee(item.employeeId);
                                                        }}
                                                        className={`cursor-pointer border-b border-[#f1f5f9] transition-colors ${checked ? "bg-[#fff4f2]" : "bg-white even:bg-[#f2f4f7] hover:bg-[#e8ecf1]"}`}
                                                    >
                                                        <td className="px-3 py-2 align-top">
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={() => toggleEmployee(item.employeeId)}
                                                                disabled={isSubmitting}
                                                                className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                                                            />
                                                        </td>
                                                        <td className="whitespace-nowrap px-3 py-2 align-top text-sm font-semibold text-[#191c1e]">{item.employeeCode}</td>
                                                        <td className="whitespace-nowrap px-3 py-2 align-top text-sm">
                                                            <span className={overlappingEmployeeIds.includes(item.employeeId) ? "line-through text-[#930006]" : "text-[#191c1e]"}>
                                                                {item.fullName}
                                                            </span>
                                                            {item.isLeader && (
                                                                <span className="ml-1.5 inline-flex items-center rounded-full border border-[#e0e3e5] bg-[#f8fafc] px-1.5 py-0.5 text-[10px] font-semibold text-[#5e3f3a]">
                                                                    {t("leaderBadge")}
                                                                </span>
                                                            )}
                                                            <OverLimitBadges t={t} overDay={overDay} overTh3={overTh3} />
                                                            {overlappingEmployeeIds.includes(item.employeeId) && (
                                                                <div className="mt-1 text-xs font-semibold text-[#930006]">
                                                                    {t("colOverlapWarning")}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="whitespace-nowrap px-3 py-2 align-top text-sm text-[#5e3f3a]">{item.congDoan || "—"}</td>
                                                        <AccumulationCell t={t} code={item.employeeCode} kind="Daily" hours={item.projectedDayToDate} limit={dailyOtHourLimit} extraHours={extraHours} />
                                                        <AccumulationCell t={t} code={item.employeeCode} kind="Monthly" hours={item.projectedMonthToDate} limit={monthLimit} extraHours={extraHours} />
                                                        <AccumulationCell t={t} code={item.employeeCode} kind="Yearly" hours={item.projectedYearToDate} limit={yearLimit} extraHours={extraHours} />
                                                        <td className="px-3 py-2 align-top">
                                                            <TimePicker24h compact
                                                                value={currentStartTime}
                                                                onChange={(value) => handleEmployeeOverrideChange(item.employeeId, "startTime", value)}
                                                                disabled={isSubmitting || !checked}
                                                            />
                                                        </td>
                                                        <td className="relative px-3 py-2 align-top">
                                                            <TimePicker24h compact
                                                                value={currentEndTime}
                                                                onChange={(value) => handleEmployeeOverrideChange(item.employeeId, "endTime", value)}
                                                                disabled={isSubmitting || !checked}
                                                            />
                                                            {isTimeOutOfRange && (
<AlertTriangle aria-label={t("employeeTimeOutOfRange", { start: startTime, end: endTime })} className="absolute right-0.5 top-0.5 h-3.5 w-3.5 rounded-full bg-white text-[#930006]">
<title>{t("employeeTimeOutOfRange", { start: startTime, end: endTime })}</title>
</AlertTriangle>
)}
                                                        </td>
                                                        <td className="px-3 py-2 align-top">
                                                            {mealTicketType !== MEAL_TICKET_NONE && <MealTicketTypeBadge type={mealTicketType} t={t} />}
                                                        </td>
                                                        <td className="px-3 py-2 align-top">
                                                            <input
                                                                value={employeeOverrides[item.employeeId]?.noteVn ?? ""}
                                                                onChange={(event) => handleEmployeeOverrideChange(item.employeeId, "noteVn", event.target.value)}
                                                                placeholder={t("notePlaceholder")}
                                                                disabled={isSubmitting || !checked}
                                                                className="h-9 w-full rounded-lg border border-[#e0e3e5] bg-white px-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
                                                            />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ) : !isCoreFormInfoFilled || groupIds.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-[#e0e3e5] bg-[#f8fafc] px-4 py-16 text-center text-sm text-[#5e3f3a]">
                            <Users className="h-8 w-8 text-[#c7ccd1]" />
                            {t("employeeListPlaceholder")}
                        </div>
                    ) : groupEmployees.length === 0 ? (
                        <p className="text-sm text-[#5e3f3a]">{t("noEmployeesInGroup")}</p>
                    ) : (
                        <div
                            ref={tableScrollRef}
                            onMouseDown={onTableScrollMouseDown}
                            className="-mx-5 -mb-5 max-h-[70vh] cursor-grab overflow-auto rounded-b-xl border-y lg:max-h-none lg:min-h-0 lg:flex-1 border-[#e0e3e5]"
                        >
                            <table className={tableClassName}>
                                <thead className="sticky top-0 z-10 bg-white">
                                    <tr className="whitespace-nowrap text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                        <th rowSpan={2} className="h-px w-10 p-0 align-bottom">
                                            <label className="flex h-full cursor-pointer items-end justify-center px-3 py-2 has-disabled:cursor-not-allowed">
                                                <input
                                                    type="checkbox"
                                                    checked={visibleGroupEmployees.length > 0 && visibleGroupEmployees.every((employee) => selectedEmployeeIds.includes(employee.id))}
                                                    onChange={() =>
                                                        setEmployeesSelected(
                                                            visibleGroupEmployees.map((employee) => employee.id),
                                                            !visibleGroupEmployees.every((employee) => selectedEmployeeIds.includes(employee.id))
                                                        )
                                                    }
                                                    disabled={isSubmitting}
                                                    aria-label={t("selectAllLabel")}
                                                    className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                                                />
                                            </label>
                                        </th>
                                        <th rowSpan={2} className="px-3 py-2 align-bottom">{t("colEmployeeCode")}</th>
                                        <th rowSpan={2} className="px-3 py-2 align-bottom">{t("colFullName")}</th>
                                        <th colSpan={3} className="border-b border-[#e0e3e5] px-3 py-2 text-center">{t("colAccumulation")}</th>
                                        <th rowSpan={2} className="px-3 py-2 align-bottom">{t("colStartTime")}</th>
                                        <th rowSpan={2} className="px-3 py-2 align-bottom">{t("colEndTime")}</th>
                                        {showAteLaterColumn && ateLaterHeader}
                                        <th rowSpan={2} className="px-3 py-2 align-bottom">{t("colMealTicketType")}</th>
                                        <th rowSpan={2} className="px-3 py-2 align-bottom">{t("colNote")}</th>
                                    </tr>
                                    <tr className="whitespace-nowrap border-b border-[#e0e3e5] text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                        <th className="px-3 py-2 text-center">{t("colDay")}</th>
                                        <th className="px-3 py-2 text-center">{t("colMonth")}</th>
                                        <th className="px-3 py-2 text-center">{t("colYear")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {groupSections.map((section) => {
                                        const caseCode = otCaseCodeFor(section.selectedIds);
                                        const allSelected =
                                            section.visibleEmployees.length > 0 &&
                                            section.visibleEmployees.every((employee) => selectedEmployeeIds.includes(employee.id));
                                        return (
                                    <Fragment key={section.groupId}>
                                    {isMultiGroup && (!employeeKeyword || section.visibleEmployees.length > 0) && (
                                        <tr
                                            onClick={(event) => {
                                                if (!isSubmitting && !isControlClick(event) && section.visibleEmployees.length > 0)
                                                    setEmployeesSelected(section.visibleEmployees.map((employee) => employee.id), !allSelected);
                                            }}
                                            className="cursor-pointer border-b border-[#e0e3e5] bg-[#eef1f4]"
                                        >
                                            <td className="px-3 py-2 align-middle">
                                                <input
                                                    type="checkbox"
                                                    checked={allSelected}
                                                    onChange={() => setEmployeesSelected(section.visibleEmployees.map((employee) => employee.id), !allSelected)}
                                                    disabled={isSubmitting || section.visibleEmployees.length === 0}
                                                    aria-label={t("selectAllLabel")}
                                                    className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                                                />
                                            </td>
                                            <td colSpan={showAteLaterColumn ? 10 : 9} className="px-3 py-2 text-sm">
                                                <span className="inline-flex items-center gap-2">
                                                    <span className="font-semibold text-[#191c1e]">{groupLabel(section.groupId)}</span>
                                                    <span className="text-xs tabular-nums text-[#5e3f3a]">
                                                        {section.selectedIds.length}/{section.employees.length}
                                                    </span>
                                                    {caseCode && (
                                                        <span
                                                            className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${
                                                                caseCode === "TH3"
                                                                    ? "border-[#fde68a] bg-[#fffbeb] text-[#b45309]"
                                                                    : "border-[#e0e3e5] bg-white text-[#5e3f3a]"
                                                            }`}
                                                        >
                                                            {caseCode}
                                                        </span>
                                                    )}
                                                </span>
                                            </td>
                                        </tr>
                                    )}
                                    {section.visibleEmployees.map((employee) => {
                                        const checked = selectedEmployeeIds.includes(employee.id);
                                        // Use projected accumulation (actual + other pending forms) so two concurrent forms both see the warning.
                                        // Early warning only; BE ValidateOtHourLimitsAsync is the real guard.
                                        const currentStartTime = employeeOverrides[employee.id]?.startTime || startTime;
                                        const currentEndTime = employeeOverrides[employee.id]?.endTime || endTime;
                                        // BE field (true = eats during the shift, hours deducted); the UI shows it inverted as "eat later".
                                        const currentDidEat = didEatOf(employee.id);
                                        const currentAteLater = !currentDidEat;
                                        const earlyWindow = isEarlyMealWindowOt(currentStartTime, currentEndTime, setting);
                                        const mealTicketType = computeMealTicketType(currentStartTime, currentEndTime, currentDidEat, setting);
                                        const monthLimit = employee.customMonthlyOtHourLimit ?? setting.monthlyOtHourLimit;
                                        const yearLimit = employee.customYearlyOtHourLimit ?? setting.yearlyOtHourLimit;
                                        const extraHours = checked && currentStartTime && currentEndTime && !isTimeRangeInvalid ? computeActualHours(currentStartTime, currentEndTime, currentDidEat, setting) : 0;
                                        const overDay = employee.projectedDayToDate + extraHours > dailyOtHourLimit;
                                        const overTh3 = employee.projectedMonthToDate + extraHours > monthLimit || employee.projectedYearToDate + extraHours > yearLimit;
                                        const isTimeOutOfRange =
                                            checked &&
                                            Boolean(startTime && endTime && currentStartTime && currentEndTime) &&
                                            (toMinutes(`${currentStartTime}:00`) < toMinutes(`${startTime}:00`) ||
                                                toMinutes(`${currentEndTime}:00`) <= toMinutes(`${currentStartTime}:00`) ||
                                                toMinutes(`${currentEndTime}:00`) > toMinutes(`${endTime}:00`));
                                        return (
                                            <tr
                                                key={employee.id}
                                                onClick={(event) => {
                                                    if (!isSubmitting && !isControlClick(event)) toggleEmployee(employee.id);
                                                }}
                                                className={`cursor-pointer border-b border-[#f1f5f9] transition-colors ${checked ? "bg-[#fff4f2]" : "bg-white even:bg-[#f2f4f7] hover:bg-[#e8ecf1]"}`}
                                            >
                                                <td className="px-3 py-2 align-top">
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={() => toggleEmployee(employee.id)}
                                                        disabled={isSubmitting}
                                                        className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                                                    />
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-2 align-top text-sm font-semibold text-[#191c1e]">{employee.code}</td>
                                                <td className="whitespace-nowrap px-3 py-2 align-top text-sm">
                                                    <span className={overlappingEmployeeIds.includes(employee.id) ? "line-through text-[#930006]" : "text-[#191c1e]"}>
                                                        {employee.lastName} {employee.firstName}
                                                    </span>
                                                    <OverLimitBadges t={t} overDay={overDay} overTh3={overTh3} />
                                                    {overlappingEmployeeIds.includes(employee.id) && (
                                                        <div className="mt-1 text-xs font-semibold text-[#930006]">
                                                            {t("colOverlapWarning")}
                                                        </div>
                                                    )}
                                                </td>
                                                <AccumulationCell t={t} code={employee.code} kind="Daily" hours={employee.projectedDayToDate} limit={dailyOtHourLimit} extraHours={extraHours} />
                                                <AccumulationCell t={t} code={employee.code} kind="Monthly" hours={employee.projectedMonthToDate} limit={monthLimit} extraHours={extraHours} />
                                                <AccumulationCell t={t} code={employee.code} kind="Yearly" hours={employee.projectedYearToDate} limit={yearLimit} extraHours={extraHours} />
                                                <td className="px-3 py-2 align-top">
                                                    <TimePicker24h compact
                                                        value={currentStartTime}
                                                        onChange={(value) => handleEmployeeOverrideChange(employee.id, "startTime", value)}
                                                        disabled={isSubmitting || !checked}
                                                    />
                                                </td>
                                                <td className="relative px-3 py-2 align-top">
                                                    <TimePicker24h compact
                                                        value={currentEndTime}
                                                        onChange={(value) => handleEmployeeOverrideChange(employee.id, "endTime", value)}
                                                        disabled={isSubmitting || !checked}
                                                    />
                                                    {isTimeOutOfRange && (
<AlertTriangle aria-label={t("employeeTimeOutOfRange", { start: startTime, end: endTime })} className="absolute right-0.5 top-0.5 h-3.5 w-3.5 rounded-full bg-white text-[#930006]">
<title>{t("employeeTimeOutOfRange", { start: startTime, end: endTime })}</title>
</AlertTriangle>
)}
                                                </td>
                                                {showAteLaterColumn && (
                                                    <td className="h-px p-0 align-top">
                                                        {earlyWindow || !canEatLater(employee.id) ? null : (
                                                            <label className="flex h-full cursor-pointer justify-center px-3 py-2 has-disabled:cursor-not-allowed">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={currentAteLater}
                                                                    onChange={(event) => handleEmployeeDidEatChange(employee.id, !event.target.checked)}
                                                                    disabled={isSubmitting || !checked}
                                                                    aria-label={t("ateLaterLabel")}
                                                                    className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                                                                />
                                                            </label>
                                                        )}
                                                    </td>
                                                )}
                                                <td className="px-3 py-2 align-top">
                                                    {mealTicketType !== MEAL_TICKET_NONE && <MealTicketTypeBadge type={mealTicketType} t={t} />}
                                                </td>
                                                <td className="px-3 py-2 align-top">
                                                    <input
                                                        value={employeeOverrides[employee.id]?.noteVn ?? ""}
                                                        onChange={(event) => handleEmployeeOverrideChange(employee.id, "noteVn", event.target.value)}
                                                        placeholder={t("notePlaceholder")}
                                                        disabled={isSubmitting || !checked}
                                                        className="h-9 w-full rounded-lg border border-[#e0e3e5] bg-white px-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    </Fragment>
                                        );
                                    })}
                                    {employeeKeyword && visibleGroupEmployees.length === 0 && (
                                        <tr>
                                            <td colSpan={showAteLaterColumn ? 11 : 10} className="px-3 py-8 text-center text-sm text-[#5e3f3a]">
                                                {t("employeeSearchNoResult")}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
                </div>

                                <div className="sticky bottom-0 z-20 flex justify-end gap-3 border-t border-[#e0e3e5] bg-[#f8fafc]/95 py-3 backdrop-blur">
                    {resubmitKind != null && (
                        <input
                            value={resubmitReason}
                            onChange={(event) => setResubmitReason(event.target.value)}
                            placeholder={t("resubmitReasonPlaceholder")}
                            disabled={isSubmitting}
                            className="h-10 min-w-0 flex-1 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
                        />
                    )}
                    <button
                        type="button"
                        onClick={() => router.back()}
                        disabled={isSubmitting}
                        className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {t("cancelButton")}
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isSubmitting ? t("saving") : resubmitKind != null ? t("resubmitSubmit") : isEditMode ? t("updateSubmit") : t("createSubmit")}
                    </button>
                </div>
            </form>

            <SecondaryPasswordDialog
                isOpen={isPasswordDialogOpen}
                title={t("confirmSaveTitle")}
                label={t("secondaryPasswordLabel")}
                hint={hasSecondaryPassword === false ? t("secondaryPasswordMissingHint") : ""}
                hintIsWarning
                value={secondaryPassword}
                onChange={setSecondaryPassword}
                confirmLabel={isSubmitting ? tCommon("processing") : tCommon("confirm")}
                cancelLabel={tCommon("cancel")}
                closeLabel={tCommon("close")}
                loading={isSubmitting}
                onConfirm={performSubmit}
                onClose={() => setIsPasswordDialogOpen(false)}
            />
        </div>
    );
}
