"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { GroupApi } from "@/modules/attendance/api/group.api";
import type { GroupDto } from "@/modules/attendance/types/group.dto";
import type { EmployeeDto } from "@/modules/attendance/types/employee.dto";
import { AuthApi } from "@/modules/auth/api/auth.api";
import type { UserDto } from "@/modules/auth/types/auth.dto";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";

export interface EmployeeFormValues {
    code: string;
    firstName: string;
    lastName: string;
    userName: string | null;
    monthToDate: number;
    yearToDate: number;
    groupId: number;
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
    monthToDate: 0,
    yearToDate: 0,
    groupId: 0,
};

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

export default function EmployeeForm({ isOpen, mode, initial, loading = false, onClose, onSubmit }: EmployeeFormProps) {
    const [values, setValues] = useState<EmployeeFormValues>(emptyValues);
    const [groups, setGroups] = useState<GroupDto[]>([]);
    const [usersWithRoles, setUsersWithRoles] = useState<UserDto[]>([]);
    const [showUserSuggestions, setShowUserSuggestions] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        GroupApi.getAllGroups()
            .then((data) => setGroups(data))
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
                      monthToDate: current.monthToDate,
                      yearToDate: current.yearToDate,
                      groupId: current.groupId,
                  }
                : emptyValues
        );
    });

    if (!isOpen) return null;

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!values.code.trim() || !values.firstName.trim() || !values.lastName.trim() || !values.groupId) return;
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
                        {mode === "create" ? "Thêm nhân viên" : "Cập nhật nhân viên"}
                    </h3>
                    <button
                        type="button"
                        onClick={() => !loading && onClose()}
                        className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                        aria-label="Đóng"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <label className="block">
                        <span className={fieldLabelClassName}>Mã nhân viên</span>
                        <input
                            value={values.code}
                            onChange={(event) => setValues((current) => ({ ...current, code: event.target.value }))}
                            placeholder="Nhập mã nhân viên..."
                            disabled={loading}
                            autoFocus
                            required
                            className={fieldClassName}
                        />
                    </label>

                    <div className="grid grid-cols-2 gap-4">
                        <label className="block">
                            <span className={fieldLabelClassName}>Họ</span>
                            <input
                                value={values.lastName}
                                onChange={(event) => setValues((current) => ({ ...current, lastName: event.target.value }))}
                                placeholder="Nguyễn Văn"
                                disabled={loading}
                                required
                                className={fieldClassName}
                            />
                        </label>
                        <label className="block">
                            <span className={fieldLabelClassName}>Tên</span>
                            <input
                                value={values.firstName}
                                onChange={(event) => setValues((current) => ({ ...current, firstName: event.target.value }))}
                                placeholder="A"
                                disabled={loading}
                                required
                                className={fieldClassName}
                            />
                        </label>
                    </div>

                    <label className="relative block">
                        <span className={fieldLabelClassName}>Tài khoản AD (userName, tuỳ chọn)</span>
                        <input
                            value={values.userName ?? ""}
                            onChange={(event) =>
                                setValues((current) => ({ ...current, userName: event.target.value.trim() ? event.target.value : null }))
                            }
                            onFocus={() => setShowUserSuggestions(true)}
                            onBlur={() => setShowUserSuggestions(false)}
                            placeholder="VD: YEV\n.van.a — dùng cho Lũy kế của tôi"
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
                        <span className={fieldLabelClassName}>Bộ phận</span>
                        <select
                            value={values.groupId || ""}
                            onChange={(event) => setValues((current) => ({ ...current, groupId: Number(event.target.value) }))}
                            disabled={loading}
                            required
                            className={fieldClassName}
                        >
                            <option value="" disabled>
                                Chọn bộ phận...
                            </option>
                            {groups.map((group) => (
                                <option key={group.id} value={group.id}>
                                    {group.groupNameVn}
                                </option>
                            ))}
                        </select>
                    </label>

                    <div className="grid grid-cols-2 gap-4">
                        <label className="block">
                            <span className={fieldLabelClassName}>Lũy kế tháng (giờ)</span>
                            <input
                                type="number"
                                step="0.5"
                                min={0}
                                value={values.monthToDate}
                                onChange={(event) => setValues((current) => ({ ...current, monthToDate: Number(event.target.value) }))}
                                disabled={loading}
                                className={fieldClassName}
                            />
                        </label>
                        <label className="block">
                            <span className={fieldLabelClassName}>Lũy kế năm (giờ)</span>
                            <input
                                type="number"
                                step="0.5"
                                min={0}
                                value={values.yearToDate}
                                onChange={(event) => setValues((current) => ({ ...current, yearToDate: Number(event.target.value) }))}
                                disabled={loading}
                                className={fieldClassName}
                            />
                        </label>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Huỷ
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {loading ? "Đang lưu..." : mode === "create" ? "Tạo mới" : "Lưu thay đổi"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
