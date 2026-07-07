"use client";

import { useEffect, useState } from "react";
import type { DeviceTypeDto } from "@/modules/pc-management/types/device-type.dto";

export interface DeviceTypeFormValues {
    typeCode: string;
    typeName: string;
}

interface DeviceTypeFormProps {
    isOpen: boolean;
    mode: "create" | "edit";
    initial?: DeviceTypeDto | null;
    loading?: boolean;
    onClose: () => void;
    onSubmit: (values: DeviceTypeFormValues) => void | Promise<void>;
}

const emptyValues: DeviceTypeFormValues = { typeCode: "", typeName: "" };

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

export default function DeviceTypeForm({ isOpen, mode, initial, loading = false, onClose, onSubmit }: DeviceTypeFormProps) {
    const [values, setValues] = useState<DeviceTypeFormValues>(emptyValues);

    useEffect(() => {
        if (isOpen) {
            setValues(
                initial
                    ? { typeCode: initial.typeCode, typeName: initial.typeName }
                    : emptyValues
            );
        }
    }, [isOpen, initial]);

    if (!isOpen) return null;

    const handleChange = (field: keyof DeviceTypeFormValues, value: string) => {
        setValues((current) => ({ ...current, [field]: value }));
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!values.typeCode.trim() || !values.typeName.trim()) return;
        onSubmit(values);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={() => !loading && onClose()} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="device-type-form-title"
                className="z-60 mx-4 w-full max-w-md rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
            >
                <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                    <h3 id="device-type-form-title" className="text-lg font-semibold text-[#191c1e]">
                        {mode === "create" ? "Thêm loại thiết bị" : "Cập nhật loại thiết bị"}
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
                        <span className={fieldLabelClassName}>Mã loại thiết bị</span>
                        <input
                            value={values.typeCode}
                            onChange={(event) => handleChange("typeCode", event.target.value)}
                            placeholder="Nhập mã loại thiết bị..."
                            disabled={loading}
                            autoFocus
                            required
                            className={fieldClassName}
                        />
                    </label>

                    <label className="block">
                        <span className={fieldLabelClassName}>Tên loại thiết bị</span>
                        <input
                            value={values.typeName}
                            onChange={(event) => handleChange("typeName", event.target.value)}
                            placeholder="Nhập tên loại thiết bị..."
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
