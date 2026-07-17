"use client";

import { useState } from "react";
import type { DepartmentDto } from "@/modules/attendance/types/department.dto";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";

export interface DepartmentFormValues {
    departmentCode: string;
    departmentNameVn: string;
    departmentNameJp: string | null;
}

interface DepartmentFormProps {
    isOpen: boolean;
    mode: "create" | "edit";
    initial?: DepartmentDto | null;
    loading?: boolean;
    onClose: () => void;
    onSubmit: (values: DepartmentFormValues) => void | Promise<void>;
}

const emptyValues: DepartmentFormValues = { departmentCode: "", departmentNameVn: "", departmentNameJp: null };

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

export default function DepartmentForm({ isOpen, mode, initial, loading = false, onClose, onSubmit }: DepartmentFormProps) {
    const [values, setValues] = useState<DepartmentFormValues>(emptyValues);

    useDialogReset(isOpen, initial, (current) => {
        setValues(
            current
                ? {
                      departmentCode: current.departmentCode,
                      departmentNameVn: current.departmentNameVn,
                      departmentNameJp: current.departmentNameJp,
                  }
                : emptyValues
        );
    });

    if (!isOpen) return null;

    const handleChange = (field: keyof DepartmentFormValues, value: string) => {
        setValues((current) => ({ ...current, [field]: value }));
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!values.departmentCode.trim() || !values.departmentNameVn.trim()) return;
        onSubmit({
            ...values,
            departmentNameJp: values.departmentNameJp?.trim() ? values.departmentNameJp.trim() : null,
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={() => !loading && onClose()} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="department-form-title"
                className="z-60 mx-4 w-full max-w-md rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
            >
                <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                    <h3 id="department-form-title" className="text-lg font-semibold text-[#191c1e]">
                        {mode === "create" ? "Thêm bộ phận" : "Cập nhật bộ phận"}
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
                        <span className={fieldLabelClassName}>Mã bộ phận</span>
                        <input
                            value={values.departmentCode}
                            onChange={(event) => handleChange("departmentCode", event.target.value)}
                            placeholder="Nhập mã bộ phận..."
                            disabled={loading}
                            autoFocus
                            required
                            className={fieldClassName}
                        />
                    </label>

                    <label className="block">
                        <span className={fieldLabelClassName}>Tên bộ phận (VN)</span>
                        <input
                            value={values.departmentNameVn}
                            onChange={(event) => handleChange("departmentNameVn", event.target.value)}
                            placeholder="Nhập tên bộ phận..."
                            disabled={loading}
                            required
                            className={fieldClassName}
                        />
                    </label>

                    <label className="block">
                        <span className={fieldLabelClassName}>Tên bộ phận (JP)</span>
                        <input
                            value={values.departmentNameJp ?? ""}
                            onChange={(event) => handleChange("departmentNameJp", event.target.value)}
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
