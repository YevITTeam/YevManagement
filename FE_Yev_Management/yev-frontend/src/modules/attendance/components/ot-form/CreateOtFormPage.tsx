"use client";

import { useEffect, useMemo, useState } from "react";
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
import type { OtFormEmployeeInputDto, ProcessPartDto } from "@/modules/attendance/types/ot-form.dto";
import SignatureCanvas from "../signature/SignatureCanvas";
import { getApiErrorMessage } from "@/lib/apiError";

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

function computeTotalHour(startTime: string, endTime: string): number {
    if (!startTime || !endTime) return 0;
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const startMinutes = sh * 60 + sm;
    let endMinutes = eh * 60 + em;
    if (endMinutes < startMinutes) endMinutes += 24 * 60; // qua ngày hôm sau
    return Math.round(((endMinutes - startMinutes) / 60) * 100) / 100;
}

const emptyProcessPart: ProcessPartDto = {
    isEat: false,
    isTransportation: false,
    isUseCopyRoom: false,
    anotherSuggestionVn: null,
    anotherSuggestionJp: null,
};

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

export default function CreateOtFormPage() {
    const router = useRouter();

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
    const [employeeOverrides, setEmployeeOverrides] = useState<Record<number, { noteVn: string; noteJp: string }>>({});

    const [processPartEnabled, setProcessPartEnabled] = useState(false);
    const [processPart, setProcessPart] = useState<ProcessPartDto>(emptyProcessPart);

    const [signature, setSignature] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        DepartmentApi.getAllDepartments().then(setDepartments).catch((err) => console.error(err));
        ReasonApi.getAllReasons().then(setReasons).catch((err) => console.error(err));
        OtCaseApi.getAllOtCases().then(setOtCases).catch((err) => console.error(err));
    }, []);

    // Cascading Nhóm theo Bộ phận — đổi Bộ phận thì xoá lựa chọn Nhóm (docs/attendance-api-fe.md §3.2/§8).
    useEffect(() => {
        if (!departmentId) {
            setGroups([]);
            return;
        }
        GroupApi.getGroupsByDepartment(departmentId)
            .then(setGroups)
            .catch((err) => console.error(err));
    }, [departmentId]);

    // Chọn nhân viên hàng loạt theo Nhóm (docs §3.5/§8) — đổi Nhóm thì xoá lựa chọn nhân viên cũ.
    useEffect(() => {
        setSelectedEmployeeIds([]);
        setEmployeeOverrides({});
        if (!groupId) {
            setGroupEmployees([]);
            return;
        }
        EmployeeApi.getEmployeesByGroup(groupId)
            .then(setGroupEmployees)
            .catch((err) => console.error(err));
    }, [groupId]);

    const totalHour = useMemo(() => computeTotalHour(startTime, endTime), [startTime, endTime]);

    const toggleEmployee = (employeeId: number) => {
        setSelectedEmployeeIds((current) =>
            current.includes(employeeId) ? current.filter((id) => id !== employeeId) : [...current, employeeId]
        );
    };

    const handleEmployeeNoteChange = (employeeId: number, field: "noteVn" | "noteJp", value: string) => {
        setEmployeeOverrides((current) => ({
            ...current,
            [employeeId]: { noteVn: current[employeeId]?.noteVn ?? "", noteJp: current[employeeId]?.noteJp ?? "", [field]: value },
        }));
    };

    const handleDepartmentChange = (value: string) => {
        setDepartmentId(value ? Number(value) : null);
        setGroupId(null);
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
        if (!signature) {
            toast.error("Vui lòng ký vào khung chữ ký Người đề nghị.");
            return;
        }

        const employees: OtFormEmployeeInputDto[] = selectedEmployeeIds.map((employeeId) => ({
            employeeId,
            startTime: `${startTime}:00`,
            endTime: `${endTime}:00`,
            noteVn: employeeOverrides[employeeId]?.noteVn?.trim() ? employeeOverrides[employeeId].noteVn.trim() : null,
            noteJp: employeeOverrides[employeeId]?.noteJp?.trim() ? employeeOverrides[employeeId].noteJp.trim() : null,
        }));

        setIsSubmitting(true);
        try {
            const result = await OtFormApi.createOtForm({
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
                submitterSignatureImage: signature,
            });
            toast.success("Tạo đơn tăng ca thành công");
            router.push(`/ot/forms/${result.id}`);
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, "Tạo đơn tăng ca thất bại"));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold text-[#191c1e]">Tạo đơn tăng ca</h1>
                <p className="mt-1 text-[15px] text-[#5e3f3a]">
                    Điền thông tin đơn, chọn nhân viên làm ngoài giờ và ký xác nhận với vai trò Người đề nghị.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <section className="space-y-4 rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">Thông tin đơn</h2>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <label className="block">
                            <span className={fieldLabelClassName}>Bộ phận</span>
                            <select
                                value={departmentId ?? ""}
                                onChange={(event) => handleDepartmentChange(event.target.value)}
                                disabled={isSubmitting}
                                required
                                className={fieldClassName}
                            >
                                <option value="" disabled>
                                    Chọn bộ phận...
                                </option>
                                {departments.map((department) => (
                                    <option key={department.id} value={department.id}>
                                        {department.departmentNameVn}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>Nhóm</span>
                            <select
                                value={groupId ?? ""}
                                onChange={(event) => setGroupId(event.target.value ? Number(event.target.value) : null)}
                                disabled={isSubmitting || !departmentId}
                                required
                                className={fieldClassName}
                            >
                                <option value="" disabled>
                                    {departmentId ? "Chọn nhóm..." : "Chọn Bộ phận trước..."}
                                </option>
                                {groups.map((group) => (
                                    <option key={group.id} value={group.id}>
                                        {group.groupNameVn}
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
                        <p className="text-sm text-[#5e3f3a]">Chọn Nhóm để hiện danh sách nhân viên.</p>
                    ) : groupEmployees.length === 0 ? (
                        <p className="text-sm text-[#5e3f3a]">Nhóm này chưa có nhân viên.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full border-collapse text-left">
                                <thead>
                                    <tr className="border-b border-[#e0e3e5] text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                        <th className="w-10 px-3 py-2"></th>
                                        <th className="px-3 py-2">Mã NV</th>
                                        <th className="px-3 py-2">Họ và tên</th>
                                        <th className="px-3 py-2">Lũy kế tháng/năm</th>
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
                                                    {isOverLimit && " ⚠"}
                                                </td>
                                                <td className="px-3 py-2 align-top">
                                                    <input
                                                        value={employeeOverrides[employee.id]?.noteVn ?? ""}
                                                        onChange={(event) => handleEmployeeNoteChange(employee.id, "noteVn", event.target.value)}
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
                            <label className="block md:col-span-3">
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

                <section className="space-y-4 rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                        Chữ ký Người đề nghị <span className="text-[#930006]">*</span>
                    </h2>
                    <SignatureCanvas onChange={setSignature} disabled={isSubmitting} />
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
                        {isSubmitting ? "Đang tạo..." : "Tạo đơn"}
                    </button>
                </div>
            </form>
        </div>
    );
}
