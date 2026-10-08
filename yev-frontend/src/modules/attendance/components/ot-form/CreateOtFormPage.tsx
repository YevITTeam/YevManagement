"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
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
    MyCreateScopeItemDto,
    MyProductionCreateScopeItemDto,
    OtFormEmployeeDto,
    OtFormEmployeeInputDto,
    ProcessPartDto,
    UpdateOtFormEmployeeTimeDto,
} from "@/modules/attendance/types/ot-form.dto";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { RequiredMark } from "@/components/ui/RequiredMark";
import TimePicker24h from "@/components/ui/TimePicker24h";
import { UserSignatureApi } from "@/modules/attendance/api/user-signature.api";
import SecondaryPasswordDialog from "@/modules/attendance/components/secondary-password/SecondaryPasswordDialog";
import { SecondaryPasswordApi } from "@/modules/attendance/api/secondary-password.api";
import { getApiErrorMessage } from "@/lib/apiError";
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

function getTodayStr(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

// KHÔNG hỗ trợ ca qua đêm (2026-08-26, theo yêu cầu người dùng) — giờ kết thúc phải SAU giờ bắt đầu
// trong CÙNG ngày, không tự cộng thêm 24h như trước (từng gây tổng giờ dài bất thường, vd 14h→06h ra
// nhầm 16h, mà hệ thống cũng chưa hỗ trợ đúng ca qua đêm ở các chỗ khác — vd ValidateEmployeesAsync so
// TimeOnly trực tiếp không tính ngày). Trả 0 khi không hợp lệ, xem isTimeRangeInvalid để hiện lỗi.
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
    // Ăn uống bắt buộc cho MỌI đơn (2026-09-28, theo yêu cầu người dùng) — không còn checkbox để tắt,
    // BE cũng luôn ghi IsEat=true bất kể giá trị gửi lên.
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
    // Field BE thật (true = có ăn TRONG ca, bị trừ MealBreakDeductionHours) — KHÔNG đổi ý nghĩa
    // (2026-09-28). Đơn Theo chuyền (Sản xuất) không còn cho chọn nữa, luôn hardcode true (xem
    // defaultDidEatForNewEmployee). Đơn Theo Nhóm (Văn phòng) vẫn cho chọn, nhưng UI hiển thị ĐẢO NGƯỢC
    // dưới nhãn "Ăn sau": tích "Ăn sau" (mặc định) = didEat false (không trừ giờ) — xem bảng "Theo
    // Nhóm"/"Sửa đơn" bên dưới.
    didEat: boolean;
    noteVn: string;
    noteJp: string;
}

// Kẻ dọc mờ giữa các cột (th đậm hơn td) để dễ dóng dữ liệu theo hàng ngang khi bảng có nhiều cột.
const tableClassName =
    "min-w-full border-collapse text-left [&_td]:border-r [&_td]:border-[#eef1f3] [&_td:last-child]:border-r-0 [&_th]:border-r [&_th]:border-[#e0e3e5]";
const compactFieldClassName = fieldClassName.replace("h-10", "h-9");
// Cột thao tác (Loại khỏi đơn / Hoàn tác / Huỷ thêm) ghim mép phải bảng — luôn thấy khi cuộn ngang. bg-inherit
// lấy màu nền của dòng (dòng nào cũng phải có nền đặc, xem zebra bên dưới) để che nội dung cuộn phía sau.
const stickyActionCellClassName =
    "sticky right-0 z-10 bg-inherit px-2 py-2 align-middle text-center shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.15)]";

// Ô checkbox dạng chip có icon (thay checkbox+label phẳng) — viền/nền đổi màu khi chọn, cùng ngôn ngữ
// hình ảnh (icon + badge xanh lá) với ProcessPartTile ở OtFormDetail.tsx/OtFormEmailConfirmPage.tsx.
// Dùng <button role="checkbox"> thay vì <input type="checkbox" className="sr-only"> trong <label>:
// input ẩn kiểu sr-only (position: absolute, không có top/left) khi nhận focus (label click luôn focus
// vào input liên kết) khiến trình duyệt tự scrollIntoView input đó — với các trang có bảng nhân viên dài
// phía trên, thao tác này làm cả vùng cuộn <main> nhảy lên, để lại khoảng trắng phía dưới. Button thật
// không có input ẩn nên không gặp side-effect scroll này.
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
    // Có giá trị → màn "Sửa đơn" (đổ sẵn dữ liệu, submit gọi PUT thay vì POST) — docs §1.3.A/§4.1b.
    otFormId?: number;
}

export default function CreateOtFormPage({ otFormId }: CreateOtFormPageProps) {
    const t = useTranslations("Attendance.CreateOtForm");
    const tCommon = useTranslations("Common");
    const router = useRouter();
    const { user } = useAuth();
    const isEditMode = otFormId !== undefined;
    // Admin là role duy nhất có quyền CRUD Danh mục (docs §3, §4.0a) — dùng permission này làm tín hiệu
    // "không giới hạn phạm vi tạo đơn" khi GET /my-create-scopes trả mảng rỗng (phân biệt với tài
    // khoản Nhân viên/Trưởng nhóm chưa được cấu hình gì — trường hợp đó phải chặn hẳn màn này).
    const isUnrestrictedAdmin = hasPermission(user, "Attendance.Department.Create");
    // Tạo đơn THEO CHUYỀN cần quyền riêng (Admin cấu hình theo Chức vụ/từng user) — không có thì ẩn tab "Theo chuyền".
    const canCreateProductionForm = hasPermission(user, "Attendance.OTForm.CreateProduction");
    // Tạo đơn THEO NHÓM cần Attendance.OTForm.Create — tài khoản CHỈ có CreateProduction không được coi
    // là "có thể dùng chế độ Theo Nhóm" nữa (2026-09-28): ẩn hẳn tab "Theo Nhóm" khỏi bộ chuyển chế độ
    // thay vì hiện ra rồi chặn bằng banner lỗi, đúng nguyên tắc "quyền không có thì ẩn đi".
    const canUseGroupMode = isUnrestrictedAdmin || hasPermission(user, "Attendance.OTForm.Create");

    // "Theo Nhóm" (mặc định, hiện tại) hay "Theo chuyền" (Chế tạo, 2026-08-24) — chỉ chọn được lúc TẠO
    // MỚI, đơn đã tạo giữ nguyên chế độ ban đầu (isProductionForm trả về từ BE, không đổi được khi sửa).
    // Mặc định "group", TRỪ tài khoản CHỈ có quyền "Theo chuyền" (không có Attendance.OTForm.Create,
    // không phải Admin) — suy được NGAY từ permission có sẵn trong `user` lúc mount, không cần đợi API
    // my-create-scopes trả lời rồi mới tự chuyển tab như trước (2026-09-28, theo phản hồi người dùng:
    // để kiểu cũ có 1 nhịp/trường hợp vẫn đứng nguyên ở "Theo Nhóm" kèm màn chặn — "mở thẳng UI tạo đơn
    // luôn" mới đúng ý). Effect fetch getMyCreateScopes bên dưới vẫn giữ nhánh tự chuyển làm lưới an
    // toàn thứ 2 cho case hiếm hơn: có Create NHƯNG scope Nhóm thật lại rỗng (chưa gán Employee.GroupId).
    const [formMode, setFormMode] = useState<"group" | "production">(() =>
        canCreateProductionForm && !canUseGroupMode ? "production" : "group"
    );

    const [departments, setDepartments] = useState<DepartmentDto[]>([]);
    const [groups, setGroups] = useState<GroupDto[]>([]);
    const [reasons, setReasons] = useState<ReasonDto[]>([]);
    const [otCases, setOtCases] = useState<OtCaseDto[]>([]);
    const [groupEmployees, setGroupEmployees] = useState<EmployeeDto[]>([]);

    // ── Theo chuyền: bộ lọc + kết quả tìm kiếm ProductionEmployee ────────────
    const [lineOptions, setLineOptions] = useState<ProductionOptionDto[]>([]);
    const [teamOptions, setTeamOptions] = useState<ProductionOptionDto[]>([]);
    const [shiftTeamOptions, setShiftTeamOptions] = useState<ProductionOptionDto[]>([]);
    const [productionLineId, setProductionLineId] = useState<number | "">("");
    const [productionTeamId, setProductionTeamId] = useState<number | "">("");
    const [productionShiftTeamId, setProductionShiftTeamId] = useState<number | "">("");
    const [productionKeyword, setProductionKeyword] = useState("");
    const [productionResults, setProductionResults] = useState<ProductionEmployeeSearchItemDto[]>([]);
    // (Những) tổ hợp Team/Line/Nhóm ca người tạo đang là Line Leader — null = chưa tải xong (2026-09-28,
    // xem effect fetch bên dưới cạnh createScopes).
    const [productionCreateScopes, setProductionCreateScopes] = useState<MyProductionCreateScopeItemDto[] | null>(null);
    const isProductionScopeRestricted = productionCreateScopes !== null && productionCreateScopes.length > 0;
    // Đúng 1 tổ hợp (trường hợp phổ biến — 1 Line Leader phụ trách 1 Line) → khoá cứng cả 3 dropdown.
    // Nhiều hơn 1 tổ hợp (hiếm — Line Leader của nhiều Line) → không khoá cứng, chỉ giới hạn lựa chọn
    // trong đúng các tổ hợp được phép (xem visibleTeamOptions/visibleLineOptions/visibleShiftTeamOptions
    // bên dưới). Khai báo ngay cạnh state (thay vì cạnh effect fetch) vì khối reset-on-change của Team/
    // Line/Nhóm ca ngay bên dưới cần dùng tới trước khi effect fetch được khai báo.
    const isProductionScopeLocked = isProductionScopeRestricted && productionCreateScopes!.length === 1;

    const [departmentId, setDepartmentId] = useState<number | null>(null);
    const [groupId, setGroupId] = useState<number | null>(null);
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

    // Chặn hiện danh sách nhân viên bên dưới (cả 2 chế độ) cho tới khi đã điền đủ thông tin đơn cốt
    // lõi — trước đây "Theo Nhóm" chỉ cần chọn Nhóm là ra danh sách dù Lý do/Trường hợp OT/Ngày/Giờ
    // còn trống, dễ khiến người dùng chọn nhân viên trước rồi mới điền nốt phần trên, sai thứ tự thao
    // tác mong muốn (2026-08-26, yêu cầu người dùng). Không tính groupId ở đây — "Theo Nhóm" còn cần
    // check riêng groupId (giữ nguyên hint chooseGroupFirstHint), "Theo chuyền" không có groupId.
    const isCoreFormInfoFilled = Boolean(departmentId && reasonId && baseOtCaseId && date && startTime && endTime);

    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
    const [employeeOverrides, setEmployeeOverrides] = useState<Record<number, EmployeeOverride>>({});
    // Chỉ dùng khi Sửa đơn — danh sách nhân viên CỐ ĐỊNH lấy thẳng từ đơn (đã lọc bỏ người bị loại),
    // KHÔNG phải từ groupEmployees (chọn theo Nhóm, chỉ dùng lúc Tạo mới). Sửa đơn giờ chỉ được đổi
    // giờ kết thúc thực tế của từng người, không thêm/bớt được ai — xem docs §Sửa đơn: giới hạn chỉ
    // sửa thực tích.
    const [editEmployees, setEditEmployees] = useState<OtFormEmployeeDto[]>([]);

    // Thêm/loại nhân viên trong Sửa đơn (2026-09-04, gộp từ OtFormDetail cũ — xem
    // docs/attendance-module.md §Cây chức vụ & Cây duyệt (mục Sửa đơn)). Cả 2 đều TẠM — chỉ áp dụng thật khi bấm
    // Lưu (PUT gộp 1 lần), không gọi API riêng ngay khi bấm. selectedEmployeeIds/employeeOverrides ở
    // trên tự phản ánh đúng người còn lại (thêm → toggleEmployee thêm vào, loại → lọc bớt khỏi đó) —
    // employeeAddedMeta chỉ lưu mã/tên để hiển thị (người mới thêm chưa có OtFormEmployeeDto đầy đủ từ
    // BE, không có lũy kế tháng/năm cho tới khi Lưu thật).
    const [employeeAddedMeta, setEmployeeAddedMeta] = useState<Record<number, { employeeCode: string; fullName: string }>>({});
    const [addSearchKeyword, setAddSearchKeyword] = useState("");
    const [addSearchResults, setAddSearchResults] = useState<{ employeeId: number; employeeCode: string; fullName: string }[]>([]);
    const [isSearchingAddEmployee, setIsSearchingAddEmployee] = useState(false);
    const [pendingRemovals, setPendingRemovals] = useState<Record<number, string>>({});
    const [removeTarget, setRemoveTarget] = useState<{ employeeId: number; employeeCode: string; fullName: string } | null>(null);
    const [removeReasonInput, setRemoveReasonInput] = useState("");

    const [processPart, setProcessPart] = useState<ProcessPartDto>(emptyProcessPart);
    // true = số phiếu chính/phụ đang do HỆ THỐNG tự tính; chuyển false vĩnh viễn ngay khi người dùng
    // tự gõ đè 1 trong 2 ô, để không ghi đè lại con số họ vừa chỉnh (yêu cầu "vẫn cho phép user sửa").
    const [autoMealTicket, setAutoMealTicket] = useState(true);

    const { setting } = useAttendanceSetting();

    // Giá trị mặc định của field BE thật DidEat khi thêm 1 người MỚI vào đơn (2026-09-28) — đơn Theo
    // chuyền (Sản xuất) hardcode true (ăn uống bắt buộc, không cho chọn); đơn Theo Nhóm (Văn phòng)
    // mặc định false = UI "Ăn sau" tích sẵn (không trừ giờ) — xem EmployeeOverride.didEat.
    const defaultDidEatForNewEmployee = formMode === "production";

    const dailyOtHourLimit = isNonWorkingDay ? setting.dailyOtHourLimitHoliday : setting.dailyOtHourLimit;

    // TH3 is forced when any selected employee's projected month/year accumulation plus this form's own
    // hours passes their month/year limit (own custom limit first, else the shared one). The daily total never
    // forces it. Mirrors OtFormService.ExceedsMonthYearLimitAsync, which is the real guard.
    const exceedsTh3 = useMemo(() => {
        if (isEditMode || !date || !startTime || !endTime) return false;
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
        return selectedEmployeeIds.some((employeeId) => {
            const accumulation = accumulationById.get(employeeId);
            if (!accumulation) return false;
            const hours = computeActualHours(
                employeeOverrides[employeeId]?.startTime || startTime,
                employeeOverrides[employeeId]?.endTime || endTime,
                employeeOverrides[employeeId]?.didEat ?? defaultDidEatForNewEmployee,
                setting
            );
            return accumulation.month + hours > accumulation.monthLimit || accumulation.year + hours > accumulation.yearLimit;
        });
    }, [isEditMode, date, startTime, endTime, groupEmployees, productionResults, selectedEmployeeIds, employeeOverrides, defaultDidEatForNewEmployee, setting]);
    const otCaseCode = exceedsTh3 ? "TH3" : baseOtCaseCode;
    const otCaseId = isEditMode ? loadedOtCaseId : (otCases.find((c) => c.code === otCaseCode)?.id ?? null);

    // Chữ ký không gắn với bước tạo đơn — POST /api/OtForm vào thẳng chuỗi duyệt Cây chức vụ ngay
    // (2026-08-07, Giai đoạn 3.1), chữ ký thật (nếu bước nào đó yêu cầu) chỉ bắt buộc lúc Duyệt. Ở đây
    // chỉ hiện gợi ý mềm, KHÔNG chặn nút Tạo đơn.
    const [hasSignature, setHasSignature] = useState<boolean | null>(null);
    // Mật khẩu cấp 2 — bắt buộc khi Lưu (Tạo mới lẫn Sửa đơn, 2026-08-28), cùng cơ chế Approve/Reject.
    const [hasSecondaryPassword, setHasSecondaryPassword] = useState<boolean | null>(null);
    const [secondaryPassword, setSecondaryPassword] = useState("");
    const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
    const [tableScrollRef, onTableScrollMouseDown] = useDragScroll<HTMLDivElement>();

    const [isLoadingInitial, setIsLoadingInitial] = useState(isEditMode);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [overlappingEmployeeIds, setOverlappingEmployeeIds] = useState<number[]>([]);

    // Bộ phận/Phòng ban CHÍNH user được phép tạo đơn — gọi TRƯỚC khi cho chọn Phòng ban/Bộ phận, để tự
    // điền sẵn (1 phần tử) hoặc thu hẹp dropdown (nhiều phần tử) thay vì bắt chọn từ toàn bộ danh sách
    // (docs §4.0a/§1.3.A). null = đang tải, [] = Admin (bypass) HOẶC tài khoản chưa cấu hình gì.
    const [createScopes, setCreateScopes] = useState<MyCreateScopeItemDto[] | null>(null);

    useEffect(() => {
        DepartmentApi.getAllDepartments().then(setDepartments).catch((err) => console.error(err));
        ReasonApi.getAllReasons().then(setReasons).catch((err) => console.error(err));
        OtCaseApi.getAllOtCases().then(setOtCases).catch((err) => console.error(err));
        ProductionEmployeeApi.getTeamOptions().then(setTeamOptions).catch((err) => console.error(err));
    }, []);

    // Chọn lại Team → Line đang chọn (nếu có) có thể không còn thuộc Team mới, reset về rỗng — so
    // sánh snapshot ngay trong render, không dùng effect để setState (frontend-conventions.md §3). Bỏ qua khi đã
    // khoá cứng theo Line Leader (isProductionScopeLocked, 2026-09-28) — nếu không, lần tự điền sẵn cả
    // 3 giá trị Team/Line/Nhóm ca CÙNG LÚC (effect fetch productionCreateScopes bên dưới) sẽ bị chính
    // khối này xoá mất Line ngay trong cùng 1 lượt render (Team đổi từ "" sang có giá trị vẫn tính là
    // "đổi Team" dù là gán tự động, không phải người dùng tự bấm).
    const [prevProductionTeamId, setPrevProductionTeamId] = useState(productionTeamId);
    if (prevProductionTeamId !== productionTeamId) {
        setPrevProductionTeamId(productionTeamId);
        if (!isProductionScopeLocked) {
            setProductionLineId("");
        }
    }

    // Line = con thật của Team (ProductionLine.TeamId là FK, xem ProductionLine.cs) — tải lại danh
    // sách Line mỗi khi đổi Team để chỉ hiện đúng các Line thuộc Team đó (2026-08-25). Team đang chọn
    // rỗng → BE trả về TOÀN BỘ Line (không lọc).
    useFetchEffect(
        () => ProductionEmployeeApi.getLineOptions(productionTeamId === "" ? undefined : productionTeamId),
        [productionTeamId],
        setLineOptions,
        "Không thể tải danh sách Line."
    );

    // Nhóm ca KHÔNG phải con của Line/Team (1 Line có thể thuộc nhiều Nhóm ca — xem BE
    // ProductionShiftTeam.cs) nên không cascade theo FK như Line được — thay vào đó suy ra TỪ DỮ LIỆU
    // THẬT: chỉ hiện Nhóm ca nào thực sự có người trong đúng Line/Team đang lọc (2026-08-25, yêu cầu
    // người dùng). Đổi Line/Team → Nhóm ca đang chọn có thể không còn hợp lệ, reset về rỗng — so sánh
    // snapshot ngay trong render (frontend-conventions.md §3).
    // Cùng lý do bỏ qua khi khoá cứng như khối reset Line ở trên.
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
        "Không thể tải danh sách Nhóm ca."
    );

    // Tìm kiếm ProductionEmployee theo bộ lọc — chỉ chạy khi đang ở chế độ "Theo chuyền" lúc Tạo mới VÀ
    // đã chọn đủ Team + Line + Nhóm ca (2026-08-25, mở rộng thêm Nhóm ca ngày 2026-09-28 theo yêu cầu
    // người dùng: chọn lẻ tẻ khiến danh sách quá dài — cả nghìn ProductionEmployee — gây giật lag khi
    // render bảng). Chưa đủ 3 điều kiện → không gọi API, hiện hint thay vì bảng (chooseTeamLineFirstHint).
    const canSearchProduction =
        isCoreFormInfoFilled && productionTeamId !== "" && productionLineId !== "" && productionShiftTeamId !== "";
    useFetchEffect(
        () =>
            formMode === "production" && !isEditMode && canSearchProduction
                ? ProductionEmployeeApi.search({
                      productionLineId,
                      teamId: productionTeamId,
                      // canSearchProduction đã đảm bảo Nhóm ca luôn có giá trị (number) trong nhánh này.
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
                // Chỉ tự điền sẵn lúc Tạo mới — Sửa đơn đã đổ dữ liệu thật của đơn, không ghi đè (docs §1.3.A).
                if (!isEditMode && scopes.length === 1) {
                    setDepartmentId(scopes[0].departmentId);
                    setGroupId(scopes[0].groupId);
                }
                // Chức vụ CHỈ có quyền "Theo chuyền" (không có bất kỳ phạm vi Nhóm nào ở "Theo Nhóm") sẽ có
                // scopes rỗng — trước đây formMode mặc định luôn là "group" nên isBlockedNoScope chặn hẳn
                // màn trước khi người dùng kịp bấm sang tab "Theo chuyền", dù canCreateProductionForm=true
                // (2026-09-28, sửa lỗi 2 quyền bị dính nhau). Tự chuyển sang "production" trong đúng trường
                // hợp này; người dùng vẫn tự bấm lại "Theo Nhóm" được nếu muốn (không khoá tab).
                if (!isEditMode && scopes.length === 0 && !isUnrestrictedAdmin && canCreateProductionForm) {
                    setFormMode("production");
                }
            })
            .catch((err) => {
                console.error(err);
                setCreateScopes([]); // Lỗi tải → không chặn màn, coi như không có gợi ý (fallback dropdown tự do).
            });
        // isUnrestrictedAdmin/canCreateProductionForm suy ra từ `user` (ổn định trong vòng đời trang,
        // AuthGuard đã đảm bảo có user trước khi mount) — không cần refetch createScopes mỗi khi đổi.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEditMode]);

    // (Những) tổ hợp Team/Line/Nhóm ca người tạo đang là Line Leader — cùng cơ chế tự điền sẵn/khoá
    // cứng với createScopes ở trên, áp cho 3 dropdown "Theo chuyền" (2026-09-28, theo yêu cầu người
    // dùng: "hiện giờ phải nhập team line nhóm ca ... cũng cố định luôn"). Chỉ gọi khi có quyền
    // CreateProduction — người không có quyền này gọi sẽ luôn 403.
    useEffect(() => {
        if (isEditMode || !canCreateProductionForm) return;
        OtFormApi.getMyProductionCreateScopes()
            .then((scopes) => {
                setProductionCreateScopes(scopes);
                // Bộ phận gắn với CHÍNH người gọi — giống nhau ở mọi phần tử, tự điền sẵn + khoá cứng
                // luôn (xem isProductionDepartmentLocked) dù có 1 hay nhiều tổ hợp Team/Line/Nhóm ca
                // (2026-09-28, theo yêu cầu người dùng: "các chỗ thuộc Nhóm/thông tin đi kèm người tạo
                // đơn thì cố định hết").
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
                setProductionCreateScopes([]); // Lỗi tải → không chặn màn, coi như không có gợi ý (fallback dropdown tự do).
            });
    }, [isEditMode, canCreateProductionForm]);

    const isScopeRestricted = createScopes !== null && createScopes.length > 0;
    // Chỉ khoá cứng dropdown lúc Tạo mới — Sửa đơn vẫn cho đổi Bộ phận/Phòng ban trong phạm vi (docs §4.1b).
    const isScopeLocked = !isEditMode && isScopeRestricted && createScopes!.length === 1;
    // Mảng rỗng mà KHÔNG phải Admin → tài khoản chưa được cấp quyền tạo đơn cho Bộ phận nào — chặn hẳn
    // màn "Tạo đơn tăng ca" thay vì cho vào form rồi chọn linh tinh rồi nhận lỗi 400 (docs §4.0a). CHỈ
    // áp dụng cho chế độ "Theo Nhóm" — "Theo chuyền" không cần createScopes (2026-08-24, xem
    // OtFormService.CreateProductionFormAsync: Admin hoặc chính người có tên trong đơn, không cần Group).
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
        if (!isScopeRestricted) return groups.map((g) => ({ id: g.id, label: g.groupNameVn }));
        const options = createScopes!
            .filter((s) => !departmentId || s.departmentId === departmentId)
            .map((s) => ({ id: s.groupId, label: s.groupNameVn }));
        if (groupId && !options.some((o) => o.id === groupId)) {
            const existing = groups.find((g) => g.id === groupId);
            if (existing) options.push({ id: existing.id, label: existing.groupNameVn });
        }
        return options;
    }, [isScopeRestricted, createScopes, groups, departmentId, groupId]);

    // 3 dropdown "Theo chuyền" bị giới hạn trong đúng các tổ hợp Line Leader được phép khi
    // isProductionScopeRestricted — mirror visibleDepartments/visibleGroups ở trên, nhưng lấy dữ liệu
    // trực tiếp từ productionCreateScopes thay vì gọi lại API catalog (teamOptions/lineOptions/
    // shiftTeamOptions vẫn được tải như cũ, chỉ không dùng tới khi bị giới hạn). Line phụ thuộc Team đã
    // chọn, Nhóm ca phụ thuộc cả Team lẫn Line đã chọn — cùng thứ bậc lọc với 3 dropdown gốc.
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
        if (isEditMode) return; // Sửa đơn không ký lại — không cần kiểm tra chữ ký.
        UserSignatureApi.getMySignature()
            .then((data) => setHasSignature(Boolean(data)))
            .catch(() => setHasSignature(false));
    }, [isEditMode]);

    // Mật khẩu cấp 2 áp dụng CẢ 2 chế độ (Tạo mới lẫn Sửa đơn) — khác chữ ký ở trên.
    useEffect(() => {
        SecondaryPasswordApi.getMyStatus()
            .then((data) => setHasSecondaryPassword(data.isRegistered))
            .catch(() => setHasSecondaryPassword(false));
    }, []);

    // Đổ sẵn dữ liệu đơn khi Sửa — set state trực tiếp (không qua handler) để KHÔNG bị 2 effect bên
    // dưới tự xoá lựa chọn Bộ phận/Nhân viên vừa đổ sẵn.
    useEffect(() => {
        if (!isEditMode || !otFormId) return;
        OtFormApi.getOtFormById(otFormId)
            .then((data) => {
                if (!data.isEditable) {
                    setLoadError(t("notEditableError"));
                    return;
                }
                // Đồng bộ lại chế độ hiển thị đúng theo đơn (2026-08-28, sửa lỗi thiếu sót — comment ở
                // khai báo formMode nói rõ ý định "giữ nguyên chế độ ban đầu" nhưng trước đó chưa từng
                // set lại state này khi tải đơn để sửa, khiến form luôn hiện lại đúng UI "Theo Nhóm" mặc
                // định dù đang sửa đơn "theo chuyền" — dropdown Nhóm hiện thừa trống, thiếu hẳn cột
                // Line/Team/Nhóm ca ở bảng nhân viên bên dưới).
                setFormMode(data.isProductionForm ? "production" : "group");
                setDepartmentId(data.departmentId);
                setGroupId(data.groupId);
                setReasonId(data.reasonId);
                setLoadedOtCaseId(data.otCaseId);
                setDate(data.date);
                setStartTime(data.startTime.slice(0, 5));
                setEndTime(data.endTime.slice(0, 5));
                setSubReason(data.subReason ?? "");
                // Người đã bị 1 cấp duyệt loại khỏi đơn (isRemoved) KHÔNG được đưa vào danh sách sửa —
                // BE giờ CHỈ chấp nhận đúng tập nhân viên đang active, đưa cả người đã bị loại vào sẽ bị
                // 400 "danh sách nhân viên đã thay đổi" (xem UpdateAsync).
                const activeEmployees = data.employees.filter((e) => !e.isRemoved);
                setEditEmployees(activeEmployees);
                setSelectedEmployeeIds(activeEmployees.map((e) => e.employeeId));
                setEmployeeOverrides(
                    Object.fromEntries(
                        activeEmployees.map((e) => [
                            e.employeeId,
                            { startTime: e.startTime.slice(0, 5), endTime: e.endTime.slice(0, 5), didEat: e.didEat, noteVn: e.noteVn ?? "", noteJp: e.noteJp ?? "" },
                        ])
                    )
                );
                setProcessPart(data.processPart ?? emptyProcessPart);
            })
            .catch((err) => {
                console.error(err);
                setLoadError(getApiErrorMessage(err, t("loadEditError")));
            })
            .finally(() => setIsLoadingInitial(false));
        // Reloading on a locale change would discard the edits in progress.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEditMode, otFormId]);

    // Cascading Bộ phận theo Phòng ban — chỉ TẢI danh sách, không tự xoá lựa chọn (việc xoá do handler
    // người dùng chủ động đổi Phòng ban quyết định, xem handleDepartmentChange) để không phá dữ liệu
    // vừa đổ sẵn lúc Sửa đơn (docs/attendance-module.md §API/§8).
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

    // Tải nhân viên theo Bộ phận — không tự xoá lựa chọn (lý do như trên).
    const [prevGroupId, setPrevGroupId] = useState(groupId);
    if (prevGroupId !== groupId) {
        setPrevGroupId(groupId);
        if (!groupId) setGroupEmployees([]);
    }

    useEffect(() => {
        // Sửa đơn không cần tải toàn bộ nhân viên trong Nhóm — danh sách để sửa lấy thẳng từ đơn
        // (editEmployees), không cho chọn thêm người mới nữa.
        if (!groupId || isEditMode) return;
        // Truyền kèm `date` (ngày trên đơn đang tạo) — Dự kiến hiển thị ở bảng chọn nhân viên phải scope
        // đúng theo tháng/năm của đơn NÀY, không phải hôm nay thực tế (2026-08-19, xem docs §Lũy kế Dự
        // kiến); đổi ngày phải tải lại để badge cập nhật đúng tháng mới.
        EmployeeApi.getEmployeesByGroup(groupId, date || undefined)
            .then(setGroupEmployees)
            .catch((err) => console.error(err));
    }, [groupId, isEditMode, date]);

    const totalHour = useMemo(() => computeTotalHour(startTime, endTime), [startTime, endTime]);
    const isTimeRangeInvalid = Boolean(startTime && endTime && toMinutes(endTime) <= toMinutes(startTime));

    // Tóm tắt Line/Team/Nhóm ca của đơn "theo chuyền" khi Sửa (theo yêu cầu người dùng, 2026-08-28) —
    // hiện ngay trong "Thông tin đơn" thay vì phải cuộn xuống bảng nhân viên mới thấy. Gộp theo GIÁ TRỊ
    // DUY NHẤT trong đơn — thường 1 đơn chỉ có đúng 1 Line/Team/Nhóm ca, nhưng vẫn liệt kê đủ nếu lỡ có
    // nhiều giá trị khác nhau (đơn thêm người sau, khác Line/Team/Nhóm ca với người tạo ban đầu) thay vì
    // chỉ hiện 1 giá trị gây hiểu nhầm.
    const editProductionSummary = useMemo(() => {
        if (!isEditMode || formMode !== "production") return null;
        const distinct = (values: (string | null)[]) => Array.from(new Set(values.filter((v): v is string => Boolean(v))));
        return {
            lines: distinct(editEmployees.map((e) => e.blockCodeSnapshot)),
            teams: distinct(editEmployees.map((e) => e.teamCodeSnapshot)),
            shiftTeams: distinct(editEmployees.map((e) => e.shiftTeamCodeSnapshot)),
        };
    }, [isEditMode, formMode, editEmployees]);

    // Tự tính số phiếu ăn theo giờ OT THỰC TẾ của từng người đang chọn — redesign 3 bậc (2026-08-26,
    // xem modules/attendance/lib/mealTicket.ts + docs §Phiếu ăn): thực tích < sàn -> không phiếu; sàn..
    // mốc chính -> Phụ; >= mốc chính -> Chính. Ca khớp đúng khung sớm luôn tính Phụ. Sữa KHÔNG tự tính
    // — luôn để người lập đơn tự nhập.
    const mealTicketCounts = useMemo(() => {
        let main = 0;
        let secondary = 0;
        for (const employeeId of selectedEmployeeIds) {
            const employeeEndTime = employeeOverrides[employeeId]?.endTime || endTime;
            const didEat = employeeOverrides[employeeId]?.didEat ?? defaultDidEatForNewEmployee;
            const employeeStartTime = employeeOverrides[employeeId]?.startTime || startTime;
            const ticketType = computeMealTicketType(employeeStartTime, employeeEndTime, didEat, setting);
            if (ticketType === MEAL_TICKET_MAIN) main += 1;
            else if (ticketType === MEAL_TICKET_SECONDARY) secondary += 1;
        }
        return { main, secondary };
    }, [selectedEmployeeIds, employeeOverrides, startTime, endTime, setting, defaultDidEatForNewEmployee]);

    // Đồng bộ kết quả tự tính vào ô nhập — so sánh snapshot NGAY TRONG RENDER thay vì dùng effect
    // (frontend-conventions.md §3: không setState đồng bộ trong useEffect). Dừng đồng bộ ngay khi người dùng tự gõ
    // đè (autoMealTicket=false), và không chạy ở màn Sửa đơn vì khối này đã bị khoá.
    const autoMealTicketKey = `${mealTicketCounts.main}/${mealTicketCounts.secondary}`;
    const [prevAutoMealTicketKey, setPrevAutoMealTicketKey] = useState(autoMealTicketKey);
    if (prevAutoMealTicketKey !== autoMealTicketKey) {
        setPrevAutoMealTicketKey(autoMealTicketKey);
        if (autoMealTicket && !isEditMode) {
            setProcessPart((current) => ({
                ...current,
                mainTicketCount: mealTicketCounts.main,
                secondaryTicketCount: mealTicketCounts.secondary,
            }));
        }
    }

    // Người dùng bấm "Tính lại" sau khi đã tự sửa tay — bật lại chế độ tự tính và áp ngay con số hiện tại.
    const recalculateMealTickets = () => {
        setAutoMealTicket(true);
        setProcessPart((current) => ({
            ...current,
            mainTicketCount: mealTicketCounts.main,
            secondaryTicketCount: mealTicketCounts.secondary,
        }));
    };

    // Kiểm tra trùng giờ tăng ca (chỉ chạy khi đã nhập đủ ngày, giờ bắt đầu và có ít nhất 1 nhân viên).
    // setState CHỈ được gọi trong callback (setTimeout/.then/.catch), không đồng bộ ở thân effect
    // (frontend-conventions.md §3 — react-hooks/set-state-in-effect).
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

    const toggleEmployee = (employeeId: number) => {
        setSelectedEmployeeIds((current) =>
            current.includes(employeeId) ? current.filter((id) => id !== employeeId) : [...current, employeeId]
        );
        setEmployeeOverrides((current) =>
            current[employeeId]
                ? current
                : { ...current, [employeeId]: { startTime: "", endTime, didEat: defaultDidEatForNewEmployee, noteVn: "", noteJp: "" } }
        );
    };

    // Chọn/bỏ chọn HÀNG LOẠT toàn bộ danh sách đang hiện (bảng Theo Nhóm hoặc Theo chuyền) — tích từng
    // dòng một quá chậm khi danh sách dài (yêu cầu người dùng 2026-08-25). Chỉ tác động tới những người
    // đang hiển thị theo bộ lọc hiện tại, KHÔNG đụng tới lựa chọn đã có từ bộ lọc khác trước đó (VD đổi
    // Line/Team giữa chừng vẫn giữ nguyên người đã chọn ở Line/Team trước).
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

    const handleEmployeeDidEatChange = (employeeId: number, didEat: boolean) => {
        setEmployeeOverrides((current) => ({
            ...current,
            [employeeId]: {
                startTime: current[employeeId]?.startTime ?? "",
                endTime: current[employeeId]?.endTime ?? endTime,
                didEat,
                noteVn: current[employeeId]?.noteVn ?? "",
                noteJp: current[employeeId]?.noteJp ?? "",
            },
        }));
    };

    // Tìm nhân viên để thêm vào đơn đang sửa (2026-09-04) — chỉ theo từ khoá, KHÔNG lọc theo Line/Nhóm
    // ca ở FE (khác bảng chọn lúc Tạo mới): BE (UpdateAsync) mới là nơi chặn thật nhân viên khác Line/
    // Nhóm ca của đơn, ở đây giữ đơn giản như search cũ của OtFormDetail — chọn sai sẽ bị BE báo lỗi rõ
    // ràng khi Lưu.
    const handleSearchAddEmployee = async () => {
        setIsSearchingAddEmployee(true);
        try {
            const activeIds = new Set(selectedEmployeeIds);
            const keyword = addSearchKeyword.trim();
            if (formMode === "production") {
                const results = await ProductionEmployeeApi.search({ keyword: keyword || undefined, date: date || undefined });
                setAddSearchResults(
                    results
                        .filter((item) => !activeIds.has(item.employeeId))
                        .map((item) => ({ employeeId: item.employeeId, employeeCode: item.employeeCode, fullName: item.fullName }))
                );
            } else if (groupId) {
                const results = await EmployeeApi.getEmployeesByGroup(groupId, date || undefined);
                const lowerKeyword = keyword.toLowerCase();
                setAddSearchResults(
                    results
                        .filter((item) => !activeIds.has(item.id))
                        .filter(
                            (item) =>
                                !lowerKeyword ||
                                item.code.toLowerCase().includes(lowerKeyword) ||
                                `${item.lastName} ${item.firstName}`.toLowerCase().includes(lowerKeyword)
                        )
                        .map((item) => ({ employeeId: item.id, employeeCode: item.code, fullName: `${item.lastName} ${item.firstName}` }))
                );
            }
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("productionSearchError")));
        } finally {
            setIsSearchingAddEmployee(false);
        }
    };

    const handlePickAddEmployee = (item: { employeeId: number; employeeCode: string; fullName: string }) => {
        toggleEmployee(item.employeeId);
        setEmployeeAddedMeta((current) => ({ ...current, [item.employeeId]: { employeeCode: item.employeeCode, fullName: item.fullName } }));
        setAddSearchResults((current) => current.filter((r) => r.employeeId !== item.employeeId));
    };

    // Bỏ 1 người vừa thêm TẠM (chưa Lưu) — chỉ là huỷ chọn, không cần lý do vì chưa từng ghi vào đơn.
    const cancelAddedEmployee = (employeeId: number) => {
        setSelectedEmployeeIds((current) => current.filter((id) => id !== employeeId));
        setEmployeeAddedMeta((current) => {
            const next = { ...current };
            delete next[employeeId];
            return next;
        });
    };

    // Loại 1 người ĐÃ CÓ SẴN trong đơn — bắt buộc lý do (đơn là chứng từ), chỉ áp dụng TẠM cho tới khi
    // Lưu (xem UpdateOtFormDto.removedEmployees).
    const openRemoveEmployee = (employee: OtFormEmployeeDto) => {
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
        setGroupId(null);
        setSelectedEmployeeIds([]);
        setEmployeeOverrides({});
    };

    const handleGroupChange = (nextId: number | "") => {
        setGroupId(nextId === "" ? null : nextId);
        setSelectedEmployeeIds([]);
        setEmployeeOverrides({});
    };

    const handleModeChange = (nextMode: "group" | "production") => {
        setFormMode(nextMode);
        setGroupId(null);
        setSelectedEmployeeIds([]);
        setEmployeeOverrides({});
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        // Sửa đơn: mọi field khác đã bị khoá disabled từ trước (không đổi được), chỉ còn kiểm tra có
        // ít nhất 1 người. Tạo mới: vẫn cần đủ các field bắt buộc như cũ — groupId CHỈ bắt buộc ở chế
        // độ "Theo Nhóm" (2026-08-24, "Theo chuyền" không có Group cố định).
        if (
            !isEditMode &&
            ((formMode === "group" && !groupId) || !departmentId || !reasonId || !otCaseId || !date || !startTime || !endTime)
        ) {
            toast.error(t("requiredFieldsError"));
            return;
        }
        if (selectedEmployeeIds.length === 0) {
            toast.error(t("requiredFieldsError"));
            return;
        }
        if (!isEditMode && isTimeRangeInvalid) {
            toast.error(t("endTimeBeforeStartError"));
            return;
        }
        if (hasSecondaryPassword === false) {
            toast.error(t("secondaryPasswordMissingError"));
            return;
        }

        // Không hỗ trợ ca qua đêm (2026-08-26) — giờ kết thúc của mỗi người luôn nằm trong CÙNG ngày,
        // giữa giờ bắt đầu và giờ kết thúc của đơn, không còn cộng thêm 24h như trước.
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

        // Mật khẩu cấp 2 nhập trong popup ngay lúc chốt (không còn ô nhập cố định trên trang) —
        // performSubmit chạy khi bấm "Xác nhận" trong popup.
        setSecondaryPassword("");
        setIsPasswordDialogOpen(true);
    };

    const performSubmit = async () => {
        if (!secondaryPassword) {
            toast.error(t("secondaryPasswordRequiredError"));
            return;
        }
        setIsSubmitting(true);
        try {
            let result;
            if (isEditMode && otFormId) {
                const employees: UpdateOtFormEmployeeTimeDto[] = selectedEmployeeIds.map((employeeId) => ({
                    employeeId,
                    startTime: `${employeeOverrides[employeeId]?.startTime || startTime}:00`,
                    endTime: `${employeeOverrides[employeeId]?.endTime || endTime}:00`,
                    didEat: employeeOverrides[employeeId]?.didEat ?? defaultDidEatForNewEmployee,
                    noteVn: employeeOverrides[employeeId]?.noteVn?.trim() ? employeeOverrides[employeeId].noteVn.trim() : null,
                    noteJp: employeeOverrides[employeeId]?.noteJp?.trim() ? employeeOverrides[employeeId].noteJp.trim() : null,
                }));
                // Thêm/loại nhân viên đã gộp vào đây (2026-09-04) — selectedEmployeeIds đã tự phản ánh
                // đúng người còn lại (toggleEmployee/pendingRemovals cùng cập nhật nó), removedEmployees
                // build từ pendingRemovals (lý do bắt buộc, xem openRemoveEmployee/confirmRemoveEmployee).
                const removedEmployees = Object.entries(pendingRemovals).map(([employeeId, reason]) => ({
                    employeeId: Number(employeeId),
                    reason,
                }));
                result = await OtFormApi.updateOtForm(otFormId, { employees, removedEmployees, secondaryPassword });
            } else {
                const employees: OtFormEmployeeInputDto[] = selectedEmployeeIds.map((employeeId) => ({
                    employeeId,
                    startTime: `${employeeOverrides[employeeId]?.startTime || startTime}:00`,
                    endTime: `${employeeOverrides[employeeId]?.endTime || endTime}:00`,
                    didEat: employeeOverrides[employeeId]?.didEat ?? defaultDidEatForNewEmployee,
                    noteVn: employeeOverrides[employeeId]?.noteVn?.trim() ? employeeOverrides[employeeId].noteVn.trim() : null,
                    noteJp: employeeOverrides[employeeId]?.noteJp?.trim() ? employeeOverrides[employeeId].noteJp.trim() : null,
                }));
                result = await OtFormApi.createOtForm({
                    groupId: formMode === "production" ? null : groupId!,
                    isProductionForm: formMode === "production",
                    departmentId: departmentId!,
                    reasonId: reasonId!,
                    otCaseId: otCaseId!,
                    startTime: `${startTime}:00`,
                    endTime: `${endTime}:00`,
                    subReason: subReason.trim() || null,
                    totalHour,
                    date,
                    employees,
                    // Ăn uống bắt buộc cho MỌI đơn (2026-09-28) — luôn gửi ProcessPart, BE cũng luôn ghi
                    // IsEat=true dù gửi gì lên (phòng vệ 2 lớp).
                    processPart: { ...processPart, isEat: true },
                    secondaryPassword,
                });
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
        // Vẫn hiện tiêu đề + tab đổi chế độ (nếu có quyền "Theo chuyền") thay vì chặn nguyên trang — trước
        // đây return sớm 1 khối duy nhất khiến người có CẢ 2 quyền nhưng đang lỡ đứng ở tab "Theo Nhóm"
        // (không có phạm vi Nhóm nào) bị kẹt luôn, không còn cách nào bấm quay lại tab "Theo chuyền"
        // (2026-09-28, sửa cùng lỗi 2 quyền bị dính nhau ở trên).
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
            {/* Gộp tiêu đề + tab đổi chế độ chung 1 hàng thay vì tách 2 khối riêng (tab cũ là 1 thanh
                full-width viền dưới, chiếm nguyên 1 hàng cho việc chỉ có 2 lựa chọn) — đổi tab sang dạng
                segmented control gọn để tiết kiệm chiều cao (2026-09-28, theo yêu cầu người dùng). */}
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

            {/* isScopeLocked (chỉ đúng 1 phạm vi) không còn banner riêng nữa — ô "Đơn vị" bên dưới đã bị
                khoá + tự điền sẵn đúng thông tin này rồi, hiện thêm banner là thừa (2026-09-28, theo yêu
                cầu người dùng, role Staff). Nhiều phạm vi (isScopeRestricted) vẫn cần banner vì danh sách
                phạm vi được phép không hiện ở đâu khác trên form. */}
            {!isEditMode && isScopeRestricted && !isScopeLocked && (
                <div className="rounded-lg border border-[#e0e3e5] bg-[#f8fafc] px-4 py-3 text-sm text-[#5e3f3a]">
                    {t("scopeRestrictedMessage", { groupNames: createScopes!.map((s) => s.groupNameVn).join(", ") })}
                </div>
            )}

            {/* Cùng nguyên tắc với banner Nhóm ở trên — isProductionScopeLocked (đúng 1 tổ hợp) không cần
                banner vì 3 dropdown Team/Line/Nhóm ca bên dưới đã tự điền sẵn + khoá cứng rồi. Nhiều tổ
                hợp (hiếm — Line Leader của nhiều Line) mới cần banner để biết còn được chọn giữa các tổ
                hợp nào (2026-09-28). */}
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
                                // "Theo Nhóm" khoá theo isScopeLocked (createScopes); "Theo chuyền" khoá theo
                                // isProductionScopeRestricted (productionCreateScopes) — Bộ phận của Line
                                // Leader luôn xác định được ngay khi có ít nhất 1 tổ hợp trả về, không cần
                                // đợi đúng 1 tổ hợp như Team/Line/Nhóm ca (2026-09-28, xem MyProductionCreateScopeItemDto).
                                disabled={isSubmitting || isEditMode || (formMode === "group" ? isScopeLocked : isProductionScopeRestricted)}
                            />
                        </label>

                        {formMode === "group" && (
                            <label className="block">
                                <span className={fieldLabelClassName}>{t("fieldGroup")}<RequiredMark /></span>
                                <SearchableSelect
                                    options={visibleGroups.map((g) => ({ value: g.id, label: g.label, searchText: g.label.toLowerCase() }))}
                                    value={groupId ?? ""}
                                    onChange={handleGroupChange}
                                    placeholder={departmentId ? t("fieldGroupPlaceholder") : t("fieldGroupPlaceholderNeedDepartment")}
                                    disabled={isSubmitting || isScopeLocked || !departmentId || isEditMode}
                                />
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

                        <label className="block">
                            <span className={fieldLabelClassName}>{t("fieldDate")}<RequiredMark /></span>
                            <input
                                type="date"
                                value={date}
                                onChange={(event) => setDate(event.target.value)}
                                disabled={isSubmitting || isEditMode}
                                required
                                min={isEditMode ? undefined : getTodayStr()}
                                className={fieldClassName}
                            />
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>{t("fieldTotalHour")}</span>
                            <input value={totalHour} disabled className={fieldClassName} />
                            {/* Cảnh báo SỚM, không tự chặn ở đây — người tạo có thể set giờ kết thúc riêng ngắn
                                hơn cho từng nhân viên (employeeOverrides), nên tổng giờ CẢ đơn dài hơn ngưỡng/ngày
                                không hẳn đã sai (2026-08-26). */}
                            {!isTimeRangeInvalid && totalHour > dailyOtHourLimit && (
                                <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-[#930006]">
                                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                    {t("totalHourOverLimitWarning", { limit: dailyOtHourLimit })}
                                </p>
                            )}
                        </label>

                        {/* Gộp Giờ bắt đầu + Giờ kết thúc chung 1 ô lưới (2026-08-26) — ô nhập giờ đã đổi
                            sang gõ số nên hẹp hơn hẳn dropdown cũ, để riêng mỗi ô 1 cột lưới thừa nhiều
                            khoảng trắng; gộp lại còn đẩy "Tổng số giờ" trồi lên cùng hàng thay vì rơi
                            xuống hàng riêng gần như trống (theo yêu cầu người dùng). */}
                        <div className="block sm:col-span-2">
                            <div className="grid grid-cols-2 gap-3">
                                <label className="block">
                                    <span className={fieldLabelClassName}>{t("fieldStartTime")}<RequiredMark /></span>
                                    <TimePicker24h value={startTime} onChange={setStartTime} disabled={isSubmitting || isEditMode} />
                                </label>
                                <label className="block">
                                    <span className={fieldLabelClassName}>{t("fieldEndTime")}<RequiredMark /></span>
                                    <TimePicker24h value={endTime} onChange={setEndTime} disabled={isSubmitting || isEditMode} />
                                </label>
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
                                disabled={isSubmitting || isEditMode}
                            />
                        </label>

                        <label className="block sm:col-span-2">
                            <span className={fieldLabelClassName}>{t("fieldOtCase")}<RequiredMark /></span>
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
                            {!isEditMode && otCaseCode && (
                                <p className="mt-1 text-xs text-[#8a8f94]">
                                    {t(exceedsTh3 ? "otCaseAutoHintTh3" : isNonWorkingDay ? "otCaseAutoHintNonWorking" : "otCaseAutoHintWorking")}
                                </p>
                            )}
                        </label>

                        
                    </div>

                    <label className="block">
                        <span className="mb-1 block text-xs font-semibold text-[#5e3f3a]">{t("fieldSubReason")}</span>
                        <textarea
                            value={subReason}
                            onChange={(event) => setSubReason(event.target.value)}
                            disabled={isSubmitting || isEditMode}
                            rows={2}
                            className="w-full resize-none rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
                        />
                    </label>

                    <div className="space-y-2.5 border-t border-[#e0e3e5] pt-3">
                    {/* "Yêu cầu hỗ trợ khác" không còn checkbox bật/tắt cả khối (2026-09-28, theo yêu
                        cầu người dùng) — "Ăn uống" nay bắt buộc cho MỌI đơn nên khối này luôn hiện, chỉ
                        còn 2 mục Xe đưa đón/Phòng photo là thật sự tuỳ chọn. */}
                    <span className="block text-xs font-semibold uppercase tracking-[0.1em] text-[#5e3f3a]">
                        {t("otherSupportLabel")}
                    </span>

                    <div className="space-y-2.5">
                        <div className="flex flex-nowrap gap-1.5">
                            <ToggleOptionCard
                                icon={<Car size={13} />}
                                label={t("transportationLabel")}
                                checked={processPart.isTransportation}
                                onChange={(value) => setProcessPart((current) => ({ ...current, isTransportation: value }))}
                                disabled={isSubmitting || isEditMode}
                            />
                            <ToggleOptionCard
                                icon={<Printer size={13} />}
                                label={t("copyRoomLabel")}
                                checked={processPart.isUseCopyRoom}
                                onChange={(value) => setProcessPart((current) => ({ ...current, isUseCopyRoom: value }))}
                                disabled={isSubmitting || isEditMode}
                            />
                        </div>

                        <div className="space-y-1.5">
                            {/* Dải trạng thái tự tính. Hệ thống tự điền số phiếu chính/phụ theo giờ OT từng người;
                                người lập đơn gõ đè được, khi đó hiện nút "Tính lại" để quay về số hệ thống gợi ý.
                                Quy tắc ngưỡng giờ không còn hiện ở đây (gọn giao diện, theo yêu cầu người dùng). */}
                            <div className="flex items-center justify-between gap-2 text-xs">
                                <span className="text-xs font-semibold text-[#5e3f3a]">{t("mealTicketCountsTitle")}</span>
                                {!isEditMode &&
                                    (autoMealTicket ? (
                                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-700">
                                            <Check className="h-3 w-3" /> {t("mealTicketAutoBadge")}
                                        </span>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={recalculateMealTickets}
                                            disabled={isSubmitting}
                                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-2.5 py-1 font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <RefreshCw className="h-3.5 w-3.5" /> {t("mealTicketRecalcButton")}
                                        </button>
                                    ))}
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                            <label className="block">
                                <span className="mb-1 block whitespace-nowrap text-xs font-semibold text-[#5e3f3a]">{t("mainTicketLabel")}</span>
                                <input
                                    type="number"
                                    min={0}
                                    // Sửa đơn: khối này bị khoá không gửi lên (BE tự tính lại theo
                                    // đúng giờ mới sau khi lưu — RecalculateMealTicketCountsAsync),
                                    // nên LUÔN hiện số tự tính SỐNG theo employeeOverrides hiện tại
                                    // thay vì số tĩnh lúc tải trang — tránh gây hiểu nhầm "sửa giờ mà
                                    // không thấy phiếu đổi theo" (2026-08-28, theo phản hồi người dùng).
                                    value={isEditMode ? mealTicketCounts.main : processPart.mainTicketCount}
                                    onChange={(event) => {
                                        setAutoMealTicket(false);
                                        setProcessPart((current) => ({ ...current, mainTicketCount: Number(event.target.value) }));
                                    }}
                                    disabled={isSubmitting || isEditMode}
                                    className={`${compactFieldClassName} text-center`}
                                />
                            </label>
                            <label className="block">
                                <span className="mb-1 block whitespace-nowrap text-xs font-semibold text-[#5e3f3a]">{t("secondaryTicketLabel")}</span>
                                <input
                                    type="number"
                                    min={0}
                                    value={isEditMode ? mealTicketCounts.secondary : processPart.secondaryTicketCount}
                                    onChange={(event) => {
                                        setAutoMealTicket(false);
                                        setProcessPart((current) => ({
                                            ...current,
                                            secondaryTicketCount: Number(event.target.value),
                                        }));
                                    }}
                                    disabled={isSubmitting || isEditMode}
                                    className={`${compactFieldClassName} text-center`}
                                />
                            </label>
                            <label className="block">
                                <span className="mb-1 block whitespace-nowrap text-xs font-semibold text-[#5e3f3a]">{t("milkLabel")}</span>
                                <input
                                    type="number"
                                    min={0}
                                    value={processPart.milkCount}
                                    onChange={(event) =>
                                        setProcessPart((current) => ({ ...current, milkCount: Number(event.target.value) }))
                                    }
                                    disabled={isSubmitting || isEditMode}
                                    className={`${compactFieldClassName} text-center`}
                                />
                            </label>
                            </div>
                        </div>

                        <label className="block">
                            <span className="mb-1 block whitespace-nowrap text-xs font-semibold text-[#5e3f3a]">{t("anotherSuggestionVnLabel")}</span>
                            <input
                                value={processPart.anotherSuggestionVn ?? ""}
                                onChange={(event) =>
                                    setProcessPart((current) => ({ ...current, anotherSuggestionVn: event.target.value }))
                                }
                                disabled={isSubmitting || isEditMode}
                                className={compactFieldClassName}
                            />
                        </label>
                    </div>
                    </div>
                </section>

                <section className="flex flex-col gap-4 rounded-xl border border-[#e0e3e5] bg-white p-5 shadow-sm lg:h-0 lg:min-h-full">
                    <div className="flex items-center justify-between gap-2">
                        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                            {t("employeeListTitle")}
                        </h2>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e0e3e5] bg-[#f8fafc] px-3 py-1 text-xs font-medium text-[#5e3f3a]">
                            <Users className="h-3.5 w-3.5" />
                            {t("selectedCount", { count: selectedEmployeeIds.length })}
                        </span>
                    </div>
                    {isEditMode ? (
                        // Sửa đơn (2026-09-04, gộp thêm/xóa nhân viên từ OtFormDetail cũ — xem
                        // docs/attendance-module.md §Cây chức vụ & Cây duyệt (mục Sửa đơn)): editEmployees vẫn là
                        // danh sách GỐC lúc tải đơn — thêm/loại ở đây chỉ TẠM (selectedEmployeeIds/
                        // pendingRemovals), áp dụng thật + log lại 1 lần khi bấm "Lưu thay đổi" bên dưới
                        // (1 lần nhập mật khẩu cấp 2 cho toàn bộ thay đổi trong phiên sửa).
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
                                        {/* Bỏ hẳn cột "Có ăn" khi đang sửa đơn Theo chuyền (2026-09-28) — Ăn
                                            uống bắt buộc, DidEat luôn true, không còn gì để chọn. Đơn Theo Nhóm
                                            (Văn phòng) đổi nhãn thành "Ăn sau" (đảo ngược ý nghĩa hiển thị). */}
                                        {formMode !== "production" && (
                                            <th rowSpan={2} className="px-1 py-2 text-center align-bottom"><span className="inline-block rotate-180 [writing-mode:vertical-rl]">{t("colAteLater")}</span></th>
                                        )}
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
                                        if (removalReason) {
                                            return (
                                                <tr key={employee.employeeId} className="border-b border-[#f1f5f9] bg-[#fff4f2] opacity-70">
                                                    <td className="whitespace-nowrap px-3 py-2 align-top text-sm font-semibold text-[#191c1e] line-through">
                                                        {employee.employeeCode}
                                                    </td>
                                                    <td
                                                        className="px-3 py-2 align-top text-sm text-[#930006]"
                                                        colSpan={formMode === "production" ? 9 : 7}
                                                    >
                                                        <span className="line-through">{employee.fullName}</span> —{" "}
                                                        {t("willBeRemovedNote", { reason: removalReason })}
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
                                        // Không có dữ liệu "ngày" ở bảng này (monthToDate/yearToDate là lũy kế
                                        // THẬT, không phải Dự kiến theo ngày) — chỉ cảnh báo tháng/năm, ưu tiên
                                        // mốc riêng của nhân viên nếu đã gán (2026-08-26).
                                        const currentStartTime = employeeOverrides[employee.employeeId]?.startTime || startTime;
                                        const currentEndTime = employeeOverrides[employee.employeeId]?.endTime ?? endTime;
                                        const currentDidEat = employeeOverrides[employee.employeeId]?.didEat ?? defaultDidEatForNewEmployee;
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
                                                {formMode !== "production" && (
                                                    <td className="px-3 py-2 align-top">
                                                        {earlyWindow ? null : (
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
                                            const currentEndTime = employeeOverrides[employeeId]?.endTime ?? endTime;
                                            const currentDidEat = employeeOverrides[employeeId]?.didEat ?? defaultDidEatForNewEmployee;
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
                                                    {formMode !== "production" && (
                                                        <td className="px-3 py-2 align-top">
                                                            {earlyWindow ? null : (
                                                                <input
                                                                    type="checkbox"
                                                                    checked={currentAteLater}
                                                                    onChange={(event) => handleEmployeeDidEatChange(employeeId, !event.target.checked)}
                                                                    disabled={isSubmitting}
                                                                    aria-label={t("ateLaterLabel")}
                                                                    className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                                                                />
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

                        <div className="rounded-lg border border-[#e0e3e5] bg-[#f8fafc] p-4">
                            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                {t("addEmployeeSectionTitle")}
                            </h3>
                            <div className="flex gap-2">
                                <input
                                    value={addSearchKeyword}
                                    onChange={(event) => setAddSearchKeyword(event.target.value)}
                                    onKeyDown={(event) => event.key === "Enter" && handleSearchAddEmployee()}
                                    placeholder={t("addSearchPlaceholder")}
                                    disabled={isSubmitting}
                                    className={`${fieldClassName} flex-1`}
                                />
                                <button
                                    type="button"
                                    onClick={handleSearchAddEmployee}
                                    disabled={isSubmitting || isSearchingAddEmployee}
                                    className="h-9 shrink-0 cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {isSearchingAddEmployee ? tCommon("loading") : tCommon("search")}
                                </button>
                            </div>
                            {addSearchResults.length > 0 && (
                                <div className="mt-3 max-h-56 space-y-1 overflow-y-auto">
                                    {addSearchResults.map((item) => (
                                        <button
                                            key={item.employeeId}
                                            type="button"
                                            onClick={() => handlePickAddEmployee(item)}
                                            className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-left text-sm transition hover:border-[#e3000f] hover:bg-[#fff4f2]"
                                        >
                                            <span className="font-medium text-[#191c1e]">{item.fullName}</span>
                                            <span className="font-mono text-xs text-[#5e3f3a]">{item.employeeCode}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
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
                            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                                {/* Team PHẢI chọn trước Line — Line là con thật của Team (ProductionLine.TeamId
                                    là FK), đặt Team lên trước + khoá Line tới khi có Team để không còn ai hiểu
                                    nhầm Line là bộ lọc chọn đầu tiên (2026-08-26, yêu cầu người dùng). Thêm nhãn
                                    phía trên mỗi ô (trước đây chỉ có placeholder chìm trong ô) để Team/Line/Nhóm
                                    ca nổi bật hơn — bảng kết quả bên dưới không còn lặp lại 3 cột này nữa
                                    (2026-09-28, theo yêu cầu người dùng). */}
                                <label className="block">
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
                                <label className="block">
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
                                <label className="block">
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
                                <label className="block">
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
                                                <th rowSpan={2} className="w-10 px-3 py-2 align-bottom">
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
                                                </th>
                                                <th rowSpan={2} className="px-3 py-2 align-bottom">{t("colEmployeeCode")}</th>
                                                <th rowSpan={2} className="px-3 py-2 align-bottom">{t("colFullName")}</th>
                                                {/* Bỏ cột Block/Nhóm ca — đã chọn ở bộ lọc Team/Line/Nhóm ca phía trên,
                                                    mọi dòng kết quả đều thuộc đúng 1 giá trị nên lặp lại ở đây thừa
                                                    (2026-09-28, theo yêu cầu người dùng). Công đoạn giữ lại vì không
                                                    có bộ lọc tương ứng, mỗi nhân viên có thể khác nhau. */}
                                                <th rowSpan={2} className="px-3 py-2 align-bottom">{t("colCongDoan")}</th>
                                                <th colSpan={3} className="border-b border-[#e0e3e5] px-3 py-2 text-center">{t("colAccumulation")}</th>
                                                <th rowSpan={2} className="px-3 py-2 align-bottom">{t("colStartTime")}</th>
                                                <th rowSpan={2} className="px-3 py-2 align-bottom">{t("colEndTime")}</th>
                                                {/* Bỏ hẳn cột "Có ăn" cho đơn Theo chuyền (2026-09-28, theo yêu cầu người
                                                    dùng) — Ăn uống nay bắt buộc, ai cũng coi như có ăn (DidEat=true), chỉ
                                                    còn cần hiện loại phiếu. */}
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
                                                // Cảnh báo SỚM ngay lúc chọn người (trước khi submit) — mirror bảng "Theo
                                                // Nhóm" phía dưới, trước đây bảng "Theo chuyền" không có cột này (thiếu
                                                // sót, xem ProductionEmployeeService.SearchAsync). Ưu tiên mốc riêng của
                                                // nhân viên (customMonthly/YearlyOtHourLimit) nếu đã gán — "gia hạn" cao
                                                // hơn mặc định, thường dùng cho công nhân dưới chuyền (2026-08-26). BE
                                                // luôn là nguồn chặn thật (ValidateOtHourLimitsAsync).
                                                const currentStartTime = employeeOverrides[item.employeeId]?.startTime || startTime;
                                                const currentEndTime = employeeOverrides[item.employeeId]?.endTime ?? endTime;
                                                // Ăn uống bắt buộc (2026-09-28) — đơn Theo chuyền không còn cho chọn
                                                // "Có ăn" nữa, loại phiếu luôn tính như có ăn.
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
                                                        className={`border-b border-[#f1f5f9] transition-colors ${checked ? "bg-[#fff4f2]" : "bg-white even:bg-[#f2f4f7] hover:bg-[#e8ecf1]"}`}
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
                    ) : !isCoreFormInfoFilled || !groupId ? (
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
                                        <th rowSpan={2} className="w-10 px-3 py-2 align-bottom">
                                            <input
                                                type="checkbox"
                                                checked={groupEmployees.length > 0 && groupEmployees.every((employee) => selectedEmployeeIds.includes(employee.id))}
                                                onChange={() =>
                                                    setEmployeesSelected(
                                                        groupEmployees.map((employee) => employee.id),
                                                        !groupEmployees.every((employee) => selectedEmployeeIds.includes(employee.id))
                                                    )
                                                }
                                                disabled={isSubmitting}
                                                aria-label={t("selectAllLabel")}
                                                className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                                            />
                                        </th>
                                        <th rowSpan={2} className="px-3 py-2 align-bottom">{t("colEmployeeCode")}</th>
                                        <th rowSpan={2} className="px-3 py-2 align-bottom">{t("colFullName")}</th>
                                        <th colSpan={3} className="border-b border-[#e0e3e5] px-3 py-2 text-center">{t("colAccumulation")}</th>
                                        <th rowSpan={2} className="px-3 py-2 align-bottom">{t("colStartTime")}</th>
                                        <th rowSpan={2} className="px-3 py-2 align-bottom">{t("colEndTime")}</th>
                                        <th rowSpan={2} className="px-1 py-2 text-center align-bottom"><span className="inline-block rotate-180 [writing-mode:vertical-rl]">{t("colAteLater")}</span></th>
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
                                    {groupEmployees.map((employee) => {
                                        const checked = selectedEmployeeIds.includes(employee.id);
                                        // Dùng lũy kế DỰ KIẾN (thực tế + đơn khác đang chờ duyệt) chứ không phải
                                        // monthToDate/yearToDate (chỉ phản ánh phần đã duyệt xong) — tránh trường
                                        // hợp tạo 2 đơn cùng lúc mà đơn nào cũng không thấy cảnh báo vượt hạn mức.
                                        // Chỉ mang tính cảnh báo SỚM — BE luôn là nguồn chân lý chặn thật khi submit
                                        // (ValidateOtHourLimitsAsync, cộng thêm giờ của chính đơn đang tạo). Ưu tiên
                                        // mốc riêng của nhân viên nếu đã gán (2026-08-26).
                                        const currentStartTime = employeeOverrides[employee.id]?.startTime || startTime;
                                        const currentEndTime = employeeOverrides[employee.id]?.endTime ?? endTime;
                                        // Field BE thật (true = ăn TRONG ca, bị trừ giờ) — UI hiện dưới nhãn "Ăn
                                        // sau" ĐẢO NGƯỢC (2026-09-28): tích "Ăn sau" = didEat false = không trừ giờ.
                                        const currentDidEat = employeeOverrides[employee.id]?.didEat ?? defaultDidEatForNewEmployee;
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
                                                className={`border-b border-[#f1f5f9] transition-colors ${checked ? "bg-[#fff4f2]" : "bg-white even:bg-[#f2f4f7] hover:bg-[#e8ecf1]"}`}
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
                                                <td className="px-3 py-2 align-top">
                                                    {earlyWindow ? null : (
                                                        <input
                                                            type="checkbox"
                                                            checked={currentAteLater}
                                                            onChange={(event) => handleEmployeeDidEatChange(employee.id, !event.target.checked)}
                                                            disabled={isSubmitting || !checked}
                                                            aria-label={t("ateLaterLabel")}
                                                            className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                                                        />
                                                    )}
                                                </td>
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
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
                </div>

                                <div className="flex justify-end gap-3">
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
                        {isSubmitting ? t("saving") : isEditMode ? t("updateSubmit") : t("createSubmit")}
                    </button>
                </div>
            </form>

            <SecondaryPasswordDialog
                isOpen={isPasswordDialogOpen}
                title={t("secondaryPasswordLabel")}
                label={t("secondaryPasswordLabel")}
                hint={hasSecondaryPassword === false ? t("secondaryPasswordMissingHint") : t("secondaryPasswordOkHint")}
                hintIsWarning={hasSecondaryPassword === false}
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
