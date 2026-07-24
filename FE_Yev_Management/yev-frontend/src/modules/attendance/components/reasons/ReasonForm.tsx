"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { ReasonDto } from "@/modules/attendance/types/reason.dto";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";

export interface ReasonFormValues {
    reasonNameVn: string;
    reasonNameJp: string | null;
}

interface ReasonFormProps {
    isOpen: boolean;
    mode: "create" | "edit";
    initial?: ReasonDto | null;
    loading?: boolean;
    onClose: () => void;
    onSubmit: (values: ReasonFormValues) => void | Promise<void>;
}

const emptyValues: ReasonFormValues = { reasonNameVn: "", reasonNameJp: null };

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

export default function ReasonForm({ isOpen, mode, initial, loading = false, onClose, onSubmit }: ReasonFormProps) {
    const [values, setValues] = useState<ReasonFormValues>(emptyValues);

    useDialogReset(isOpen, initial, (current) => {
        setValues(current ? { reasonNameVn: current.reasonNameVn, reasonNameJp: current.reasonNameJp } : emptyValues);
    });

    if (!isOpen) return null;

    const handleChange = (field: keyof ReasonFormValues, value: string) => {
        setValues((current) => ({ ...current, [field]: value }));
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!values.reasonNameVn.trim()) return;
        onSubmit({ ...values, reasonNameJp: values.reasonNameJp?.trim() ? values.reasonNameJp.trim() : null });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={() => !loading && onClose()} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="reason-form-title"
                className="z-60 mx-4 w-full max-w-md rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
            >
                <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                    <h3 id="reason-form-title" className="text-lg font-semibold text-[#191c1e]">
                        {mode === "create" ? "Thêm lý do" : "Cập nhật lý do"}
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
                        <span className={fieldLabelClassName}>Lý do (VN)</span>
                        <input
                            value={values.reasonNameVn}
                            onChange={(event) => handleChange("reasonNameVn", event.target.value)}
                            placeholder="Nhập lý do tăng ca..."
                            disabled={loading}
                            autoFocus
                            required
                            className={fieldClassName}
                        />
                    </label>

                    <label className="block">
                        <span className={fieldLabelClassName}>Lý do (JP)</span>
                        <input
                            value={values.reasonNameJp ?? ""}
                            onChange={(event) => handleChange("reasonNameJp", event.target.value)}
                            placeholder="Nhập lý do tiếng Nhật (tuỳ chọn)..."
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
