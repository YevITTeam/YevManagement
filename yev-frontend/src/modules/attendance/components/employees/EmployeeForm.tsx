"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { GroupApi } from "@/modules/attendance/api/group.api";
import type { GroupDto } from "@/modules/attendance/types/group.dto";
import { DepartmentApi } from "@/modules/attendance/api/department.api";
import type { DepartmentDto } from "@/modules/attendance/types/department.dto";
import { SearchableSelect, type SelectOption } from "@/components/ui/SearchableSelect";
import { JobTitleApi } from "@/modules/attendance/api/job-title.api";
import type { JobTitleDto } from "@/modules/attendance/types/job-title.dto";
import type { EmployeeDto } from "@/modules/attendance/types/employee.dto";
import { AuthApi } from "@/modules/auth/api/auth.api";
import type { UserDto } from "@/modules/auth/types/auth.dto";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";
import { useAttendanceSetting } from "@/modules/attendance/hooks/useAttendanceSetting";

// JobTitleTerminalLevel (docs/attendance-api-fe.md) — 0=None, 1=DepartmentManager, 2=WorkshopManager, 3=GeneralDirector.
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
}

const emptyValues: EmployeeFormValues = {
    code: "",
    firstName: "",
    lastName: "",
    userName: null,
    groupId: null,
    departmentId: null,
    jobTitleId: null,
    customMonthlyOtHourLimit: null,
    customYearlyOtHourLimit: null,
};

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

export default function EmployeeForm({ isOpen, mode, initial, loading = false, onClose, onSubmit }: EmployeeFormProps) {
    const t = useTranslations("Attendance.Employee");
    const tCommon = useTranslations("Common");
    const { setting } = useAttendanceSetting();
    const [values, setValues] = useState<EmployeeFormValues>(emptyValues);
    const [groups, setGroups] = useState<GroupDto[]>([]);
    const [departments, setDepartments] = useState<DepartmentDto[]>([]);
    const [jobTitles, setJobTitles] = useState<JobTitleDto[]>([]);
    const [usersWithRoles, setUsersWithRoles] = useState<UserDto[]>([]);
    const [showUserSuggestions, setShowUserSuggestions] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        GroupApi.getAllGroups()
            .then((data) => setGroups(data))
            .catch((err) => console.error(err));
        DepartmentApi.getAllDepartments()
            .then((data) => setDepartments(data))
            .catch((err) => console.error(err));
        JobTitleApi.getAllJobTitles()
            .then((data) => setJobTitles(data))
            .catch((err) => console.error(err));
        AuthApi.getAllUsersWithRoles()
            .then((data) => setUsersWithRoles(data))
            .catch((err) => console.error(err));
    }, [isOpen]);

    useDialogReset(isOpen, initial, (current) => {
        setValues(
            current
                ? {
                      code: current.code,
                      firstName: current.firstName,
                      lastName: current.lastName,
                      userName: current.userName,
                      groupId: current.groupId,
                      departmentId: current.departmentId,
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
    const isCompanyWide = !needsGroup && !needsDepartment;

    const groupOptions: SelectOption[] = groups.map((g) => ({ value: g.id, label: g.groupNameVn, searchText: g.groupNameVn.toLowerCase() }));
    const departmentOptions: SelectOption[] = departments.map((d) => ({
        value: d.id,
        label: d.departmentNameVn,
        searchText: d.departmentNameVn.toLowerCase(),
    }));

    const handleJobTitleChange = (value: string) => {
        const nextJobTitleId = value ? Number(value) : null;
        const nextJobTitle = jobTitles.find((jt) => jt.id === nextJobTitleId);
        const nextTerminalLevel = nextJobTitle?.terminalLevel ?? TERMINAL_LEVEL_NONE;
        // Đổi nhóm Chức vụ (thường/Trưởng phòng/Trưởng Xưởng-Giám đốc) làm giá trị Bộ phận/Phòng ban
        // cũ không còn hợp lệ — reset để tránh gửi lẫn field sai lên BE.
        setValues((current) => ({
            ...current,
            jobTitleId: nextJobTitleId,
            groupId: nextTerminalLevel === TERMINAL_LEVEL_NONE ? current.groupId : null,
            departmentId: nextTerminalLevel === TERMINAL_LEVEL_DEPARTMENT_MANAGER ? current.departmentId : null,
        }));
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!values.code.trim() || !values.firstName.trim() || !values.lastName.trim()) return;
        if (needsGroup && !values.groupId) return;
        if (needsDepartment && !values.departmentId) return;
        onSubmit(values);
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
                className="z-60 mx-4 w-full max-w-md rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
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

                <form onSubmit={handleSubmit} className="space-y-4">
                    <label className="block">
                        <span className={fieldLabelClassName}>{t("fieldCode")}</span>
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

                    <div className="grid grid-cols-2 gap-4">
                        <label className="block">
                            <span className={fieldLabelClassName}>{t("fieldLastName")}</span>
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
                            <span className={fieldLabelClassName}>{t("fieldFirstName")}</span>
                            <input
                                value={values.firstName}
                                onChange={(event) => setValues((current) => ({ ...current, firstName: event.target.value }))}
                                placeholder={t("fieldFirstNamePlaceholder")}
                                disabled={loading}
                                required
                                className={fieldClassName}
                            />
                        </label>
                    </div>

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
                        <span className={fieldLabelClassName}>{t("fieldJobTitle")}</span>
                        <select
                            value={values.jobTitleId ?? ""}
                            onChange={(event) => handleJobTitleChange(event.target.value)}
                            disabled={loading}
                            className={fieldClassName}
                        >
                            <option value="">{t("fieldJobTitlePlaceholder")}</option>
                            {jobTitles.map((jobTitle) => (
                                <option key={jobTitle.id} value={jobTitle.id}>
                                    {jobTitle.name}
                                </option>
                            ))}
                        </select>
                    </label>

                    {needsGroup && (
                        <label className="block">
                            <span className={fieldLabelClassName}>{t("fieldGroup")}</span>
                            <SearchableSelect
                                options={groupOptions}
                                value={values.groupId ?? ""}
                                onChange={(v) => setValues((current) => ({ ...current, groupId: v === "" ? null : v }))}
                                placeholder={t("fieldGroupPlaceholder")}
                                disabled={loading}
                            />
                        </label>
                    )}

                    {needsDepartment && (
                        <label className="block">
                            <span className={fieldLabelClassName}>{t("fieldDepartment")}</span>
                            <SearchableSelect
                                options={departmentOptions}
                                value={values.departmentId ?? ""}
                                onChange={(v) => setValues((current) => ({ ...current, departmentId: v === "" ? null : v }))}
                                placeholder={t("fieldDepartmentPlaceholder")}
                                disabled={loading}
                            />
                            <p className="mt-1.5 text-xs text-[#8a8f94]">{t("fieldDepartmentHint")}</p>
                        </label>
                    )}

                    {isCompanyWide && (
                        <p className="rounded-lg border border-[#e0e3e5] bg-[#f8fafc] px-3 py-2.5 text-xs text-[#5e3f3a]">
                            {t("companyWideHint")}
                        </p>
                    )}

                    {/* Giới hạn OT riêng — "gia hạn" cao hơn mặc định chung cho từng người (2026-08-26,
                        theo yêu cầu người dùng, thường dùng cho công nhân dưới chuyền). Để trống = dùng
                        mặc định hệ thống. Không có Ngày riêng — Ngày luôn dùng chung 1 mốc cho mọi người. */}
                    <div className="grid grid-cols-2 gap-4">
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
                    </div>
                    <p className="-mt-2 text-xs text-[#8a8f94]">{t("fieldCustomOtHourLimitHint")}</p>

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
