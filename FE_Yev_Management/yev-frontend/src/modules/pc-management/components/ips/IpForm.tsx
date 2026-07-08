"use client";

import { useEffect, useState } from "react";
import type { IpAddressDto, IpPrefixDto } from "@/modules/pc-management/types/ip.dto";
import { ipStatusLabels, ipStatusOptions } from "./ip-status";

export interface IpFormValues {
    ipAddress: string;
    ipPrefixId: string;
    serverIp: string;
    status: string;
    note: string;
}

interface IpFormProps {
    isOpen: boolean;
    mode: "create" | "edit";
    initial?: IpAddressDto | null;
    prefixes: IpPrefixDto[];
    loading?: boolean;
    onClose: () => void;
    onSubmit: (values: IpFormValues) => void | Promise<void>;
}

const emptyValues: IpFormValues = {
    ipAddress: "",
    ipPrefixId: "",
    serverIp: "",
    status: "0",
    note: "",
};

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

export default function IpForm({ isOpen, mode, initial, prefixes, loading = false, onClose, onSubmit }: IpFormProps) {
    const [values, setValues] = useState<IpFormValues>(emptyValues);

    useEffect(() => {
        if (isOpen) {
            setValues(
                initial
                    ? {
                          ipAddress: initial.ipAddress,
                          ipPrefixId: initial.ipPrefixId != null ? String(initial.ipPrefixId) : "",
                          serverIp: initial.serverIp ?? "",
                          status: String(initial.status ?? 0),
                          note: initial.note ?? "",
                      }
                    : emptyValues
            );
        }
    }, [isOpen, initial]);

    if (!isOpen) return null;

    const handleChange = (field: keyof IpFormValues, value: string) => {
        setValues((current) => ({ ...current, [field]: value }));
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!values.ipAddress.trim() || !values.ipPrefixId) return;
        onSubmit(values);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={() => !loading && onClose()} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="ip-form-title"
                className="z-60 mx-4 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
            >
                <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                    <h3 id="ip-form-title" className="text-lg font-semibold text-[#191c1e]">
                        {mode === "create" ? "Thêm địa chỉ IP" : "Cập nhật địa chỉ IP"}
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
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <label className="block">
                            <span className={fieldLabelClassName}>Địa chỉ IP</span>
                            <input
                                value={values.ipAddress}
                                onChange={(event) => handleChange("ipAddress", event.target.value)}
                                placeholder="Ví dụ: 192.168.1.10"
                                disabled={loading}
                                autoFocus
                                required
                                className={fieldClassName}
                            />
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>Dải mạng (Prefix)</span>
                            <select
                                value={values.ipPrefixId}
                                onChange={(event) => handleChange("ipPrefixId", event.target.value)}
                                disabled={loading}
                                required
                                className={fieldClassName}
                            >
                                <option value="" disabled>
                                    -- Chọn dải mạng --
                                </option>
                                {prefixes.map((prefix) => (
                                    <option key={prefix.id} value={prefix.id}>
                                        {prefix.prefix}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <label className="block">
                            <span className={fieldLabelClassName}>Server IP</span>
                            <input
                                value={values.serverIp}
                                onChange={(event) => handleChange("serverIp", event.target.value)}
                                placeholder="Nhập server IP..."
                                disabled={loading}
                                className={fieldClassName}
                            />
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>Trạng thái</span>
                            <select
                                value={values.status}
                                onChange={(event) => handleChange("status", event.target.value)}
                                disabled={loading}
                                className={fieldClassName}
                            >
                                {ipStatusOptions.map((status) => (
                                    <option key={status} value={status}>
                                        {ipStatusLabels[status]}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <label className="block">
                        <span className={fieldLabelClassName}>Ghi chú</span>
                        <textarea
                            value={values.note}
                            onChange={(event) => handleChange("note", event.target.value)}
                            placeholder="Nhập ghi chú..."
                            disabled={loading}
                            rows={3}
                            className="w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
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
