"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { BranchDto } from "@/modules/pc-management/types/branch.dto";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";

export interface BranchFormValues {
    branchCode: string;
    branchName: string;
}

interface BranchFormProps {
    isOpen: boolean;
    mode: "create" | "edit";
    initial?: BranchDto | null;
    loading?: boolean;
    onClose: () => void;
    onSubmit: (values: BranchFormValues) => void | Promise<void>;
}

const emptyValues: BranchFormValues = { branchCode: "", branchName: "" };

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

export default function BranchForm({ isOpen, mode, initial, loading = false, onClose, onSubmit }: BranchFormProps) {
    const [values, setValues] = useState<BranchFormValues>(emptyValues);

    useDialogReset(isOpen, initial, (current) => {
        setValues(current ? { branchCode: current.branchCode, branchName: current.branchName } : emptyValues);
    });

    if (!isOpen) return null;

    const handleChange = (field: keyof BranchFormValues, value: string) => {
        setValues((current) => ({ ...current, [field]: value }));
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!values.branchCode.trim() || !values.branchName.trim()) return;
        onSubmit(values);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={() => !loading && onClose()} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="branch-form-title"
                className="z-60 mx-4 w-full max-w-md rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
            >
                <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                    <h3 id="branch-form-title" className="text-lg font-semibold text-[#191c1e]">
                        {mode === "create" ? "Thêm chi nhánh" : "Cập nhật chi nhánh"}
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
                        <span className={fieldLabelClassName}>Mã chi nhánh</span>
                        <input
                            value={values.branchCode}
                            onChange={(event) => handleChange("branchCode", event.target.value)}
                            placeholder="Nhập mã chi nhánh..."
                            disabled={loading}
                            autoFocus
                            required
                            className={fieldClassName}
                        />
                    </label>

                    <label className="block">
                        <span className={fieldLabelClassName}>Tên chi nhánh</span>
                        <input
                            value={values.branchName}
                            onChange={(event) => handleChange("branchName", event.target.value)}
                            placeholder="Nhập tên chi nhánh..."
                            disabled={loading}
                            required
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
