"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "react-toastify";
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
import type { MyCreateScopeItemDto, OtFormEmployeeInputDto, ProcessPartDto } from "@/modules/attendance/types/ot-form.dto";
import { UserSignatureApi } from "@/modules/attendance/api/user-signature.api";
import { getApiErrorMessage } from "@/lib/apiError";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";

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
                    Giờ
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
                    Phút
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

interface CreateOtFormPageProps {
    // Có giá trị → màn "Sửa đơn" (đổ sẵn dữ liệu, submit gọi PUT thay vì POST) — docs §1.3.A/§4.1b.
    otFormId?: number;
}

export default function CreateOtFormPage({ otFormId }: CreateOtFormPageProps) {
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

    const [processPartEnabled, setProcessPartEnabled] = useState(false);
    const [processPart, setProcessPart] = useState<ProcessPartDto>(emptyProcessPart);

    // Chữ ký "Người đề nghị" (đợt 4, 2026-07-16) KHÔNG còn gắn với bước tạo đơn — POST /api/OtForm chỉ
    // tạo status=Draft chưa ký, chữ ký thật chỉ bắt buộc ở bước Ký duyệt riêng (POST /{id}/submit, màn
    // "Chờ tôi ký duyệt"). Ở đây chỉ hiện gợi ý mềm, KHÔNG chặn nút Tạo đơn.
    const [hasSignature, setHasSignature] = useState<boolean | null>(null);

    const [isLoadingInitial, setIsLoadingInitial] = useState(isEditMode);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

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
                    setLoadError("Đơn đã qua ít nhất 1 cấp duyệt, không thể sửa nữa.");
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
                setSelectedEmployeeIds(data.employees.map((e) => e.employeeId));
                setEmployeeOverrides(
                    Object.fromEntries(
                        data.employees.map((e) => [
                            e.employeeId,
                            { endTime: e.endTime.slice(0, 5), noteVn: e.noteVn ?? "", noteJp: e.noteJp ?? "" },
                        ])
                    )
                );
                setProcessPartEnabled(Boolean(data.processPart));
                setProcessPart(data.processPart ?? emptyProcessPart);
            })
            .catch((err) => {
                console.error(err);
                setLoadError(getApiErrorMessage(err, "Không thể tải đơn tăng ca để sửa."));
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
        if (!groupId) return;
        EmployeeApi.getEmployeesByGroup(groupId)
            .then(setGroupEmployees)
            .catch((err) => console.error(err));
    }, [groupId]);

    const totalHour = useMemo(() => computeTotalHour(startTime, endTime), [startTime, endTime]);

    const toggleEmployee = (employeeId: number) => {
        setSelectedEmployeeIds((current) =>
            current.includes(employeeId) ? current.filter((id) => id !== employeeId) : [...current, employeeId]
        );
        setEmployeeOverrides((current) =>
            current[employeeId] ? current : { ...current, [employeeId]: { endTime, noteVn: "", noteJp: "" } }
        );
    };

    const handleEmployeeOverrideChange = (employeeId: number, field: keyof EmployeeOverride, value: string) => {
        setEmployeeOverrides((current) => ({
            ...current,
            [employeeId]: {
                endTime: current[employeeId]?.endTime ?? endTime,
                noteVn: current[employeeId]?.noteVn ?? "",
                noteJp: current[employeeId]?.noteJp ?? "",
                [field]: value,
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

        if (
            !groupId ||
            !departmentId ||
            !reasonId ||
            !otCaseId ||
            !date ||
            !startTime ||
            !endTime ||
            selectedEmployeeIds.length === 0
        ) {
            toast.error("Vui lòng điền đầy đủ thông tin bắt buộc và chọn ít nhất 1 nhân viên.");
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
                const employee = groupEmployees.find((e) => e.id === employeeId);
                toast.error(
                    `Giờ kết thúc của nhân viên ${employee?.code ?? employeeId} phải sau giờ bắt đầu và không vượt quá giờ kết thúc của đơn.`
                );
                return;
            }
        }

        const employees: OtFormEmployeeInputDto[] = selectedEmployeeIds.map((employeeId) => ({
            employeeId,
            endTime: `${employeeOverrides[employeeId]?.endTime || endTime}:00`,
            noteVn: employeeOverrides[employeeId]?.noteVn?.trim() ? employeeOverrides[employeeId].noteVn.trim() : null,
            noteJp: employeeOverrides[employeeId]?.noteJp?.trim() ? employeeOverrides[employeeId].noteJp.trim() : null,
        }));

        const payload = {
            groupId,
            departmentId,
            reasonId,
            otCaseId,
            startTime: `${startTime}:00`,
            endTime: `${endTime}:00`,
            subReason: subReason.trim() || null,
            totalHour,
            date,
            employees,
            processPart: processPartEnabled ? processPart : null,
        };

        setIsSubmitting(true);
        try {
            const result = isEditMode && otFormId
                ? await OtFormApi.updateOtForm(otFormId, payload)
                : await OtFormApi.createOtForm(payload);
            toast.success(isEditMode ? "Cập nhật đơn tăng ca thành công" : "Tạo đơn tăng ca thành công");
            router.push({ pathname: "/ot/forms", query: { id: String(result.id) } });
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, isEditMode ? "Cập nhật đơn tăng ca thất bại" : "Tạo đơn tăng ca thất bại"));
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoadingInitial) {
        return <div className="py-16 text-center text-sm text-[#5e3f3a]">Đang tải dữ liệu...</div>;
    }

    if (loadError) {
        return <div className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{loadError}</div>;
    }

    if (isBlockedNoScope) {
        return (
            <div className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">
                Tài khoản chưa được cấp quyền tạo đơn cho Bộ phận nào — liên hệ Admin để được gán phân quyền
                (&quot;Phân quyền duyệt&quot;) hoặc liên kết hồ sơ nhân viên tương ứng.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold text-[#191c1e]">{isEditMode ? `Sửa đơn tăng ca #${otFormId}` : "Tạo đơn tăng ca"}</h1>
                <p className="mt-1 text-[15px] text-[#5e3f3a]">
                    {isEditMode
                        ? "Chỉ có thể sửa khi đơn đang Nháp hoặc chờ Trưởng phòng duyệt."
                        : "Điền thông tin đơn, chọn nhân viên làm ngoài giờ. Đơn tạo ra ở trạng thái Nháp — cần Trưởng nhóm ký duyệt riêng (\"Chờ tôi ký duyệt\") mới vào luồng duyệt."}
                </p>
            </div>

            {!isEditMode && isScopeLocked && (
                <div className="rounded-lg border border-[#e0e3e5] bg-[#f8fafc] px-4 py-3 text-sm text-[#5e3f3a]">
                    Tài khoản chỉ được tạo đơn cho <strong>{createScopes![0].groupNameVn}</strong> (
                    {createScopes![0].departmentNameVn}) — đã tự điền sẵn.
                </div>
            )}

            {!isEditMode && isScopeRestricted && !isScopeLocked && (
                <div className="rounded-lg border border-[#e0e3e5] bg-[#f8fafc] px-4 py-3 text-sm text-[#5e3f3a]">
                    Tài khoản chỉ được tạo đơn cho các Bộ phận sau: {createScopes!.map((s) => s.groupNameVn).join(", ")}.
                </div>
            )}

            {!isEditMode && hasSignature === false && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#f5d0a9] bg-[#fff4e5] px-4 py-3 text-sm text-[#9a5b00]">
                    <span>Bạn chưa đăng ký chữ ký cá nhân — cần đăng ký trước khi ký duyệt &quot;Người đề nghị&quot; ở bước sau.</span>
                    <button
                        type="button"
                        onClick={() => router.push("/ot/signature")}
                        className="cursor-pointer rounded-lg border border-[#9a5b00] px-3 py-1.5 text-xs font-semibold text-[#9a5b00] transition hover:bg-[#fff0d8]"
                    >
                        Đăng ký chữ ký
                    </button>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <section className="space-y-4 rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">Thông tin đơn</h2>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <label className="block">
                            <span className={fieldLabelClassName}>Phòng ban</span>
                            <select
                                value={departmentId ?? ""}
                                onChange={(event) => handleDepartmentChange(event.target.value)}
                                disabled={isSubmitting || isScopeLocked}
                                required
                                className={fieldClassName}
                            >
                                <option value="" disabled>
                                    Chọn phòng ban...
                                </option>
                                {visibleDepartments.map((department) => (
                                    <option key={department.id} value={department.id}>
                                        {department.label}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>Bộ phận</span>
                            <select
                                value={groupId ?? ""}
                                onChange={(event) => handleGroupChange(event.target.value)}
                                disabled={isSubmitting || isScopeLocked || !departmentId}
                                required
                                className={fieldClassName}
                            >
                                <option value="" disabled>
                                    {departmentId ? "Chọn bộ phận..." : "Chọn Phòng ban trước..."}
                                </option>
                                {visibleGroups.map((group) => (
                                    <option key={group.id} value={group.id}>
                                        {group.label}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>Lý do</span>
                            <select
                                value={reasonId ?? ""}
                                onChange={(event) => setReasonId(event.target.value ? Number(event.target.value) : null)}
                                disabled={isSubmitting}
                                required
                                className={fieldClassName}
                            >
                                <option value="" disabled>
                                    Chọn lý do...
                                </option>
                                {reasons.map((reason) => (
                                    <option key={reason.id} value={reason.id}>
                                        {reason.reasonNameVn}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>Trường hợp OT</span>
                            <select
                                value={otCaseId ?? ""}
                                onChange={(event) => setOtCaseId(event.target.value ? Number(event.target.value) : null)}
                                disabled={isSubmitting}
                                required
                                className={fieldClassName}
                            >
                                <option value="" disabled>
                                    Chọn trường hợp...
                                </option>
                                {otCases.map((otCase) => (
                                    <option key={otCase.id} value={otCase.id}>
                                        {otCase.code} {otCase.description ? `— ${otCase.description}` : ""}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>Ngày</span>
                            <input
                                type="date"
                                value={date}
                                onChange={(event) => setDate(event.target.value)}
                                disabled={isSubmitting}
                                required
                                min={isEditMode ? undefined : getTodayStr()}
                                className={fieldClassName}
                            />
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>Giờ bắt đầu</span>
                            <TimePicker24h value={startTime} onChange={setStartTime} disabled={isSubmitting} />
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>Giờ kết thúc</span>
                            <TimePicker24h value={endTime} onChange={setEndTime} disabled={isSubmitting} />
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>Tổng số giờ</span>
                            <input value={totalHour} disabled className={fieldClassName} />
                        </label>
                    </div>

                    <label className="block">
                        <span className={fieldLabelClassName}>Lý do chi tiết (tuỳ chọn)</span>
                        <textarea
                            value={subReason}
                            onChange={(event) => setSubReason(event.target.value)}
                            disabled={isSubmitting}
                            rows={2}
                            className="w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
                        />
                    </label>
                </section>

                <section className="space-y-4 rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                        Danh sách nhân viên làm ngoài giờ
                    </h2>
                    {!groupId ? (
                        <p className="text-sm text-[#5e3f3a]">Chọn Bộ phận để hiện danh sách nhân viên.</p>
                    ) : groupEmployees.length === 0 ? (
                        <p className="text-sm text-[#5e3f3a]">Bộ phận này chưa có nhân viên.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full border-collapse text-left">
                                <thead>
                                    <tr className="border-b border-[#e0e3e5] text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                        <th className="w-10 px-3 py-2"></th>
                                        <th className="px-3 py-2">Mã NV</th>
                                        <th className="px-3 py-2">Họ và tên</th>
                                        <th className="px-3 py-2">Lũy kế tháng/năm</th>
                                        <th className="px-3 py-2">Giờ kết thúc</th>
                                        <th className="px-3 py-2">Ghi chú</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {groupEmployees.map((employee) => {
                                        const checked = selectedEmployeeIds.includes(employee.id);
                                        const isOverLimit = employee.monthToDate > 25 || employee.yearToDate > 300;
                                        return (
                                            <tr key={employee.id} className="border-b border-[#f1f5f9]">
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
                                                <td className="px-3 py-2 align-top text-sm text-[#191c1e]">
                                                    {employee.lastName} {employee.firstName}
                                                </td>
                                                <td className={`px-3 py-2 align-top text-sm ${isOverLimit ? "font-semibold text-[#930006]" : "text-[#5e3f3a]"}`}>
                                                    {employee.monthToDate}h / {employee.yearToDate}h
                                                    {isOverLimit && <AlertTriangle className="ml-1 inline h-3.5 w-3.5 text-[#930006]" />}
                                                </td>
                                                <td className="px-3 py-2 align-top">
                                                    <TimePicker24h
                                                        value={employeeOverrides[employee.id]?.endTime ?? endTime}
                                                        onChange={(value) => handleEmployeeOverrideChange(employee.id, "endTime", value)}
                                                        disabled={isSubmitting || !checked}
                                                    />
                                                </td>
                                                <td className="px-3 py-2 align-top">
                                                    <input
                                                        value={employeeOverrides[employee.id]?.noteVn ?? ""}
                                                        onChange={(event) => handleEmployeeOverrideChange(employee.id, "noteVn", event.target.value)}
                                                        placeholder="Ghi chú (tuỳ chọn)..."
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
                    <p className="text-xs text-[#5e3f3a]">Đã chọn {selectedEmployeeIds.length} nhân viên.</p>
                </section>

                <section className="space-y-4 rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={processPartEnabled}
                            onChange={(event) => setProcessPartEnabled(event.target.checked)}
                            disabled={isSubmitting}
                            className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                        />
                        <span className="text-sm font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                            Yêu cầu hỗ trợ khác (ăn uống / xe đưa đón / copy)
                        </span>
                    </label>

                    {processPartEnabled && (
                        <div className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-3">
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={processPart.isEat}
                                        onChange={(event) => setProcessPart((current) => ({ ...current, isEat: event.target.checked }))}
                                        disabled={isSubmitting}
                                        className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                                    />
                                    <span className="text-sm text-[#191c1e]">Ăn uống</span>
                                </label>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={processPart.isTransportation}
                                        onChange={(event) =>
                                            setProcessPart((current) => ({ ...current, isTransportation: event.target.checked }))
                                        }
                                        disabled={isSubmitting}
                                        className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                                    />
                                    <span className="text-sm text-[#191c1e]">Xe đưa đón</span>
                                </label>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={processPart.isUseCopyRoom}
                                        onChange={(event) =>
                                            setProcessPart((current) => ({ ...current, isUseCopyRoom: event.target.checked }))
                                        }
                                        disabled={isSubmitting}
                                        className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                                    />
                                    <span className="text-sm text-[#191c1e]">Sử dụng phòng copy</span>
                                </label>
                            </div>

                            {processPart.isEat && (
                                <div className="grid gap-4 rounded-lg border border-[#e0e3e5] bg-[#f8fafc] p-4 md:grid-cols-3">
                                    <label className="block">
                                        <span className={fieldLabelClassName}>Phiếu chính</span>
                                        <input
                                            type="number"
                                            min={0}
                                            value={processPart.mainTicketCount}
                                            onChange={(event) =>
                                                setProcessPart((current) => ({ ...current, mainTicketCount: Number(event.target.value) }))
                                            }
                                            disabled={isSubmitting}
                                            className={fieldClassName}
                                        />
                                    </label>
                                    <label className="block">
                                        <span className={fieldLabelClassName}>Phiếu phụ</span>
                                        <input
                                            type="number"
                                            min={0}
                                            value={processPart.secondaryTicketCount}
                                            onChange={(event) =>
                                                setProcessPart((current) => ({ ...current, secondaryTicketCount: Number(event.target.value) }))
                                            }
                                            disabled={isSubmitting}
                                            className={fieldClassName}
                                        />
                                    </label>
                                    <label className="block">
                                        <span className={fieldLabelClassName}>Sữa</span>
                                        <input
                                            type="number"
                                            min={0}
                                            value={processPart.milkCount}
                                            onChange={(event) =>
                                                setProcessPart((current) => ({ ...current, milkCount: Number(event.target.value) }))
                                            }
                                            disabled={isSubmitting}
                                            className={fieldClassName}
                                        />
                                    </label>
                                </div>
                            )}

                            <label className="block">
                                <span className={fieldLabelClassName}>Đề nghị khác (VN)</span>
                                <input
                                    value={processPart.anotherSuggestionVn ?? ""}
                                    onChange={(event) =>
                                        setProcessPart((current) => ({ ...current, anotherSuggestionVn: event.target.value }))
                                    }
                                    disabled={isSubmitting}
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
                        Huỷ
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isSubmitting ? "Đang lưu..." : isEditMode ? "Lưu thay đổi" : "Tạo đơn"}
                    </button>
                </div>
            </form>
        </div>
    );
}
