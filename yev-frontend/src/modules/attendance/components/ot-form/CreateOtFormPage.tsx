"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, Calculator, Car, Check, Printer, RefreshCw, Users, Utensils } from "lucide-react";
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
import type { OtCaseDto } from "@/modules/attendance/types/ot-case.dto";
import { EmployeeApi } from "@/modules/attendance/api/employee.api";
import type { EmployeeDto } from "@/modules/attendance/types/employee.dto";
import { OtFormApi } from "@/modules/attendance/api/ot-form.api";
import type {
    MyCreateScopeItemDto,
    OtFormEmployeeDto,
    OtFormEmployeeInputDto,
    ProcessPartDto,
    UpdateOtFormEmployeeTimeDto,
} from "@/modules/attendance/types/ot-form.dto";
import { UserSignatureApi } from "@/modules/attendance/api/user-signature.api";
import { getApiErrorMessage } from "@/lib/apiError";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";
import { useAttendanceSetting } from "@/modules/attendance/hooks/useAttendanceSetting";

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

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

function computeTotalHour(startTime: string, endTime: string): number {
    if (!startTime || !endTime) return 0;
    const startMinutes = toMinutes(startTime);
    let endMinutes = toMinutes(endTime);
    if (endMinutes < startMinutes) endMinutes += 24 * 60; // qua ngày hôm sau
    return Math.round(((endMinutes - startMinutes) / 60) * 100) / 100;
}

const emptyProcessPart: ProcessPartDto = {
    isEat: false,
    mainTicketCount: 0,
    secondaryTicketCount: 0,
    milkCount: 0,
    isTransportation: false,
    isUseCopyRoom: false,
    anotherSuggestionVn: null,
    anotherSuggestionJp: null,
};

interface EmployeeOverride {
    endTime: string;
    // Có ăn hay không — chỉ có ý nghĩa khi giờ OT thực tế của người này >= ngưỡng phiếu ăn (mới
    // 2026-08-06). Mặc định true (giả định ăn) khi chọn mới; không ăn dù đủ ngưỡng thì BE tự +30
    // phút vào lũy kế lúc đơn Hoàn tất — xem docs/attendance-module.md §Phiếu ăn.
    didEat: boolean;
    noteVn: string;
    noteJp: string;
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

const timeSelectClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

// Input giờ/phút dựng bằng 2 <select> thay cho <input type="time"> — trình duyệt (đặc biệt Firefox)
// bỏ qua thuộc tính lang và luôn hiển thị theo định dạng hệ điều hành (có thể ra AM/PM), nên tự dựng
// để đảm bảo LUÔN nhập/hiển thị 24h bất kể trình duyệt/OS.
function TimePicker24h({
    value,
    onChange,
    disabled,
}: {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}) {
    const t = useTranslations("Attendance.CreateOtForm");
    const [hour, minute] = value ? value.split(":") : ["", ""];

    return (
        <div className="flex items-center gap-1.5">
            <select
                value={hour}
                onChange={(event) => onChange(`${event.target.value}:${minute || "00"}`)}
                disabled={disabled}
                required
                className={timeSelectClassName}
            >
                <option value="" disabled>
                    {t("hourPlaceholder")}
                </option>
                {HOUR_OPTIONS.map((h) => (
                    <option key={h} value={h}>
                        {h}
                    </option>
                ))}
            </select>
            <span className="text-sm font-semibold text-[#5e3f3a]">:</span>
            <select
                value={minute}
                onChange={(event) => onChange(`${hour || "00"}:${event.target.value}`)}
                disabled={disabled}
                required
                className={timeSelectClassName}
            >
                <option value="" disabled>
                    {t("minutePlaceholder")}
                </option>
                {MINUTE_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                        {m}
                    </option>
                ))}
            </select>
        </div>
    );
}

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
            className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
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

    const [departments, setDepartments] = useState<DepartmentDto[]>([]);
    const [groups, setGroups] = useState<GroupDto[]>([]);
    const [reasons, setReasons] = useState<ReasonDto[]>([]);
    const [otCases, setOtCases] = useState<OtCaseDto[]>([]);
    const [groupEmployees, setGroupEmployees] = useState<EmployeeDto[]>([]);

    const [departmentId, setDepartmentId] = useState<number | null>(null);
    const [groupId, setGroupId] = useState<number | null>(null);
    const [reasonId, setReasonId] = useState<number | null>(null);
    const [otCaseId, setOtCaseId] = useState<number | null>(null);
    const [date, setDate] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [subReason, setSubReason] = useState("");

    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
    const [employeeOverrides, setEmployeeOverrides] = useState<Record<number, EmployeeOverride>>({});
    // Chỉ dùng khi Sửa đơn — danh sách nhân viên CỐ ĐỊNH lấy thẳng từ đơn (đã lọc bỏ người bị loại),
    // KHÔNG phải từ groupEmployees (chọn theo Nhóm, chỉ dùng lúc Tạo mới). Sửa đơn giờ chỉ được đổi
    // giờ kết thúc thực tế của từng người, không thêm/bớt được ai — xem docs §Sửa đơn: giới hạn chỉ
    // sửa thực tích.
    const [editEmployees, setEditEmployees] = useState<OtFormEmployeeDto[]>([]);

    const [processPartEnabled, setProcessPartEnabled] = useState(false);
    const [processPart, setProcessPart] = useState<ProcessPartDto>(emptyProcessPart);
    // true = số phiếu chính/phụ đang do HỆ THỐNG tự tính; chuyển false vĩnh viễn ngay khi người dùng
    // tự gõ đè 1 trong 2 ô, để không ghi đè lại con số họ vừa chỉnh (yêu cầu "vẫn cho phép user sửa").
    const [autoMealTicket, setAutoMealTicket] = useState(true);

    const { setting } = useAttendanceSetting();

    // "Ăn uống" ở "Yêu cầu hỗ trợ khác" (cấp cả đơn, đặt suất ăn) và "Có ăn" của từng người (cấp cá
    // nhân, quyết định +30 phút lũy kế + số phiếu) là 2 field ĐỘC LẬP ở BE — nhưng để tránh người lập
    // đơn quên đổi tay "Có ăn" khi đã bỏ tích "Ăn uống" (dễ hiểu nhầm 2 cái liên quan nhau), FE tự
    // đồng bộ GIÁ TRỊ MẶC ĐỊNH của "Có ăn" theo "Ăn uống" — vẫn cho sửa tay từng người sau đó (2026-08-06).
    const mealServiceActive = processPartEnabled && processPart.isEat;

    // Đồng bộ lại "Có ăn" mặc định cho MỌI người đang chọn mỗi khi "Ăn uống" đổi — so sánh snapshot
    // ngay trong render (không dùng effect để setState, xem CLAUDE.md §4.5). Chỉ áp dụng ở màn Tạo
    // mới — màn Sửa đơn khoá hẳn khối "Yêu cầu hỗ trợ khác" nên mealServiceActive không đổi sau khi
    // đổ dữ liệu ban đầu, nhưng vẫn cần chặn tường minh để không lỡ ghi đè didEat vừa tải từ đơn cũ.
    const [prevMealServiceActive, setPrevMealServiceActive] = useState(mealServiceActive);
    if (!isEditMode && prevMealServiceActive !== mealServiceActive) {
        setPrevMealServiceActive(mealServiceActive);
        setEmployeeOverrides((current) =>
            Object.fromEntries(Object.entries(current).map(([id, override]) => [id, { ...override, didEat: mealServiceActive }]))
        );
    }

    // Chữ ký "Người đề nghị" (đợt 4, 2026-07-16) KHÔNG còn gắn với bước tạo đơn — POST /api/OtForm chỉ
    // tạo status=Draft chưa ký, chữ ký thật chỉ bắt buộc ở bước Ký duyệt riêng (POST /{id}/submit, màn
    // "Chờ tôi ký duyệt"). Ở đây chỉ hiện gợi ý mềm, KHÔNG chặn nút Tạo đơn.
    const [hasSignature, setHasSignature] = useState<boolean | null>(null);

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
    }, []);

    useEffect(() => {
        OtFormApi.getMyCreateScopes()
            .then((scopes) => {
                setCreateScopes(scopes);
                // Chỉ tự điền sẵn lúc Tạo mới — Sửa đơn đã đổ dữ liệu thật của đơn, không ghi đè (docs §1.3.A).
                if (!isEditMode && scopes.length === 1) {
                    setDepartmentId(scopes[0].departmentId);
                    setGroupId(scopes[0].groupId);
                }
            })
            .catch((err) => {
                console.error(err);
                setCreateScopes([]); // Lỗi tải → không chặn màn, coi như không có gợi ý (fallback dropdown tự do).
            });
    }, [isEditMode]);

    const isScopeRestricted = createScopes !== null && createScopes.length > 0;
    // Chỉ khoá cứng dropdown lúc Tạo mới — Sửa đơn vẫn cho đổi Bộ phận/Phòng ban trong phạm vi (docs §4.1b).
    const isScopeLocked = !isEditMode && isScopeRestricted && createScopes!.length === 1;
    // Mảng rỗng mà KHÔNG phải Admin → tài khoản chưa được cấp quyền tạo đơn cho Bộ phận nào — chặn hẳn
    // màn "Tạo đơn tăng ca" thay vì cho vào form rồi chọn linh tinh rồi nhận lỗi 400 (docs §4.0a).
    const isBlockedNoScope = !isEditMode && createScopes !== null && createScopes.length === 0 && !isUnrestrictedAdmin;

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

    useEffect(() => {
        if (isEditMode) return; // Sửa đơn không ký lại — không cần kiểm tra chữ ký.
        UserSignatureApi.getMySignature()
            .then((data) => setHasSignature(Boolean(data)))
            .catch(() => setHasSignature(false));
    }, [isEditMode]);

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
                setDepartmentId(data.departmentId);
                setGroupId(data.groupId);
                setReasonId(data.reasonId);
                setOtCaseId(data.otCaseId);
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
                            { endTime: e.endTime.slice(0, 5), didEat: e.didEat, noteVn: e.noteVn ?? "", noteJp: e.noteJp ?? "" },
                        ])
                    )
                );
                setProcessPartEnabled(Boolean(data.processPart));
                setProcessPart(data.processPart ?? emptyProcessPart);
            })
            .catch((err) => {
                console.error(err);
                setLoadError(getApiErrorMessage(err, t("loadEditError")));
            })
            .finally(() => setIsLoadingInitial(false));
    }, [isEditMode, otFormId]);

    // Cascading Bộ phận theo Phòng ban — chỉ TẢI danh sách, không tự xoá lựa chọn (việc xoá do handler
    // người dùng chủ động đổi Phòng ban quyết định, xem handleDepartmentChange) để không phá dữ liệu
    // vừa đổ sẵn lúc Sửa đơn (docs/attendance-api-fe.md §3.2/§8).
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
        EmployeeApi.getEmployeesByGroup(groupId)
            .then(setGroupEmployees)
            .catch((err) => console.error(err));
    }, [groupId, isEditMode]);

    const totalHour = useMemo(() => computeTotalHour(startTime, endTime), [startTime, endTime]);

    // Tự tính số phiếu ăn theo giờ OT THỰC TẾ của từng người đang chọn (docs §Cấu hình phiếu ăn):
    // tăng ca >= mốc cấu hình (mặc định 2h30) → 1 phiếu CHÍNH, dưới mốc → 1 phiếu PHỤ. Người đủ ngưỡng
    // nhưng tick "Không ăn" (didEat=false) thì KHÔNG tính vào phiếu nào cả — không ăn thì không cần
    // suất, và họ đã được cộng bù 30 phút lũy kế thay vào đó (2026-08-06, xem §Có ăn hay không). Người
    // dưới ngưỡng chưa có ô "Có ăn" để tự khai nên vẫn mặc định tính vào phiếu phụ như cũ. Sữa KHÔNG
    // tự tính — luôn để người lập đơn tự nhập.
    const mealTicketCounts = useMemo(() => {
        let main = 0;
        let secondary = 0;
        for (const employeeId of selectedEmployeeIds) {
            const employeeEndTime = employeeOverrides[employeeId]?.endTime || endTime;
            const hours = computeTotalHour(startTime, employeeEndTime);
            if (hours >= setting.mainMealTicketMinHours) {
                const didEat = employeeOverrides[employeeId]?.didEat ?? mealServiceActive;
                if (didEat) main += 1;
            } else {
                secondary += 1;
            }
        }
        return { main, secondary };
    }, [selectedEmployeeIds, employeeOverrides, startTime, endTime, setting.mainMealTicketMinHours, mealServiceActive]);

    // Đồng bộ kết quả tự tính vào ô nhập — so sánh snapshot NGAY TRONG RENDER thay vì dùng effect
    // (CLAUDE.md §4.5: không setState đồng bộ trong useEffect). Dừng đồng bộ ngay khi người dùng tự gõ
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

    // Kiểm tra trùng giờ tăng ca (chỉ chạy khi đã nhập đủ ngày, giờ bắt đầu và có ít nhất 1 nhân viên)
    useEffect(() => {
        if (!date || !startTime || selectedEmployeeIds.length === 0) {
            setOverlappingEmployeeIds([]);
            return;
        }

        const timeout = setTimeout(() => {
            const reqEmployees = selectedEmployeeIds.map(id => ({
                employeeId: id,
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
                : { ...current, [employeeId]: { endTime, didEat: mealServiceActive, noteVn: "", noteJp: "" } }
        );
    };

    const handleEmployeeOverrideChange = (employeeId: number, field: "endTime" | "noteVn" | "noteJp", value: string) => {
        setEmployeeOverrides((current) => ({
            ...current,
            [employeeId]: {
                endTime: current[employeeId]?.endTime ?? endTime,
                didEat: current[employeeId]?.didEat ?? mealServiceActive,
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
                endTime: current[employeeId]?.endTime ?? endTime,
                didEat,
                noteVn: current[employeeId]?.noteVn ?? "",
                noteJp: current[employeeId]?.noteJp ?? "",
            },
        }));
    };

    const handleDepartmentChange = (value: string) => {
        setDepartmentId(value ? Number(value) : null);
        setGroupId(null);
        setSelectedEmployeeIds([]);
        setEmployeeOverrides({});
    };

    const handleGroupChange = (value: string) => {
        setGroupId(value ? Number(value) : null);
        setSelectedEmployeeIds([]);
        setEmployeeOverrides({});
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        // Sửa đơn: mọi field khác đã bị khoá disabled từ trước (không đổi được), chỉ còn kiểm tra có
        // ít nhất 1 người. Tạo mới: vẫn cần đủ các field bắt buộc như cũ.
        if (!isEditMode && (!groupId || !departmentId || !reasonId || !otCaseId || !date || !startTime || !endTime)) {
            toast.error(t("requiredFieldsError"));
            return;
        }
        if (selectedEmployeeIds.length === 0) {
            toast.error(t("requiredFieldsError"));
            return;
        }

        const orderStartMinutes = toMinutes(`${startTime}:00`);
        let orderEndMinutes = toMinutes(`${endTime}:00`);
        if (orderEndMinutes < orderStartMinutes) orderEndMinutes += 24 * 60; // qua ngày hôm sau
        for (const employeeId of selectedEmployeeIds) {
            const employeeEndTime = employeeOverrides[employeeId]?.endTime || endTime;
            let employeeEndMinutes = toMinutes(`${employeeEndTime}:00`);
            if (employeeEndMinutes < orderStartMinutes) employeeEndMinutes += 24 * 60; // qua ngày hôm sau
            if (employeeEndMinutes <= orderStartMinutes || employeeEndMinutes > orderEndMinutes) {
                const code = isEditMode
                    ? editEmployees.find((e) => e.employeeId === employeeId)?.employeeCode
                    : groupEmployees.find((e) => e.id === employeeId)?.code;
                toast.error(t("employeeEndTimeError", { code: code ?? String(employeeId) }));
                return;
            }
        }

        setIsSubmitting(true);
        try {
            let result;
            if (isEditMode && otFormId) {
                const employees: UpdateOtFormEmployeeTimeDto[] = selectedEmployeeIds.map((employeeId) => ({
                    employeeId,
                    endTime: `${employeeOverrides[employeeId]?.endTime || endTime}:00`,
                    didEat: employeeOverrides[employeeId]?.didEat ?? true,
                }));
                result = await OtFormApi.updateOtForm(otFormId, { employees });
            } else {
                const employees: OtFormEmployeeInputDto[] = selectedEmployeeIds.map((employeeId) => ({
                    employeeId,
                    endTime: `${employeeOverrides[employeeId]?.endTime || endTime}:00`,
                    didEat: employeeOverrides[employeeId]?.didEat ?? mealServiceActive,
                    noteVn: employeeOverrides[employeeId]?.noteVn?.trim() ? employeeOverrides[employeeId].noteVn.trim() : null,
                    noteJp: employeeOverrides[employeeId]?.noteJp?.trim() ? employeeOverrides[employeeId].noteJp.trim() : null,
                }));
                result = await OtFormApi.createOtForm({
                    groupId: groupId!,
                    departmentId: departmentId!,
                    reasonId: reasonId!,
                    otCaseId: otCaseId!,
                    startTime: `${startTime}:00`,
                    endTime: `${endTime}:00`,
                    subReason: subReason.trim() || null,
                    totalHour,
                    date,
                    employees,
                    processPart: processPartEnabled ? processPart : null,
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
        return (
            <div className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">
                {t("blockedNoScopeMessage")}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold text-[#191c1e]">{isEditMode ? t("titleEdit", { id: otFormId }) : t("titleCreate")}</h1>
                <p className="mt-1 text-[15px] text-[#5e3f3a]">{isEditMode ? t("descEdit") : t("descCreate")}</p>
            </div>

            {!isEditMode && isScopeLocked && (
                <div className="rounded-lg border border-[#e0e3e5] bg-[#f8fafc] px-4 py-3 text-sm text-[#5e3f3a]">
                    {t.rich("scopeLockedMessage", {
                        groupName: createScopes![0].groupNameVn,
                        departmentName: createScopes![0].departmentNameVn,
                        b: (chunks) => <strong>{chunks}</strong>,
                    })}
                </div>
            )}

            {!isEditMode && isScopeRestricted && !isScopeLocked && (
                <div className="rounded-lg border border-[#e0e3e5] bg-[#f8fafc] px-4 py-3 text-sm text-[#5e3f3a]">
                    {t("scopeRestrictedMessage", { groupNames: createScopes!.map((s) => s.groupNameVn).join(", ") })}
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

            <form onSubmit={handleSubmit} className="space-y-6">
                <section className="space-y-4 rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">{t("formInfoTitle")}</h2>
                        {isEditMode && (
                            <span className="rounded-full border border-[#e0e3e5] bg-[#f8fafc] px-3 py-1 text-xs font-medium text-[#5e3f3a]">
                                {t("formInfoLockedHint")}
                            </span>
                        )}
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <label className="block">
                            <span className={fieldLabelClassName}>{t("fieldDepartment")}</span>
                            <select
                                value={departmentId ?? ""}
                                onChange={(event) => handleDepartmentChange(event.target.value)}
                                disabled={isSubmitting || isScopeLocked || isEditMode}
                                required
                                className={fieldClassName}
                            >
                                <option value="" disabled>
                                    {t("fieldDepartmentPlaceholder")}
                                </option>
                                {visibleDepartments.map((department) => (
                                    <option key={department.id} value={department.id}>
                                        {department.label}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>{t("fieldGroup")}</span>
                            <select
                                value={groupId ?? ""}
                                onChange={(event) => handleGroupChange(event.target.value)}
                                disabled={isSubmitting || isScopeLocked || !departmentId || isEditMode}
                                required
                                className={fieldClassName}
                            >
                                <option value="" disabled>
                                    {departmentId ? t("fieldGroupPlaceholder") : t("fieldGroupPlaceholderNeedDepartment")}
                                </option>
                                {visibleGroups.map((group) => (
                                    <option key={group.id} value={group.id}>
                                        {group.label}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>{t("fieldReason")}</span>
                            <select
                                value={reasonId ?? ""}
                                onChange={(event) => setReasonId(event.target.value ? Number(event.target.value) : null)}
                                disabled={isSubmitting || isEditMode}
                                required
                                className={fieldClassName}
                            >
                                <option value="" disabled>
                                    {t("fieldReasonPlaceholder")}
                                </option>
                                {reasons.map((reason) => (
                                    <option key={reason.id} value={reason.id}>
                                        {reason.reasonNameVn}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>{t("fieldOtCase")}</span>
                            <select
                                value={otCaseId ?? ""}
                                onChange={(event) => setOtCaseId(event.target.value ? Number(event.target.value) : null)}
                                disabled={isSubmitting || isEditMode}
                                required
                                className={fieldClassName}
                            >
                                <option value="" disabled>
                                    {t("fieldOtCasePlaceholder")}
                                </option>
                                {otCases.map((otCase) => (
                                    <option key={otCase.id} value={otCase.id}>
                                        {otCase.code} {otCase.description ? `— ${otCase.description}` : ""}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>{t("fieldDate")}</span>
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
                            <span className={fieldLabelClassName}>{t("fieldStartTime")}</span>
                            <TimePicker24h value={startTime} onChange={setStartTime} disabled={isSubmitting || isEditMode} />
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>{t("fieldEndTime")}</span>
                            <TimePicker24h value={endTime} onChange={setEndTime} disabled={isSubmitting || isEditMode} />
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>{t("fieldTotalHour")}</span>
                            <input value={totalHour} disabled className={fieldClassName} />
                        </label>
                    </div>

                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldSubReason")}</span>
                        <textarea
                            value={subReason}
                            onChange={(event) => setSubReason(event.target.value)}
                            disabled={isSubmitting || isEditMode}
                            rows={2}
                            className="w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
                        />
                    </label>
                </section>

                <section className="space-y-4 rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
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
                        // Sửa đơn: danh sách CỐ ĐỊNH (editEmployees, lấy thẳng từ đơn) — không có ô
                        // tick/thêm người, chỉ còn sửa được "Giờ kết thúc" của từng người đã có sẵn
                        // (thực tích). Muốn bớt người dùng riêng chức năng "Loại khỏi đơn" ở màn Chi
                        // tiết, không qua màn này.
                        <div className="overflow-x-auto">
                            <table className="min-w-full border-collapse text-left">
                                <thead>
                                    <tr className="border-b border-[#e0e3e5] text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                        <th className="px-3 py-2">{t("colEmployeeCode")}</th>
                                        <th className="px-3 py-2">{t("colFullName")}</th>
                                        <th className="px-3 py-2">{t("colAccumulation")}</th>
                                        <th className="px-3 py-2">{t("colEndTime")}</th>
                                        <th className="px-3 py-2">{t("colDidEat")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {editEmployees.map((employee) => {
                                        const isOverLimit =
                                            employee.monthToDate > setting.monthlyOtHourLimit ||
                                            employee.yearToDate > setting.yearlyOtHourLimit;
                                        const currentEndTime = employeeOverrides[employee.employeeId]?.endTime ?? endTime;
                                        const isEligibleForMeal =
                                            computeTotalHour(startTime, currentEndTime) >= setting.mainMealTicketMinHours;
                                        return (
                                            <tr key={employee.employeeId} className="border-b border-[#f1f5f9]">
                                                <td className="px-3 py-2 align-top text-sm font-semibold text-[#191c1e]">
                                                    {employee.employeeCode}
                                                </td>
                                                <td className="px-3 py-2 align-top text-sm text-[#191c1e]">{employee.fullName}</td>
                                                <td className="px-3 py-2 align-top text-sm">
                                                    <span
                                                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                                                            isOverLimit
                                                                ? "border-[#e9bcb6] bg-[#fff4f2] text-[#930006]"
                                                                : "border-[#e0e3e5] bg-[#f8fafc] text-[#5e3f3a]"
                                                        }`}
                                                    >
                                                        {isOverLimit && <AlertTriangle className="h-3 w-3" />}
                                                        {employee.monthToDate}h / {employee.yearToDate}h
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 align-top">
                                                    <TimePicker24h
                                                        value={currentEndTime}
                                                        onChange={(value) => handleEmployeeOverrideChange(employee.employeeId, "endTime", value)}
                                                        disabled={isSubmitting}
                                                    />
                                                </td>
                                                <td className="px-3 py-2 align-top">
                                                    {isEligibleForMeal ? (
                                                        <label className="flex cursor-pointer items-center gap-1.5 text-sm text-[#191c1e]">
                                                            <input
                                                                type="checkbox"
                                                                checked={employeeOverrides[employee.employeeId]?.didEat ?? true}
                                                                onChange={(event) =>
                                                                    handleEmployeeDidEatChange(employee.employeeId, event.target.checked)
                                                                }
                                                                disabled={isSubmitting}
                                                                className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                                                            />
                                                            {t("didEatLabel")}
                                                        </label>
                                                    ) : (
                                                        <span className="text-sm text-[#8a8f94]">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : !groupId ? (
                        <p className="text-sm text-[#5e3f3a]">{t("chooseGroupFirstHint")}</p>
                    ) : groupEmployees.length === 0 ? (
                        <p className="text-sm text-[#5e3f3a]">{t("noEmployeesInGroup")}</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full border-collapse text-left">
                                <thead>
                                    <tr className="border-b border-[#e0e3e5] text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                        <th className="w-10 px-3 py-2"></th>
                                        <th className="px-3 py-2">{t("colEmployeeCode")}</th>
                                        <th className="px-3 py-2">{t("colFullName")}</th>
                                        <th className="px-3 py-2">{t("colAccumulation")}</th>
                                        <th className="px-3 py-2">{t("colEndTime")}</th>
                                        <th className="px-3 py-2">{t("colDidEat")}</th>
                                        <th className="px-3 py-2">{t("colNote")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {groupEmployees.map((employee) => {
                                        const checked = selectedEmployeeIds.includes(employee.id);
                                        // Dùng lũy kế DỰ KIẾN (thực tế + đơn khác đang chờ duyệt) chứ không phải
                                        // monthToDate/yearToDate (chỉ phản ánh phần đã duyệt xong) — tránh trường
                                        // hợp tạo 2 đơn cùng lúc mà đơn nào cũng không thấy cảnh báo vượt hạn mức.
                                        const isOverLimit =
                                            employee.projectedMonthToDate > setting.monthlyOtHourLimit ||
                                            employee.projectedYearToDate > setting.yearlyOtHourLimit;
                                        const currentEndTime = employeeOverrides[employee.id]?.endTime ?? endTime;
                                        const isEligibleForMeal =
                                            computeTotalHour(startTime, currentEndTime) >= setting.mainMealTicketMinHours;
                                        return (
                                            <tr
                                                key={employee.id}
                                                className={`border-b border-[#f1f5f9] transition-colors ${checked ? "bg-[#f8fafc]" : "hover:bg-[#f8fafc]"}`}
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
                                                <td className="px-3 py-2 align-top text-sm font-semibold text-[#191c1e]">{employee.code}</td>
                                                <td className="px-3 py-2 align-top text-sm">
                                                    <span className={overlappingEmployeeIds.includes(employee.id) ? "line-through text-[#930006]" : "text-[#191c1e]"}>
                                                        {employee.lastName} {employee.firstName}
                                                    </span>
                                                    {overlappingEmployeeIds.includes(employee.id) && (
                                                        <div className="mt-1 text-xs font-semibold text-[#930006]">
                                                            {t("colOverlapWarning")}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 align-top text-sm">
                                                    <span
                                                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                                                            isOverLimit
                                                                ? "border-[#e9bcb6] bg-[#fff4f2] text-[#930006]"
                                                                : "border-[#e0e3e5] bg-[#f8fafc] text-[#5e3f3a]"
                                                        }`}
                                                    >
                                                        {isOverLimit && <AlertTriangle className="h-3 w-3" />}
                                                        {employee.projectedMonthToDate}h / {employee.projectedYearToDate}h
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 align-top">
                                                    <TimePicker24h
                                                        value={currentEndTime}
                                                        onChange={(value) => handleEmployeeOverrideChange(employee.id, "endTime", value)}
                                                        disabled={isSubmitting || !checked}
                                                    />
                                                </td>
                                                <td className="px-3 py-2 align-top">
                                                    {isEligibleForMeal ? (
                                                        <label className="flex cursor-pointer items-center gap-1.5 text-sm text-[#191c1e]">
                                                            <input
                                                                type="checkbox"
                                                                checked={employeeOverrides[employee.id]?.didEat ?? mealServiceActive}
                                                                onChange={(event) => handleEmployeeDidEatChange(employee.id, event.target.checked)}
                                                                disabled={isSubmitting || !checked}
                                                                className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                                                            />
                                                            {t("didEatLabel")}
                                                        </label>
                                                    ) : (
                                                        <span className="text-sm text-[#8a8f94]">—</span>
                                                    )}
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

                <section className="space-y-4 rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={processPartEnabled}
                            onChange={(event) => setProcessPartEnabled(event.target.checked)}
                            disabled={isSubmitting || isEditMode}
                            className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                        />
                        <span className="text-sm font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                            {t("otherSupportLabel")}
                        </span>
                    </label>

                    {processPartEnabled && (
                        <div className="space-y-4">
                            <div className="grid gap-3 md:grid-cols-3">
                                <ToggleOptionCard
                                    icon={<Utensils size={16} />}
                                    label={t("eatLabel")}
                                    checked={processPart.isEat}
                                    onChange={(value) => setProcessPart((current) => ({ ...current, isEat: value }))}
                                    disabled={isSubmitting || isEditMode}
                                />
                                <ToggleOptionCard
                                    icon={<Car size={16} />}
                                    label={t("transportationLabel")}
                                    checked={processPart.isTransportation}
                                    onChange={(value) => setProcessPart((current) => ({ ...current, isTransportation: value }))}
                                    disabled={isSubmitting || isEditMode}
                                />
                                <ToggleOptionCard
                                    icon={<Printer size={16} />}
                                    label={t("copyRoomLabel")}
                                    checked={processPart.isUseCopyRoom}
                                    onChange={(value) => setProcessPart((current) => ({ ...current, isUseCopyRoom: value }))}
                                    disabled={isSubmitting || isEditMode}
                                />
                            </div>

                            {processPart.isEat && (
                                <div className="space-y-3 rounded-lg border border-[#e0e3e5] bg-[#f8fafc] p-4">
                                    {/* Dải giải thích quy tắc + trạng thái tự tính. Hệ thống tự điền số
                                        phiếu chính/phụ theo giờ OT từng người; người lập đơn gõ đè được,
                                        khi đó hiện nút "Tính lại" để quay về số hệ thống gợi ý. */}
                                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                        <span className="flex items-center gap-1.5 text-[#5e3f3a]">
                                            <Calculator className="h-3.5 w-3.5 shrink-0" />
                                            {t("mealTicketRuleHint", { hours: setting.mainMealTicketMinHours })}
                                        </span>
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
                                                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    <RefreshCw className="h-3.5 w-3.5" /> {t("mealTicketRecalcButton")}
                                                </button>
                                            ))}
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-3">
                                    <label className="block">
                                        <span className={fieldLabelClassName}>{t("mainTicketLabel")}</span>
                                        <input
                                            type="number"
                                            min={0}
                                            value={processPart.mainTicketCount}
                                            onChange={(event) => {
                                                setAutoMealTicket(false);
                                                setProcessPart((current) => ({ ...current, mainTicketCount: Number(event.target.value) }));
                                            }}
                                            disabled={isSubmitting || isEditMode}
                                            className={fieldClassName}
                                        />
                                    </label>
                                    <label className="block">
                                        <span className={fieldLabelClassName}>{t("secondaryTicketLabel")}</span>
                                        <input
                                            type="number"
                                            min={0}
                                            value={processPart.secondaryTicketCount}
                                            onChange={(event) => {
                                                setAutoMealTicket(false);
                                                setProcessPart((current) => ({
                                                    ...current,
                                                    secondaryTicketCount: Number(event.target.value),
                                                }));
                                            }}
                                            disabled={isSubmitting || isEditMode}
                                            className={fieldClassName}
                                        />
                                    </label>
                                    <label className="block">
                                        <span className={fieldLabelClassName}>{t("milkLabel")}</span>
                                        <input
                                            type="number"
                                            min={0}
                                            value={processPart.milkCount}
                                            onChange={(event) =>
                                                setProcessPart((current) => ({ ...current, milkCount: Number(event.target.value) }))
                                            }
                                            disabled={isSubmitting || isEditMode}
                                            className={fieldClassName}
                                        />
                                    </label>
                                    </div>
                                </div>
                            )}

                            <label className="block">
                                <span className={fieldLabelClassName}>{t("anotherSuggestionVnLabel")}</span>
                                <input
                                    value={processPart.anotherSuggestionVn ?? ""}
                                    onChange={(event) =>
                                        setProcessPart((current) => ({ ...current, anotherSuggestionVn: event.target.value }))
                                    }
                                    disabled={isSubmitting || isEditMode}
                                    className={fieldClassName}
                                />
                            </label>
                        </div>
                    )}
                </section>

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
        </div>
    );
}
