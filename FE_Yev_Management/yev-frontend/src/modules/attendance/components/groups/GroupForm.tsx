"use client";

import { useEffect, useState } from "react";
import { DepartmentApi } from "@/modules/attendance/api/department.api";
import type { DepartmentDto } from "@/modules/attendance/types/department.dto";
import type { GroupDto } from "@/modules/attendance/types/group.dto";

export interface GroupFormValues {
    departmentId: number;
    groupCode: string;
    groupNameVn: string;
    groupNameJp: string | null;
}

interface GroupFormProps {
    isOpen: boolean;
    mode: "create" | "edit";
    initial?: GroupDto | null;
    loading?: boolean;
    onClose: () => void;
    onSubmit: (values: GroupFormValues) => void | Promise<void>;
}

const emptyValues: GroupFormValues = { departmentId: 0, groupCode: "", groupNameVn: "", groupNameJp: null };

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

// docs/attendance-api-fe.md §3.2 — mỗi Nhóm bắt buộc thuộc về 1 Bộ phận.
export default function GroupForm({ isOpen, mode, initial, loading = false, onClose, onSubmit }: GroupFormProps) {
    const [values, setValues] = useState<GroupFormValues>(emptyValues);
    const [departments, setDepartments] = useState<DepartmentDto[]>([]);

    useEffect(() => {
        if (!isOpen) return;
        DepartmentApi.getAllDepartments()
            .then((data) => setDepartments(data))
            .catch((err) => console.error(err));
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            setValues(
                initial
                    ? {
                          departmentId: initial.departmentId,
                          groupCode: initial.groupCode,
                          groupNameVn: initial.groupNameVn,
                          groupNameJp: initial.groupNameJp,
                      }
                    : emptyValues
            );
        }
    }, [isOpen, initial]);

    if (!isOpen) return null;

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!values.departmentId || !values.groupCode.trim() || !values.groupNameVn.trim()) return;
        onSubmit({ ...values, groupNameJp: values.groupNameJp?.trim() ? values.groupNameJp.trim() : null });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={() => !loading && onClose()} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="group-form-title"
                className="z-60 mx-4 w-full max-w-md rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
            >
                <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                    <h3 id="group-form-title" className="text-lg font-semibold text-[#191c1e]">
                        {mode === "create" ? "Thêm nhóm" : "Cập nhật nhóm"}
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
                        <span className={fieldLabelClassName}>Bộ phận</span>
                        <select
                            value={values.departmentId || ""}
                            onChange={(event) => setValues((current) => ({ ...current, departmentId: Number(event.target.value) }))}
                            disabled={loading}
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
                        <span className={fieldLabelClassName}>Mã nhóm</span>
                        <input
                            value={values.groupCode}
                            onChange={(event) => setValues((current) => ({ ...current, groupCode: event.target.value }))}
                            placeholder="Nhập mã nhóm..."
                            disabled={loading}
                            autoFocus
                            required
                            className={fieldClassName}
                        />
                    </label>

                    <label className="block">
                        <span className={fieldLabelClassName}>Tên nhóm (VN)</span>
                        <input
                            value={values.groupNameVn}
                            onChange={(event) => setValues((current) => ({ ...current, groupNameVn: event.target.value }))}
                            placeholder="Nhập tên nhóm..."
                            disabled={loading}
                            required
                            className={fieldClassName}
                        />
                    </label>

                    <label className="block">
                        <span className={fieldLabelClassName}>Tên nhóm (JP)</span>
                        <input
                            value={values.groupNameJp ?? ""}
                            onChange={(event) => setValues((current) => ({ ...current, groupNameJp: event.target.value }))}
                            placeholder="Nhập tên tiếng Nhật (tuỳ chọn)..."
                            disabled={loading}
                            className={fieldClassName}
                        />
                    </label>

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
