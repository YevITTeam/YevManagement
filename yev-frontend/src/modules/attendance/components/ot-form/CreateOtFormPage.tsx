"use client";

import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CalendarClock, CalendarX2, Car, OctagonX, PenLine, Printer, RefreshCw, SearchX, Undo2, UserMinus, UserPlus, Users, X } from "lucide-react";
import { toast } from "react-toastify";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, Link } from "@/navigation";

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
import { OtFormApi } from "@/modules/attendance/api/ot-form.api";
import type {
    CreateOtFormDto,
    MyCreateScopeItemDto,
    OtFormEmployeeDto,
    OtFormEmployeeInputDto,
    ProcessPartDto,
} from "@/modules/attendance/types/ot-form.dto";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { RequiredMark } from "@/components/ui/RequiredMark";
import InfoTooltip from "@/components/ui/InfoTooltip";
import TimePicker24h from "@/components/ui/TimePicker24h";
import { Skeleton } from "@/components/ui/Skeleton";
import { IconButton, IconFlag, SearchField } from "@/components/ui/ListToolbar";
import { EmptyState } from "@/components/common/EmptyState";
import FormDialog from "@/components/common/FormDialog";
import OtCaseBadge from "@/modules/attendance/components/OtCaseBadge";
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
import { isOvernight } from "@/modules/attendance/lib/time";
import { MEAL_TICKET_MAIN, MEAL_TICKET_SECONDARY, computeActualHours, computeMealTicketType, isEarlyMealWindowOt, splitHoursByDay } from "@/modules/attendance/lib/mealTicket";
import { MealTicketTypeBadge } from "./MealTicketTypeBadge";

const fieldLabelClassName = "mb-1 block text-xs font-medium text-[#5e3f3a]";
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

const wrapMinutes = (minutes: number) => (minutes + 24 * 60) % (24 * 60);

// An end before the start means the next day; 0 only when they are equal (isTimeRangeInvalid shows the error).
function computeTotalHour(startTime: string, endTime: string): number {
    if (!startTime || !endTime) return 0;
    return Math.round((wrapMinutes(toMinutes(endTime) - toMinutes(startTime)) / 60) * 100) / 100;
}

// Offsets from the form's start, so overnight forms need no special case (mirrors BE EnsureEmployeeTimeWithinForm).
function isEmployeeTimeOutOfRange(formStart: string, formEnd: string, start: string, end: string): boolean {
    const offset = wrapMinutes(toMinutes(start) - toMinutes(formStart));
    const formLength = wrapMinutes(toMinutes(formEnd) - toMinutes(formStart));
    const length = wrapMinutes(toMinutes(end) - toMinutes(start));
    return offset >= formLength || length === 0 || offset + length > formLength;
}

function addOneDay(date: string, days = 1): string {
    const next = new Date(`${date}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + days);
    return next.toISOString().slice(0, 10);
}

// Company rule for OT on a non-working day: sign with the workshop head by that week's Wednesday for Sat/Sun,
// otherwise 3 working days before; a non-working Wednesday moves back to the previous working day.
function holidaySignDeadline(offDate: string, isOff: (value: string) => boolean): string {
    const weekday = new Date(`${offDate}T00:00:00Z`).getUTCDay();
    const weekend = weekday === 0 || weekday === 6;
    let deadline = weekend ? addOneDay(offDate, weekday === 6 ? -3 : -4) : offDate;
    // The cap guards against a calendar that marks a whole stretch as non-working.
    for (let left = weekend ? 0 : 3, guard = 0; guard < 60 && (left > 0 || isOff(deadline)); guard++) {
        deadline = addOneDay(deadline, -1);
        if (left > 0 && !isOff(deadline)) left--;
    }
    return deadline;
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
    sharedLimit,
    extraHours = 0,
}: {
    t: (key: string, values?: Record<string, string | number>) => string;
    code: string;
    kind: AccumulationKind;
    hours: number;
    limit: number;
    // The company limit, when `limit` may be the person's own raised one.
    sharedLimit?: number;
    extraHours?: number;
}) {
    const total = Math.round((hours + extraHours) * 100) / 100;
    const isOver = total > limit;
    const withinRaisedLimit = !isOver && sharedLimit !== undefined && total > sharedLimit;
    const overClassName = kind === "Daily" ? "font-semibold text-[#930006]" : "font-semibold text-[#9a5b00]";
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
            {withinRaisedLimit && (
                <div className="text-[11px] text-[#8a8f94]" title={t("customLimitHint", { limit: sharedLimit })}>
                    {t("customLimitNote", { hours: limit })}
                </div>
            )}
        </td>
    );
}

const th3PillClassName = "inline-flex items-center rounded-full border border-[#f5d0a9] bg-[#fff4e5] px-1.5 py-0.5 text-[10px] font-semibold text-[#9a5b00]";

// Flags next to the employee name: red when the day total would pass the daily limit (form is blocked), amber when the
// month/year total would pass the limit (form becomes TH3).
function OverLimitBadges({ t, overDay, overTh3, overlap }: { t: (key: string) => string; overDay: boolean; overTh3: boolean; overlap: boolean }) {
    if (!overDay && !overTh3 && !overlap) return null;
    return (
        <span className="ml-1.5 inline-flex items-center gap-1 align-middle">
            {overlap && <IconFlag icon={CalendarX2} label={t("colOverlapWarning")} tone="danger" />}
            {overDay && <IconFlag icon={OctagonX} label={t("badgeOverDailyTooltip")} tone="danger" />}
            {overTh3 && (
                <span title={t("badgeTh3Tooltip")} className={th3PillClassName}>
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
    // BE field: true = eats during the shift (MealBreakDeductionHours deducted); shown inverted as "eat later".
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
    const locale = useLocale();
    const router = useRouter();
    const { user } = useAuth();
    const isEditMode = otFormId !== undefined;
    // Admin-only permission used as the "unrestricted" signal when my-create-scopes is empty, to tell Admin apart
    // from an unconfigured account (which must be blocked).
    const isUnrestrictedAdmin = hasPermission(user, "Attendance.Department.Create");

    const [departments, setDepartments] = useState<DepartmentDto[]>([]);
    const [groups, setGroups] = useState<GroupDto[]>([]);
    const [reasons, setReasons] = useState<ReasonDto[]>([]);
    const [otCases, setOtCases] = useState<OtCaseDto[]>([]);
    // Group-mode create loads one list per selected group; edit mode keeps the form's single group.
    const [employeeGroups, setEmployeeGroups] = useState<{ groupId: number; employees: EmployeeDto[] }[]>([]);
    const groupEmployees = useMemo(() => employeeGroups.flatMap((g) => g.employees), [employeeGroups]);

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

    // Each workshop has its own non-working-day calendar; a form follows its group's workshop. A date in it is a
    // non-working day: the OT case becomes TH2 and the daily OT limit switches to the holiday limit.
    const calendarYear = date ? Number(date.slice(0, 4)) : null;
    const workshopIdOfGroup = (id: number | null) => groups.find((g) => g.id === id)?.workshopId ?? 0;
    const workshopKey = [...new Set(groupIds.map(workshopIdOfGroup).filter(Boolean))].sort().join(",");
    const [calendarDays, setCalendarDays] = useState<(WorkCalendarDayDto & { workshopId: number })[]>([]);
    const isOvernightForm = isOvernight(startTime, endTime);
    const nextDate = date ? addOneDay(date) : "";
    const spansNewYear = isOvernightForm && Boolean(date) && nextDate.slice(0, 4) !== date.slice(0, 4);
    // A January form's signing deadline can fall in the previous year.
    const needsPrevYear = date.slice(5, 7) === "01";
    const { isLoading: isCalendarLoading } = useFetchEffect(
        async () => {
            if (!calendarYear || !workshopKey) return [];
            const years = [...(needsPrevYear ? [calendarYear - 1] : []), calendarYear, ...(spansNewYear ? [calendarYear + 1] : [])];
            const lists = await Promise.all(
                workshopKey.split(",").map(Number).flatMap((workshopId) =>
                    years.map(async (year) => (await WorkCalendarApi.getByYear(workshopId, year)).map((day) => ({ ...day, workshopId })))
                )
            );
            return lists.flat();
        },
        [calendarYear, spansNewYear, needsPrevYear, workshopKey],
        setCalendarDays,
        t("workCalendarLoadError")
    );
    // A workshop year with no calendar rows falls back to Sundays, same as the BE.
    const isNonWorkingDate = (value: string, workshopId: number) => {
        const ownDays = calendarDays.filter((day) => day.workshopId === workshopId);
        return ownDays.some((day) => day.date.slice(0, 4) === value.slice(0, 4))
            ? ownDays.some((day) => day.date === value)
            : new Date(`${value}T00:00:00Z`).getUTCDay() === 0;
    };
    // 22:00-00:00 ends exactly at midnight and has no hours on the next day.
    const touchesNonWorkingDayOf = (workshopId: number) =>
        isNonWorkingDate(date, workshopId) || (isOvernightForm && endTime !== "00:00" && isNonWorkingDate(nextDate, workshopId));
    const baseOtCaseCodeOf = (formGroupId: number | null) => (date ? (touchesNonWorkingDayOf(workshopIdOfGroup(formGroupId)) ? "TH2" : "TH1") : null);
    const isNonWorkingDay = Boolean(date) && isNonWorkingDate(date, workshopIdOfGroup(groupId));
    const touchesNonWorkingDay = Boolean(date) && touchesNonWorkingDayOf(workshopIdOfGroup(groupId));
    const baseOtCaseCode = baseOtCaseCodeOf(groupId);
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

    // Only TH2 forms on create, after the calendar loads (the Sunday fallback would mislead) and once the date is in
    // the allowed range, so half-typed years like 0002 never pop the dialog. Earliest deadline wins across workshops.
    const holidayDeadline =
        isEditMode || isCalendarLoading || !date || date < getTodayStr(-setting.backdateDays)
            ? null
            : ([...new Set(groupIds.map(workshopIdOfGroup).filter(Boolean))]
                  .filter(touchesNonWorkingDayOf)
                  .map((workshopId) =>
                      holidaySignDeadline(isNonWorkingDate(date, workshopId) ? date : nextDate, (value) => isNonWorkingDate(value, workshopId))
                  )
                  .sort()[0] ?? null);
    const today = getTodayStr();
    const holidayDeadlineKey = `${date}|${holidayDeadline}`;
    const [dismissedDeadlineKey, setDismissedDeadlineKey] = useState("");
    const isDeadlineDialogOpen = holidayDeadline !== null && today >= holidayDeadline && dismissedDeadlineKey !== holidayDeadlineKey;
    const formatDeadline = (value: string) =>
        `${new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`))}, ${value.slice(8, 10)}/${value.slice(5, 7)}`;

    // New rows default to "eat later" ticked (didEat = false, no deduction).
    const defaultDidEatForNewEmployee = false;

    // Groups that disallow eating later always eat during the shift (BE forces the same); unknown groups stay allowed.
    const noEatLaterGroupIds = useMemo(() => new Set(groups.filter((g) => !g.allowEatLater).map((g) => g.id)), [groups]);
    const groupIdByEmployeeId = useMemo(() => new Map(groupEmployees.map((e) => [e.id, e.groupId])), [groupEmployees]);
    const canEatLater = (employeeId: number) => {
        const employeeGroupId = isEditMode ? groupId : groupIdByEmployeeId.get(employeeId);
        return employeeGroupId == null || !noEatLaterGroupIds.has(employeeGroupId);
    };
    const didEatOf = (employeeId: number) =>
        !canEatLater(employeeId) || (employeeOverrides[employeeId]?.didEat ?? defaultDidEatForNewEmployee);
    const showAteLaterColumn = groupIds.some((id) => !noEatLaterGroupIds.has(id));

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
        return accumulationById;
    }, [groupEmployees, setting]);
    const exceedsTh3For = (employeeIds: number[]) => {
        if (isEditMode || !date || !startTime || !endTime) return false;
        return employeeIds.some((employeeId) => {
            const accumulation = accumulationById.get(employeeId);
            if (!accumulation) return false;
            const { firstDay, nextDay } = splitHoursByDay(
                startTime,
                employeeOverrides[employeeId]?.startTime || startTime,
                employeeOverrides[employeeId]?.endTime || endTime,
                didEatOf(employeeId),
                setting
            );
            const monthHours = firstDay + (nextDate.slice(0, 7) === date.slice(0, 7) ? nextDay : 0);
            const yearHours = firstDay + (nextDate.slice(0, 4) === date.slice(0, 4) ? nextDay : 0);
            return accumulation.month + monthHours > accumulation.monthLimit || accumulation.year + yearHours > accumulation.yearLimit;
        });
    };
    const otCaseCodeFor = (employeeIds: number[], formGroupId: number | null = groupId) => (exceedsTh3For(employeeIds) ? "TH3" : baseOtCaseCodeOf(formGroupId));
    const exceedsTh3 = exceedsTh3For(selectedEmployeeIds);
    const otCaseCode = exceedsTh3 ? "TH3" : baseOtCaseCode;
    const otCaseId = isEditMode ? loadedOtCaseId : (otCases.find((c) => c.code === otCaseCode)?.id ?? null);
    const otCase = otCases.find((c) => c.id === otCaseId);

    // Group-mode create: narrows the table only; hidden rows keep their selection.
    const [employeeQuery, setEmployeeQuery] = useState("");
    const employeeKeyword = normalizeText(employeeQuery.trim());
    const matchesEmployeeQuery = (employee: EmployeeDto) =>
        !employeeKeyword || normalizeText(`${employee.code} ${employee.lastName} ${employee.firstName}`).includes(employeeKeyword);

    // Group-mode create: one form per selected group, each with its own OT case and support request.
    const isGroupCreate = !isEditMode;
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
    const hasEmployeeTable = isEditMode || (isCoreFormInfoFilled && groupIds.length > 0 && groupEmployees.length > 0);

    // Soft hint only: BE blocks creation without a signature just when the creator must self-sign the requester box.
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
    }, []);

    useEffect(() => {
        OtFormApi.getMyCreateScopes()
            .then((scopes) => {
                setCreateScopes(scopes);
                // Prefill only on create; edit mode already holds the form's real data. Several scopes share one department.
                if (!isEditMode && scopes.length > 0) {
                    setDepartmentId(scopes[0].departmentId);
                    if (scopes.length === 1) setGroupIds([scopes[0].groupId]);
                }
            })
            .catch((err) => {
                console.error(err);
                setCreateScopes([]); // On error don't block the page; fall back to free dropdowns.
            });
    }, [isEditMode]);

    const isScopeRestricted = createScopes !== null && createScopes.length > 0;
    // Lock only on create; edit still allows changing within scope.
    const isScopeLocked = !isEditMode && isScopeRestricted && createScopes!.length === 1;
    const isScopeDepartmentLocked = !isEditMode && isScopeRestricted && new Set(createScopes!.map((s) => s.departmentId)).size === 1;
    // Empty scopes and not Admin → no department to create for; block instead of failing with 400 later.
    const isBlockedNoScope =
        !isEditMode && createScopes !== null && createScopes.length === 0 && !isUnrestrictedAdmin;

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
                // Legacy production-line forms have no Group, so this page has no UI to edit them.
                if ((!data.isEditable && !canResubmit) || data.isProductionForm) {
                    setLoadError(t("notEditableError"));
                    return;
                }
                setResubmitKind(data.isEditable ? null : data.resubmitKind);
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
    const isTimeRangeInvalid = Boolean(startTime && endTime && toMinutes(endTime) === toMinutes(startTime));

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

    const renderTimeCell = (employeeId: number, rowStart: string, rowEnd: string, disabled: boolean, outOfRange = false) => (
        <td className="relative whitespace-nowrap px-3 py-2 align-top">
            <span className="inline-flex items-center gap-1">
                <span role="group" aria-label={t("fieldStartTime")}>
                    <TimePicker24h compact value={rowStart} onChange={(value) => handleEmployeeOverrideChange(employeeId, "startTime", value)} disabled={disabled} />
                </span>
                <span className="text-[#8a8f94]">–</span>
                <span role="group" aria-label={t("fieldEndTime")}>
                    <TimePicker24h compact value={rowEnd} onChange={(value) => handleEmployeeOverrideChange(employeeId, "endTime", value)} disabled={disabled} />
                </span>
            </span>
            {outOfRange && (
                <AlertTriangle aria-label={t("employeeTimeOutOfRange", { start: startTime, end: endTime })} className="absolute right-0.5 top-0.5 h-3.5 w-3.5 rounded-full bg-white text-[#930006]">
                    <title>{t("employeeTimeOutOfRange", { start: startTime, end: endTime })}</title>
                </AlertTriangle>
            )}
        </td>
    );

    const renderNoteCell = (employeeId: number, disabled: boolean) => (
        <td className="px-3 py-2 align-top">
            <input
                value={employeeOverrides[employeeId]?.noteVn ?? ""}
                onChange={(event) => handleEmployeeOverrideChange(employeeId, "noteVn", event.target.value)}
                aria-label={t("colNote")}
                disabled={disabled}
                className="h-7 w-full rounded-md border border-[#e0e3e5] bg-white px-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
            />
        </td>
    );

    // Bulk toggle covers only the rows that show the checkbox: selected, group allows it, outside the early window.
    const ateLaterBulkIds = selectedEmployeeIds.filter(
        (id) =>
            canEatLater(id) &&
            !isEarlyMealWindowOt(employeeOverrides[id]?.startTime || startTime, employeeOverrides[id]?.endTime || endTime, setting)
    );
    const allAteLater = ateLaterBulkIds.length > 0 && ateLaterBulkIds.every((id) => !didEatOf(id));
    const ateLaterHeader = (
        <th rowSpan={2} title={t("ateLaterHint")} className="h-px w-px whitespace-normal p-0 text-center align-bottom leading-tight">
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

    // Candidates for "add employee" while editing: the whole Group (small), filtered by the dropdown itself.
    useFetchEffect(
        async () => {
            if (!isEditMode || !groupId) return [];
            const results = await EmployeeApi.getEmployeesByGroup(groupId, date || undefined);
            return results.map((item) => ({ employeeId: item.id, employeeCode: item.code, fullName: `${item.lastName} ${item.firstName}` }));
        },
        [isEditMode, groupId, date],
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

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (groupIds.length === 0 || !departmentId || !reasonId || !otCaseId || !date || !startTime || !endTime) {
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
        if (isTimeRangeInvalid) {
            toast.error(t("endTimeEqualsStartError"));
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

        for (const employeeId of selectedEmployeeIds) {
            if (isEmployeeTimeOutOfRange(startTime, endTime, employeeOverrides[employeeId]?.startTime || startTime, employeeOverrides[employeeId]?.endTime || endTime)) {
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
        const buildCreateDto = (employeeIds: number[], processPartKey: number, formGroupId: number): CreateOtFormDto => ({
            groupId: formGroupId,
            departmentId: departmentId!,
            reasonId: reasonId!,
            otCaseId: otCases.find((c) => c.code === otCaseCodeFor(employeeIds, formGroupId))?.id ?? otCaseId!,
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
                    header: {
                        date,
                        startTime: `${startTime}:00`,
                        endTime: `${endTime}:00`,
                        reasonId: reasonId!,
                        subReason: subReason.trim() || null,
                        processPart: getSubmitProcessPart(0, selectedEmployeeIds),
                    },
                    employees: selectedEmployeeIds.map(toEmployeeInput),
                    removedEmployees,
                    secondaryPassword,
                    resubmitReason: resubmitKind != null ? resubmitReason.trim() : null,
                });
            } else {
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
        return (
            <div className="space-y-4" aria-busy="true" aria-label={tCommon("loading")}>
                <Skeleton className="h-7 w-56" />
                <div className="grid gap-4 lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)]">
                    <Skeleton className="h-[34rem] rounded-xl" />
                    <Skeleton className="h-[34rem] rounded-xl" />
                </div>
            </div>
        );
    }

    if (loadError) {
        return <div className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{loadError}</div>;
    }

    if (isBlockedNoScope) {
        return (
            <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h1 className="text-xl font-semibold text-[#191c1e]">{t("titleCreate")}</h1>
                </div>
                <div title={t("blockedNoScopeHint")} className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">
                    {t("blockedNoScopeMessage")}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-xl font-semibold text-[#191c1e]">{isEditMode ? t("titleEdit", { id: otFormId }) : t("titleCreate")}</h1>
            </div>

            {!isEditMode && hasSignature === false && (
                <div
                    title={t("noSignatureHint")}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-[#f5d0a9] bg-[#fff4e5] px-4 py-2 text-sm text-[#9a5b00]"
                >
                    <span>{t("noSignatureMessage")}</span>
                    <button
                        type="button"
                        onClick={() => router.push("/ot/signature")}
                        className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#9a5b00] px-3 py-1 text-xs font-semibold text-[#9a5b00] transition hover:bg-[#fff0d8]"
                    >
                        <PenLine className="h-3.5 w-3.5" />
                        {t("registerSignatureButton")}
                    </button>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid items-start gap-4 lg:min-h-[34rem] lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] lg:items-stretch">
                <section className="space-y-3.5 rounded-xl border border-[#e0e3e5] bg-white p-5 shadow-sm">
                    <div className="grid gap-x-3 gap-y-3 sm:grid-cols-2">
                        <label className="block">
                            <span className={fieldLabelClassName}>{t("fieldDepartment")}<RequiredMark /></span>
                            <SearchableSelect
                                options={visibleDepartments.map((d) => ({ value: d.id, label: d.label, searchText: d.label.toLowerCase() }))}
                                value={departmentId ?? ""}
                                onChange={handleDepartmentChange}
                                ariaLabel={t("fieldDepartment")}
                                disabled={isSubmitting || isEditMode || isScopeDepartmentLocked}
                            />
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>{t("fieldGroup")}<RequiredMark /></span>
                            {isEditMode || isScopeLocked ? (
                                <SearchableSelect
                                    options={visibleGroups.map((g) => ({ value: g.id, label: g.label, searchText: g.label.toLowerCase() }))}
                                    value={groupId ?? ""}
                                    onChange={() => {}}
                                    ariaLabel={t("fieldGroup")}
                                    disabled
                                />
                            ) : (
                                <MultiSelect
                                    options={visibleGroups.map((g) => ({ value: g.id, label: g.label, searchText: g.label.toLowerCase() }))}
                                    values={groupIds}
                                    onChange={handleGroupIdsChange}
                                    placeholder={departmentId ? "" : t("fieldGroupPlaceholderNeedDepartment")}
                                    ariaLabel={t("fieldGroup")}
                                    disabled={isSubmitting || !departmentId}
                                />
                            )}
                        </label>

                        <div className="sm:col-span-2">
                            <div className="flex flex-wrap items-end gap-3">
                                <label className="block">
                                    <span className={fieldLabelClassName}>{t("fieldDate")}<RequiredMark /></span>
                                    <input
                                        type="date"
                                        value={date}
                                        onChange={(event) => setDate(event.target.value)}
                                        disabled={isSubmitting}
                                        required
                                        min={isEditMode ? undefined : getTodayStr(-setting.backdateDays)}
                                        className={fieldClassName.replace("w-full", "w-40")}
                                    />
                                </label>
                                <div>
                                    <span className={fieldLabelClassName}>{t("fieldTime")}<RequiredMark /></span>
                                    <div className="flex items-center gap-1.5">
                                        <span role="group" aria-label={t("fieldStartTime")}>
                                            <TimePicker24h value={startTime} onChange={setStartTime} disabled={isSubmitting} />
                                        </span>
                                        <span className="text-[#8a8f94]">–</span>
                                        <span role="group" aria-label={t("fieldEndTime")}>
                                            <TimePicker24h value={endTime} onChange={setEndTime} disabled={isSubmitting} />
                                        </span>
                                    </div>
                                </div>
                                {/* Form hours are only the outer frame; the daily limit is warned per employee row. */}
                                <span className="flex h-9 items-center gap-1.5">
                                    <span title={t("fieldTotalHour")} className="rounded-full border border-[#e0e3e5] bg-[#f8fafc] px-2 py-0.5 text-xs font-semibold tabular-nums text-[#5e3f3a]">
                                        {totalHour}h
                                    </span>
                                    {isOvernightForm && (
                                        <span title={t("nextDayHint")} className="text-xs font-semibold text-[#9a5b00]">
                                            {t("nextDayLabel")}
                                        </span>
                                    )}
                                    {/* The case is derived (date, calendar, limits), so it is a read-only chip; several groups show theirs per group. */}
                                    {!isMultiGroup && otCase && (
                                        <span
                                            title={`${t("fieldOtCase")} — ${t(isEditMode ? "otCaseAutoHintEdit" : exceedsTh3 ? "otCaseAutoHintTh3" : touchesNonWorkingDay ? "otCaseAutoHintNonWorking" : "otCaseAutoHintWorking")}`}
                                            className={otCase.code === "TH3" ? th3PillClassName.replace("text-[10px]", "text-xs") : "inline-flex items-center rounded-full border border-[#e0e3e5] bg-white px-1.5 py-0.5 text-xs font-semibold text-[#5e3f3a]"}
                                        >
                                            <OtCaseBadge code={otCase.code} description={otCase.description} descriptionJp={otCase.descriptionJp} />
                                        </span>
                                    )}
                                </span>
                            </div>
                            {isTimeRangeInvalid && (
                                <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-[#930006]">
                                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                    {t("endTimeEqualsStartError")}
                                </p>
                            )}
                            {holidayDeadline && (
                                <p
                                    role="status"
                                    className={`mt-2 flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold ${
                                        today > holidayDeadline ? "border-[#e9bcb6] bg-[#fff4f2] text-[#930006]" : "border-[#f5d0a9] bg-[#fff4e5] text-[#9a5b00]"
                                    }`}
                                >
                                    <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                                    {t(today > holidayDeadline ? "holidaySignOverdue" : "holidaySignDeadline", { deadline: formatDeadline(holidayDeadline) })}
                                    <InfoTooltip text={`${t("holidaySignRuleWeekend")} ${t("holidaySignRuleOther")} ${t("holidaySignReason")}`} />
                                </p>
                            )}
                        </div>

                        <label className="block sm:col-span-2">
                            <span className={fieldLabelClassName}>{t("fieldReason")}<RequiredMark /></span>
                            <SearchableSelect
                                options={reasons.map((r) => ({ value: r.id, label: r.reasonNameVn, searchText: r.reasonNameVn.toLowerCase() }))}
                                value={reasonId ?? ""}
                                onChange={(v) => setReasonId(v === "" ? null : v)}
                                ariaLabel={t("fieldReason")}
                                disabled={isSubmitting}
                            />
                        </label>
                    </div>

                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldSubReason")}</span>
                        <textarea
                            value={subReason}
                            onChange={(event) => setSubReason(event.target.value)}
                            disabled={isSubmitting}
                            rows={2}
                            className="w-full resize-none rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
                        />
                    </label>

                    <div className="space-y-2.5 border-t border-[#e0e3e5] pt-3">
                    {/* Always shown: meals are mandatory, only shuttle/photo room are optional. */}
                    <span className="block text-xs font-semibold text-[#5e3f3a]">{t("otherSupportLabel")}</span>

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
                                disabled={isSubmitting}
                            />
                            <ToggleOptionCard
                                icon={<Printer size={13} />}
                                label={t("copyRoomLabel")}
                                checked={part.isUseCopyRoom}
                                onChange={(value) => updateProcessPart(section.key, { isUseCopyRoom: value })}
                                disabled={isSubmitting}
                            />
                        </div>

                        {/* Counts are auto-filled from each person's OT hours; once overridden, the recalc button restores them. */}
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
                                    disabled={isSubmitting}
                                    className={`${compactFieldClassName.replace("w-full", "w-20")} text-center`}
                                />
                            </label>
                            {!isEditMode && isManual && (
                                <IconButton
                                    icon={RefreshCw}
                                    label={t("mealTicketRecalcButton")}
                                    onClick={() => setManualMealTicketKeys((current) => ({ ...current, [section.key]: false }))}
                                    disabled={isSubmitting}
                                />
                            )}
                        </div>

                        <label className="block">
                            <span className={fieldLabelClassName}>{t("anotherSuggestionVnLabel")}</span>
                            <input
                                value={part.anotherSuggestionVn ?? ""}
                                onChange={(event) => updateProcessPart(section.key, { anotherSuggestionVn: event.target.value })}
                                disabled={isSubmitting}
                                className={compactFieldClassName}
                            />
                        </label>
                    </div>
                        );
                    })}
                    </div>
                </section>

                <section className="flex flex-col gap-4 rounded-xl border border-[#e0e3e5] bg-white p-5 shadow-sm lg:h-0 lg:min-h-full">
                    {hasEmployeeTable && (
                        <div className="flex flex-wrap items-center gap-2">
                            {isGroupCreate && (
                                <SearchField value={employeeQuery} onChange={setEmployeeQuery} onEnter={() => {}} placeholder={t("employeeSearchPlaceholder")} wide />
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
                                        placeholder={t("addEmployeeSectionTitle")}
                                        ariaLabel={t("addEmployeeSectionTitle")}
                                        disabled={isSubmitting}
                                        triggerClassName="h-9 w-full rounded-md border border-[#e0e3e5] bg-white px-2.5 pr-8 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f]"
                                    />
                                </div>
                            )}
                            <span
                                title={t("selectedCount", { count: selectedEmployeeIds.length })}
                                className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[#e0e3e5] bg-[#f8fafc] px-3 py-1 text-xs font-semibold tabular-nums text-[#5e3f3a]"
                            >
                                <Users className="h-3.5 w-3.5" />
                                {selectedEmployeeIds.length}
                            </span>
                        </div>
                    )}
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
                                    <tr className="whitespace-nowrap text-xs font-semibold uppercase tracking-[0.06em] text-[#5e3f3a]">
                                        <th rowSpan={2} className="px-3 py-2 align-bottom">{t("employeeListTitle")}</th>
                                        <th colSpan={2} className="border-b border-[#e0e3e5] px-3 py-2 text-center">{t("colAccumulation")}</th>
                                        <th rowSpan={2} className="px-3 py-2 align-bottom">{t("colTime")}</th>
                                        {showAteLaterColumn && ateLaterHeader}
                                        <th rowSpan={2} className="px-3 py-2 align-bottom">{t("colMealTicketType")}</th>
                                        <th rowSpan={2} className="px-3 py-2 align-bottom">{t("colNote")}</th>
                                        <th rowSpan={2} className="sticky right-0 z-10 bg-white px-2 py-2" />
                                    </tr>
                                    <tr className="whitespace-nowrap border-b border-[#e0e3e5] text-xs font-semibold uppercase tracking-[0.06em] text-[#5e3f3a]">
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
                                                    <td className="px-3 py-2 align-top text-sm text-[#930006]" colSpan={showAteLaterColumn ? 7 : 6}>
                                                        <span className="whitespace-nowrap line-through">
                                                            <span className="mr-1.5 font-semibold text-[#191c1e]">{employee.employeeCode}</span>
                                                            {employee.fullName}
                                                        </span>{" "}
                                                        — {removalReason ? t("willBeRemovedNote", { reason: removalReason }) : t("willBeRemovedNoteNoReason")}
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
                                                <td className="whitespace-nowrap px-3 py-2 align-top text-sm text-[#191c1e]">
                                                    <span className="mr-1.5 font-semibold">{employee.employeeCode}</span>
                                                    {employee.fullName}
                                                </td>
                                                <AccumulationCell t={t} code={employee.employeeCode} kind="Monthly" hours={employee.monthToDate} limit={employee.customMonthlyOtHourLimit ?? setting.monthlyOtHourLimit} sharedLimit={setting.monthlyOtHourLimit} />
                                                <AccumulationCell t={t} code={employee.employeeCode} kind="Yearly" hours={employee.yearToDate} limit={employee.customYearlyOtHourLimit ?? setting.yearlyOtHourLimit} sharedLimit={setting.yearlyOtHourLimit} />
                                                {renderTimeCell(employee.employeeId, currentStartTime, currentEndTime, isSubmitting)}
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
                                                    <MealTicketTypeBadge type={mealTicketType} t={t} />
                                                </td>
                                                {renderNoteCell(employee.employeeId, isSubmitting)}
                                                <td className={stickyActionCellClassName}>
                                                    {selectedEmployeeIds.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => openRemoveEmployee(employee)}
                                                            disabled={isSubmitting}
                                                            title={t(isFormCreator ? "removeFromFormButton" : "removeEmployeeButton")}
                                                            aria-label={t(isFormCreator ? "removeFromFormButton" : "removeEmployeeButton")}
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
                                                    <td className="whitespace-nowrap px-3 py-2 align-top text-sm text-[#191c1e]">
                                                        <span className="mr-1.5 font-semibold">{meta.employeeCode}</span>
                                                        {meta.fullName}
                                                        <span className="ml-1.5 inline-flex align-middle">
                                                            <IconFlag icon={UserPlus} label={t("newlyAddedBadge")} tone="success" />
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 text-center align-top text-sm text-[#8a8f94]">—</td>
                                                    <td className="px-3 py-2 text-center align-top text-sm text-[#8a8f94]">—</td>
                                                    {renderTimeCell(employeeId, currentStartTime, currentEndTime, isSubmitting)}
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
                                                        <MealTicketTypeBadge type={mealTicketType} t={t} />
                                                    </td>
                                                    {renderNoteCell(employeeId, isSubmitting)}
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

                        <FormDialog
                            isOpen={removeTarget !== null}
                            title={t("removeModalTitle", { name: removeTarget?.fullName ?? "" })}
                            danger
                            onClose={closeRemoveEmployee}
                            onSubmit={confirmRemoveEmployee}
                            submitLabel={t("confirmRemove")}
                            cancelLabel={tCommon("cancel")}
                            maxWidthClassName="max-w-md"
                        >
                            <p className="text-sm text-[#5e3f3a]">{t("removeModalDesc")}</p>
                            <label className="block">
                                <span className={fieldLabelClassName}>{t("removeReasonLabel")}<RequiredMark /></span>
                                <textarea
                                    value={removeReasonInput}
                                    onChange={(event) => setRemoveReasonInput(event.target.value)}
                                    rows={3}
                                    className="w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                                />
                            </label>
                        </FormDialog>
                        </div>
                    ) : !isCoreFormInfoFilled || groupIds.length === 0 ? (
                        <div className="flex flex-1 items-center justify-center">
                            <EmptyState icon={Users} title={t("employeeListPlaceholder")} />
                        </div>
                    ) : groupEmployees.length === 0 ? (
                        <div className="flex flex-1 items-center justify-center">
                            <EmptyState icon={Users} title={t("noEmployeesInGroup")} />
                        </div>
                    ) : (
                        <div
                            ref={tableScrollRef}
                            onMouseDown={onTableScrollMouseDown}
                            className="-mx-5 -mb-5 max-h-[70vh] cursor-grab overflow-auto rounded-b-xl border-y lg:max-h-none lg:min-h-0 lg:flex-1 border-[#e0e3e5]"
                        >
                            <table className={tableClassName}>
                                <thead className="sticky top-0 z-10 bg-white">
                                    <tr className="whitespace-nowrap text-xs font-semibold uppercase tracking-[0.06em] text-[#5e3f3a]">
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
                                        <th rowSpan={2} className="px-3 py-2 align-bottom">{t("employeeListTitle")}</th>
                                        <th colSpan={3} className="border-b border-[#e0e3e5] px-3 py-2 text-center">{t("colAccumulation")}</th>
                                        <th rowSpan={2} className="px-3 py-2 align-bottom">{t("colTime")}</th>
                                        {showAteLaterColumn && ateLaterHeader}
                                        <th rowSpan={2} className="px-3 py-2 align-bottom">{t("colMealTicketType")}</th>
                                        <th rowSpan={2} className="px-3 py-2 align-bottom">{t("colNote")}</th>
                                    </tr>
                                    <tr className="whitespace-nowrap border-b border-[#e0e3e5] text-xs font-semibold uppercase tracking-[0.06em] text-[#5e3f3a]">
                                        <th className="px-3 py-2 text-center">{t("colDay")}</th>
                                        <th className="px-3 py-2 text-center">{t("colMonth")}</th>
                                        <th className="px-3 py-2 text-center">{t("colYear")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {groupSections.map((section) => {
                                        const caseCode = otCaseCodeFor(section.selectedIds, section.groupId);
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
                                            <td colSpan={showAteLaterColumn ? 8 : 7} className="px-3 py-2 text-sm">
                                                <span className="inline-flex items-center gap-2">
                                                    <span className="font-semibold text-[#191c1e]">{groupLabel(section.groupId)}</span>
                                                    <span className="text-xs tabular-nums text-[#5e3f3a]">
                                                        {section.selectedIds.length}/{section.employees.length}
                                                    </span>
                                                    {caseCode && (
                                                        <span
                                                            title={t("fieldOtCase")}
                                                            className={caseCode === "TH3" ? th3PillClassName : "inline-flex items-center rounded-full border border-[#e0e3e5] bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[#5e3f3a]"}
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
                                        const dayHours = extraHours && splitHoursByDay(startTime, currentStartTime, currentEndTime, currentDidEat, setting).firstDay;
                                        const overDay = employee.projectedDayToDate + dayHours > dailyOtHourLimit;
                                        const overTh3 = employee.projectedMonthToDate + extraHours > monthLimit || employee.projectedYearToDate + extraHours > yearLimit;
                                        const isTimeOutOfRange =
                                            checked &&
                                            Boolean(startTime && endTime && currentStartTime && currentEndTime) &&
                                            isEmployeeTimeOutOfRange(startTime, endTime, currentStartTime, currentEndTime);
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
                                                <td className="whitespace-nowrap px-3 py-2 align-top text-sm">
                                                    <span className={overlappingEmployeeIds.includes(employee.id) ? "line-through text-[#930006]" : "text-[#191c1e]"}>
                                                        <span className="mr-1.5 font-semibold">{employee.code}</span>
                                                        {employee.lastName} {employee.firstName}
                                                    </span>
                                                    <OverLimitBadges t={t} overDay={overDay} overTh3={overTh3} overlap={overlappingEmployeeIds.includes(employee.id)} />
                                                </td>
                                                <AccumulationCell t={t} code={employee.code} kind="Daily" hours={employee.projectedDayToDate} limit={dailyOtHourLimit} extraHours={dayHours} />
                                                <AccumulationCell t={t} code={employee.code} kind="Monthly" hours={employee.projectedMonthToDate} limit={monthLimit} sharedLimit={setting.monthlyOtHourLimit} extraHours={extraHours} />
                                                <AccumulationCell t={t} code={employee.code} kind="Yearly" hours={employee.projectedYearToDate} limit={yearLimit} sharedLimit={setting.yearlyOtHourLimit} extraHours={extraHours} />
                                                {renderTimeCell(employee.id, currentStartTime, currentEndTime, isSubmitting || !checked, isTimeOutOfRange)}
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
                                                    <MealTicketTypeBadge type={mealTicketType} t={t} />
                                                </td>
                                                {renderNoteCell(employee.id, isSubmitting || !checked)}
                                            </tr>
                                        );
                                    })}
                                    </Fragment>
                                        );
                                    })}
                                    {employeeKeyword && visibleGroupEmployees.length === 0 && (
                                        <tr>
                                            <td colSpan={showAteLaterColumn ? 9 : 8}>
                                                <EmptyState icon={SearchX} title={t("employeeSearchNoResult")} />
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

            {isDeadlineDialogOpen && holidayDeadline && (
                <div className="fixed inset-0 z-50 flex items-center justify-center" onKeyDown={(e) => e.key === "Escape" && setDismissedDeadlineKey(holidayDeadlineKey)}>
                    <div className="fixed inset-0 bg-black/40" onClick={() => setDismissedDeadlineKey(holidayDeadlineKey)} />
                    <div role="alertdialog" aria-modal="true" aria-labelledby="holiday-sign-title" className="z-60 mx-4 w-full max-w-md rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl">
                        <h3 id="holiday-sign-title" className="mb-3 flex items-center gap-2 text-lg font-semibold text-[#191c1e]">
                            <AlertTriangle className="h-5 w-5 shrink-0 text-[#930006]" />
                            {t("holidaySignTitle")}
                            <InfoTooltip text={t("holidaySignReason")} />
                        </h3>
                        <p className="mb-3 text-sm font-semibold text-[#930006]">
                            {t(today > holidayDeadline ? "holidaySignOverdue" : "holidaySignDueToday", { deadline: formatDeadline(holidayDeadline) })}
                        </p>
                        <ul className="mb-5 list-disc space-y-1 pl-5 text-sm text-[#5e3f3a]">
                            <li>{t("holidaySignRuleWeekend")}</li>
                            <li>{t("holidaySignRuleOther")}</li>
                        </ul>
                        <div className="flex justify-end">
                            <button
                                type="button"
                                autoFocus
                                onClick={() => setDismissedDeadlineKey(holidayDeadlineKey)}
                                className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009]"
                            >
                                {t("holidaySignAck")}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <SecondaryPasswordDialog
                isOpen={isPasswordDialogOpen}
                title={t("confirmSaveTitle")}
                label={t("secondaryPasswordLabel")}
                hint={
                    hasSecondaryPassword === false && (
                        <>
                            {t("secondaryPasswordMissingHint")}{" "}
                            <Link href="/ot/secondary-password" className="font-semibold underline hover:text-[#e3000f]">
                                {t("setupLink")}
                            </Link>
                        </>
                    )
                }
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
