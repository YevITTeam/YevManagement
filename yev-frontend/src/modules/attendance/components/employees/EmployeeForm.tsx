"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { GroupApi } from "@/modules/attendance/api/group.api";
import type { GroupDto } from "@/modules/attendance/types/group.dto";
import { DepartmentApi } from "@/modules/attendance/api/department.api";
import type { DepartmentDto } from "@/modules/attendance/types/department.dto";
import { WorkshopApi } from "@/modules/attendance/api/workshop.api";
import type { WorkshopDto } from "@/modules/attendance/types/workshop.dto";
import { SearchableSelect, type SelectOption } from "@/components/ui/SearchableSelect";
import { RequiredMark } from "@/components/ui/RequiredMark";
import { JobTitleApi } from "@/modules/attendance/api/job-title.api";
import type { JobTitleDto } from "@/modules/attendance/types/job-title.dto";
import type { EmployeeDto } from "@/modules/attendance/types/employee.dto";
import type { EmployeeScopeDto } from "@/modules/attendance/api/employee.api";
import { AuthApi } from "@/modules/auth/api/auth.api";
import type { UserDto } from "@/modules/auth/types/auth.dto";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";
import { useAttendanceSetting } from "@/modules/attendance/hooks/useAttendanceSetting";

// JobTitleTerminalLevel (docs/attendance-module.md §API) — 0=None, 1=DepartmentManager, 2=WorkshopManager, 3=GeneralDirector.
const TERMINAL_LEVEL_NONE = 0;
const TERMINAL_LEVEL_DEPARTMENT_MANAGER = 1;

export interface EmployeeFormValues {
    code: string;
    firstName: string;
    lastName: string;
    userName: string | null;
    // Đúng 1 trong 2 field được điền tuỳ theo Chức vụ (2026-08-08, xem docs §Cây chức vụ):
    // TerminalLevel=None → groupId bắt buộc; =DepartmentManager (Trưởng phòng) → departmentId bắt
    // buộc; =WorkshopManager/GeneralDirector (Trưởng Xưởng/Giám đốc) → cả 2 đều null.
    groupId: number | null;
    departmentId: number | null;
    // Department Managers: the (workshop, department) pairs they approve for (0 = not chosen yet).
    approvalScopes: { workshopId: number; departmentId: number }[];
    jobTitleId: number | null;
    // Giới hạn giờ OT/tháng/năm RIÊNG cho nhân viên này — null = dùng mặc định chung (2026-08-26, theo
    // yêu cầu người dùng — cho phép "gia hạn" cao hơn mặc định, thường dùng cho công nhân dưới chuyền).
    // Không có Ngày riêng — Ngày luôn dùng chung 1 mốc cho mọi người.
    customMonthlyOtHourLimit: number | null;
    customYearlyOtHourLimit: number | null;
}

interface EmployeeFormProps {
    isOpen: boolean;
    mode: "create" | "edit";
    initial?: EmployeeDto | null;
    loading?: boolean;
    onClose: () => void;
    onSubmit: (values: EmployeeFormValues) => void | Promise<void>;
    // Phạm vi Coordinator của người gọi (2026-09-28, xem EmployeeList.tsx) — không phải Admin/toàn công
    // ty thì chỉ hiện đúng Bộ phận/Nhóm mình phụ trách trong 2 dropdown bên dưới, khớp với những gì BE
    // thật sự cho phép tạo/sửa (EmployeeService.EnsureAssignmentInCallerScopeAsync) — tránh chọn xong
    // mới bị 400. `undefined`/`null`/`companyWide` → giữ hành vi cũ (tải toàn bộ công ty).
    scope?: EmployeeScopeDto | null;
    // Show the per-employee OT limit fields when editing (create mode always shows them). Needs
    // Attendance.Employee.UpdateOtLimit because the limits are saved through a separate endpoint.
    canEditOtLimit?: boolean;
}

const emptyValues: EmployeeFormValues = {
    code: "",
    firstName: "",
    lastName: "",
    userName: null,
    groupId: null,
    departmentId: null,
    approvalScopes: [],
    jobTitleId: null,
    customMonthlyOtHourLimit: null,
    customYearlyOtHourLimit: null,
};

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

export default function EmployeeForm({ isOpen, mode, initial, loading = false, onClose, onSubmit, scope, canEditOtLimit = false }: EmployeeFormProps) {
    const t = useTranslations("Attendance.Employee");
    const tCommon = useTranslations("Common");
    const { setting } = useAttendanceSetting();
    const [values, setValues] = useState<EmployeeFormValues>(emptyValues);
    const [groups, setGroups] = useState<GroupDto[]>([]);
    const [departments, setDepartments] = useState<DepartmentDto[]>([]);
    const [workshops, setWorkshops] = useState<WorkshopDto[]>([]);
    const [jobTitles, setJobTitles] = useState<JobTitleDto[]>([]);
    const [usersWithRoles, setUsersWithRoles] = useState<UserDto[]>([]);
    const [showUserSuggestions, setShowUserSuggestions] = useState(false);
    // Bộ phận dùng để LỌC danh sách Nhóm cho nhân viên thường (Bộ phận của họ suy ra từ Nhóm, không lưu
    // riêng). null = chưa chọn tay, lấy theo Bộ phận của Nhóm đang chọn.
    const [departmentFilter, setDepartmentFilter] = useState<number | "" | null>(null);
    const [workshopFilter, setWorkshopFilter] = useState<number | "" | null>(null);

    // Bị giới hạn theo Coordinator (2026-09-28) — dùng THẲNG danh sách BE đã trả sẵn trong `scope` (khớp
    // đúng phạm vi BE thật sự cho phép, xem EmployeeList.tsx) thay vì gọi API "toàn công ty" + set lại
    // qua state riêng (tránh setState đồng bộ trong effect, frontend-conventions.md §3).
    const isScopeRestricted = Boolean(scope && !scope.companyWide);
    const effectiveGroups = isScopeRestricted ? scope!.groups : groups;
    const effectiveDepartments = isScopeRestricted ? scope!.departments : departments;
    const effectiveWorkshops = isScopeRestricted ? scope!.workshops : workshops;

    useEffect(() => {
        if (!isOpen) return;
        if (!isScopeRestricted) {
            GroupApi.getAllGroups()
                .then((data) => setGroups(data))
                .catch((err) => console.error(err));
            DepartmentApi.getAllDepartments()
                .then((data) => setDepartments(data))
                .catch((err) => console.error(err));
            WorkshopApi.getAllWorkshops()
                .then((data) => setWorkshops(data))
                .catch((err) => console.error(err));
        }
        JobTitleApi.getAllJobTitles()
            .then((data) => setJobTitles(data))
            .catch((err) => console.error(err));
        AuthApi.getAllUsersWithRoles()
            .then((data) => setUsersWithRoles(data))
            .catch((err) => console.error(err));
    }, [isOpen, isScopeRestricted]);

    useDialogReset(isOpen, initial, (current) => {
        setDepartmentFilter(null);
        setWorkshopFilter(null);
        setValues(
            current
                ? {
                      code: current.code,
                      firstName: current.firstName,
                      lastName: current.lastName,
                      userName: current.userName,
                      groupId: current.groupId,
                      departmentId: current.departmentId,
                      approvalScopes: current.approvalScopes.map((s) => ({ workshopId: s.workshopId, departmentId: s.departmentId })),
                      jobTitleId: current.jobTitleId,
                      customMonthlyOtHourLimit: current.customMonthlyOtHourLimit,
                      customYearlyOtHourLimit: current.customYearlyOtHourLimit,
                  }
                : emptyValues
        );
    });

    if (!isOpen) return null;

    const selectedJobTitle = jobTitles.find((jt) => jt.id === values.jobTitleId);
    const terminalLevel = selectedJobTitle?.terminalLevel ?? TERMINAL_LEVEL_NONE;
    const needsGroup = terminalLevel === TERMINAL_LEVEL_NONE;
    const needsDepartment = terminalLevel === TERMINAL_LEVEL_DEPARTMENT_MANAGER;

    const jobTitleOptions: SelectOption[] = jobTitles.map((jt) => ({ value: jt.id, label: jt.name, searchText: jt.name.toLowerCase() }));
    const departmentOptions: SelectOption[] = effectiveDepartments.map((d) => ({
        value: d.id,
        label: d.departmentNameVn,
        searchText: d.departmentNameVn.toLowerCase(),
    }));

    const workshopOptions: SelectOption[] = effectiveWorkshops.map((w) => ({
        value: w.id,
        label: w.workshopNameVn,
        searchText: w.workshopNameVn.toLowerCase(),
    }));

    const selectedGroup = effectiveGroups.find((g) => g.id === values.groupId);
    const effectiveDepartmentFilter = departmentFilter ?? selectedGroup?.departmentId ?? "";
    const effectiveWorkshopFilter = workshopFilter ?? selectedGroup?.workshopId ?? "";
    const filteredGroupOptions = effectiveGroups
        .filter((g) => (effectiveDepartmentFilter === "" || g.departmentId === effectiveDepartmentFilter)
            && (effectiveWorkshopFilter === "" || g.workshopId === effectiveWorkshopFilter))
        .map((g) => ({ value: g.id, label: g.groupNameVn, searchText: g.groupNameVn.toLowerCase() }));

    const handleDepartmentFilterChange = (v: number | "") => {
        setDepartmentFilter(v);
        // Nhóm đang chọn không thuộc Bộ phận mới → bỏ chọn để phải chọn lại Nhóm đúng Bộ phận.
        setValues((current) => {
            const currentGroup = effectiveGroups.find((g) => g.id === current.groupId);
            return v !== "" && currentGroup && currentGroup.departmentId !== v ? { ...current, groupId: null } : current;
        });
    };

    const handleWorkshopFilterChange = (v: number | "") => {
        setWorkshopFilter(v);
        setValues((current) => {
            const currentGroup = effectiveGroups.find((g) => g.id === current.groupId);
            return v !== "" && currentGroup && currentGroup.workshopId !== v ? { ...current, groupId: null } : current;
        });
    };

    const updateScope = (index: number, patch: Partial<{ workshopId: number; departmentId: number }>) =>
        setValues((current) => ({
            ...current,
            approvalScopes: current.approvalScopes.map((s, i) => (i === index ? { ...s, ...patch } : s)),
        }));

    const handleJobTitleChange = (value: number | "") => {
        const nextJobTitleId = value === "" ? null : value;
        const nextJobTitle = jobTitles.find((jt) => jt.id === nextJobTitleId);
        const nextTerminalLevel = nextJobTitle?.terminalLevel ?? TERMINAL_LEVEL_NONE;
        // Đổi nhóm Chức vụ (thường/Trưởng phòng/Trưởng Xưởng-Giám đốc) làm giá trị Bộ phận/Phòng ban
        // cũ không còn hợp lệ — reset để tránh gửi lẫn field sai lên BE.
        setValues((current) => ({
            ...current,
            jobTitleId: nextJobTitleId,
            groupId: nextTerminalLevel === TERMINAL_LEVEL_NONE ? current.groupId : null,
            departmentId: nextTerminalLevel === TERMINAL_LEVEL_DEPARTMENT_MANAGER ? current.departmentId : null,
            approvalScopes: nextTerminalLevel === TERMINAL_LEVEL_DEPARTMENT_MANAGER ? current.approvalScopes : [],
        }));
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!values.code.trim() || !values.firstName.trim() || !values.lastName.trim()) return;
        if (needsGroup && !values.groupId) return;
        if (needsDepartment && (values.approvalScopes.length === 0 || values.approvalScopes.some((s) => !s.workshopId || !s.departmentId))) return;
        onSubmit({ ...values, departmentId: needsDepartment ? values.approvalScopes[0].departmentId : values.departmentId });
    };

    const userNameFilter = (values.userName ?? "").trim().toLowerCase();
    const filteredUserSuggestions = (
        userNameFilter
            ? usersWithRoles.filter(
                  (u) => u.userName.toLowerCase().includes(userNameFilter) || u.fullName.toLowerCase().includes(userNameFilter)
              )
            : usersWithRoles
    ).slice(0, 8);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={() => !loading && onClose()} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="employee-form-title"
                className="z-60 mx-4 w-full max-w-2xl rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
            >
                <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                    <h3 id="employee-form-title" className="text-lg font-semibold text-[#191c1e]">
                        {mode === "create" ? t("createTitle") : t("editTitle")}
                    </h3>
                    <button
                        type="button"
                        onClick={() => !loading && onClose()}
                        className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                        aria-label={tCommon("close")}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block">
                            <span className={fieldLabelClassName}>{t("fieldCode")}<RequiredMark /></span>
                            <input
                                value={values.code}
                                onChange={(event) => setValues((current) => ({ ...current, code: event.target.value }))}
                                placeholder={t("fieldCodePlaceholder")}
                                disabled={loading}
                                autoFocus
                                required
                                className={fieldClassName}
                            />
                        </label>

                        <label className="relative block">
                            <span className={fieldLabelClassName}>{t("fieldUserName")}</span>
                            <input
                                value={values.userName ?? ""}
                                onChange={(event) =>
                                    setValues((current) => ({ ...current, userName: event.target.value.trim() ? event.target.value : null }))
                                }
                                onFocus={() => setShowUserSuggestions(true)}
                                onBlur={() => setShowUserSuggestions(false)}
                                placeholder={t("fieldUserNamePlaceholder")}
                                disabled={loading}
                                autoComplete="off"
                                className={fieldClassName}
                            />
                            {showUserSuggestions && filteredUserSuggestions.length > 0 && (
                                <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-[#e0e3e5] bg-white shadow-lg">
                                    {filteredUserSuggestions.map((u) => (
                                        <li key={u.id}>
                                            <button
                                                type="button"
                                                onMouseDown={(event) => event.preventDefault()}
                                                onClick={() => {
                                                    setValues((current) => ({ ...current, userName: u.userName }));
                                                    setShowUserSuggestions(false);
                                                }}
                                                className="block w-full cursor-pointer px-3 py-2 text-left text-sm hover:bg-[#f8fafc]"
                                            >
                                                <div className="font-semibold text-[#191c1e]">{u.fullName || u.userName}</div>
                                                <div className="text-xs text-[#5e3f3a]">{u.userName}</div>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>{t("fieldLastName")}<RequiredMark /></span>
                            <input
                                value={values.lastName}
                                onChange={(event) => setValues((current) => ({ ...current, lastName: event.target.value }))}
                                placeholder={t("fieldLastNamePlaceholder")}
                                disabled={loading}
                                required
                                className={fieldClassName}
                            />
                        </label>
                        <label className="block">
                            <span className={fieldLabelClassName}>{t("fieldFirstName")}<RequiredMark /></span>
                            <input
                                value={values.firstName}
                                onChange={(event) => setValues((current) => ({ ...current, firstName: event.target.value }))}
                                placeholder={t("fieldFirstNamePlaceholder")}
                                disabled={loading}
                                required
                                className={fieldClassName}
                            />
                        </label>

                        <label className="block sm:col-span-2">
                            <span className={fieldLabelClassName}>{t("fieldJobTitle")}</span>
                            <SearchableSelect
                                options={jobTitleOptions}
                                value={values.jobTitleId ?? ""}
                                onChange={handleJobTitleChange}
                                placeholder={t("fieldJobTitlePlaceholder")}
                                disabled={loading}
                            />
                        </label>

                        {needsDepartment && (
                            <div className="space-y-2 sm:col-span-2">
                                <span className={fieldLabelClassName}>{t("fieldApprovalScopes")}<RequiredMark /></span>
                                {values.approvalScopes.map((scopeRow, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <div className="w-44 shrink-0">
                                            <SearchableSelect
                                                options={workshopOptions}
                                                value={scopeRow.workshopId || ""}
                                                onChange={(v) => updateScope(index, { workshopId: v === "" ? 0 : v })}
                                                placeholder={t("fieldWorkshopPlaceholder")}
                                                disabled={loading}
                                            />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <SearchableSelect
                                                options={departmentOptions}
                                                value={scopeRow.departmentId || ""}
                                                onChange={(v) => updateScope(index, { departmentId: v === "" ? 0 : v })}
                                                placeholder={t("fieldDepartmentPlaceholder")}
                                                disabled={loading}
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setValues((current) => ({ ...current, approvalScopes: current.approvalScopes.filter((_, i) => i !== index) }))}
                                            disabled={loading}
                                            title={t("removeApprovalScope")}
                                            aria-label={t("removeApprovalScope")}
                                            className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#e0e3e5] text-[#5e3f3a] transition hover:bg-[#f2f4f6] disabled:opacity-50"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => setValues((current) => ({ ...current, approvalScopes: [...current.approvalScopes, { workshopId: 0, departmentId: 0 }] }))}
                                    disabled={loading}
                                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-[#c9ced3] px-3 py-1.5 text-xs font-semibold text-[#5e3f3a] transition hover:border-[#e3000f] hover:text-[#e3000f] disabled:opacity-50"
                                >
                                    <Plus className="h-3.5 w-3.5" /> {t("addApprovalScope")}
                                </button>
                            </div>
                        )}

                        {needsGroup && (
                            <label className="block">
                                <span className={fieldLabelClassName}>{t("fieldWorkshop")}</span>
                                <SearchableSelect
                                    options={workshopOptions}
                                    value={effectiveWorkshopFilter}
                                    onChange={(v) => handleWorkshopFilterChange(v)}
                                    placeholder={t("fieldWorkshopPlaceholder")}
                                    disabled={loading}
                                />
                            </label>
                        )}

                        {needsGroup && (
                            <label className="block">
                                <span className={fieldLabelClassName}>{t("fieldDepartment")}</span>
                                <SearchableSelect
                                    options={departmentOptions}
                                    value={effectiveDepartmentFilter}
                                    onChange={(v) => handleDepartmentFilterChange(v)}
                                    placeholder={t("fieldDepartmentPlaceholder")}
                                    disabled={loading}
                                />
                            </label>
                        )}

                        {needsGroup && (
                            <label className="block">
                                <span className={fieldLabelClassName}>{t("fieldGroup")}<RequiredMark /></span>
                                <SearchableSelect
                                    options={filteredGroupOptions}
                                    value={values.groupId ?? ""}
                                    onChange={(v) => setValues((current) => ({ ...current, groupId: v === "" ? null : v }))}
                                    placeholder={t("fieldGroupPlaceholder")}
                                    disabled={loading}
                                />
                            </label>
                        )}

                        {/* Per-employee OT limits (override the shared default). Saved apart from the main PUT:
                            on create they ride along with POST, on edit EmployeeList calls PUT /{id}/ot-limit. */}
                        {(mode === "create" || canEditOtLimit) && (
                            <>
                                <label className="block">
                                    <span className={fieldLabelClassName}>{t("fieldCustomMonthlyOtHourLimit")}</span>
                                    <input
                                        type="number"
                                        step="1"
                                        min={1}
                                        value={values.customMonthlyOtHourLimit ?? ""}
                                        onChange={(event) =>
                                            setValues((current) => ({
                                                ...current,
                                                customMonthlyOtHourLimit: event.target.value === "" ? null : Number(event.target.value),
                                            }))
                                        }
                                        placeholder={String(setting.monthlyOtHourLimit)}
                                        disabled={loading}
                                        className={fieldClassName}
                                    />
                                </label>
                                <label className="block">
                                    <span className={fieldLabelClassName}>{t("fieldCustomYearlyOtHourLimit")}</span>
                                    <input
                                        type="number"
                                        step="1"
                                        min={1}
                                        value={values.customYearlyOtHourLimit ?? ""}
                                        onChange={(event) =>
                                            setValues((current) => ({
                                                ...current,
                                                customYearlyOtHourLimit: event.target.value === "" ? null : Number(event.target.value),
                                            }))
                                        }
                                        placeholder={String(setting.yearlyOtHourLimit)}
                                        disabled={loading}
                                        className={fieldClassName}
                                    />
                                </label>
                            </>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {tCommon("cancel")}
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {loading ? t("saving") : mode === "create" ? t("createSubmit") : t("updateSubmit")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
