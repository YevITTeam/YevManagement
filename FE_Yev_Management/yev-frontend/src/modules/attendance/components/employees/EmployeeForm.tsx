"use client";

import { useEffect, useState } from "react";
import { GroupApi } from "@/modules/attendance/api/group.api";
import type { GroupDto } from "@/modules/attendance/types/group.dto";
import type { EmployeeDto } from "@/modules/attendance/types/employee.dto";

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

    useEffect(() => {
        if (!isOpen) return;
        GroupApi.getAllGroups()
            .then((data) => setGroups(data))
            .catch((err) => console.error(err));
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            setValues(
                initial
                    ? {
                          code: initial.code,
                          firstName: initial.firstName,
                          lastName: initial.lastName,
                          userName: initial.userName,
                          monthToDate: initial.monthToDate,
                          yearToDate: initial.yearToDate,
                          groupId: initial.groupId,
                      }
                    : emptyValues
            );
        }
    }, [isOpen, initial]);

    if (!isOpen) return null;

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!values.code.trim() || !values.firstName.trim() || !values.lastName.trim() || !values.groupId) return;
        onSubmit(values);
    };

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
                        ✕
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

                    <label className="block">
                        <span className={fieldLabelClassName}>Tài khoản AD (userName, tuỳ chọn)</span>
                        <input
                            value={values.userName ?? ""}
                            onChange={(event) =>
                                setValues((current) => ({ ...current, userName: event.target.value.trim() ? event.target.value : null }))
                            }
                            placeholder="VD: YEV\n.van.a — dùng cho Lũy kế của tôi"
                            disabled={loading}
                            className={fieldClassName}
                        />
                    </label>

                    <label className="block">
                        <span className={fieldLabelClassName}>Nhóm</span>
                        <select
                            value={values.groupId || ""}
                            onChange={(event) => setValues((current) => ({ ...current, groupId: Number(event.target.value) }))}
                            disabled={loading}
                            required
                            className={fieldClassName}
                        >
                            <option value="" disabled>
                                Chọn nhóm...
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
