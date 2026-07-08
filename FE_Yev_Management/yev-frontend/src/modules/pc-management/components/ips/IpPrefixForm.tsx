"use client";

import { useEffect, useState } from "react";
import type { IpPrefixDto } from "@/modules/pc-management/types/ip.dto";

export interface IpPrefixFormValues {
    prefix: string;
    subnetMask: string;
    gateway: string;
    preferredDns: string;
    alternateDns: string;
    description: string;
}

interface IpPrefixFormProps {
    isOpen: boolean;
    mode: "create" | "edit";
    initial?: IpPrefixDto | null;
    loading?: boolean;
    onClose: () => void;
    onSubmit: (values: IpPrefixFormValues) => void | Promise<void>;
}

const emptyValues: IpPrefixFormValues = {
    prefix: "",
    subnetMask: "",
    gateway: "",
    preferredDns: "",
    alternateDns: "",
    description: "",
};

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

export default function IpPrefixForm({ isOpen, mode, initial, loading = false, onClose, onSubmit }: IpPrefixFormProps) {
    const [values, setValues] = useState<IpPrefixFormValues>(emptyValues);

    useEffect(() => {
        if (isOpen) {
            setValues(
                initial
                    ? {
                          prefix: initial.prefix,
                          subnetMask: initial.subnetMask ?? "",
                          gateway: initial.gateway ?? "",
                          preferredDns: initial.preferredDns ?? "",
                          alternateDns: initial.alternateDns ?? "",
                          description: initial.description ?? "",
                      }
                    : emptyValues
            );
        }
    }, [isOpen, initial]);

    if (!isOpen) return null;

    const handleChange = (field: keyof IpPrefixFormValues, value: string) => {
        setValues((current) => ({ ...current, [field]: value }));
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!values.prefix.trim()) return;
        onSubmit(values);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={() => !loading && onClose()} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="ip-prefix-form-title"
                className="z-60 mx-4 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
            >
                <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                    <h3 id="ip-prefix-form-title" className="text-lg font-semibold text-[#191c1e]">
                        {mode === "create" ? "Thêm dải mạng" : "Cập nhật dải mạng"}
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
                            <span className={fieldLabelClassName}>Dải mạng (Prefix)</span>
                            <input
                                value={values.prefix}
                                onChange={(event) => handleChange("prefix", event.target.value)}
                                placeholder="Ví dụ: 192.168.1.0/24"
                                disabled={loading}
                                autoFocus
                                required
                                className={fieldClassName}
                            />
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>Subnet mask</span>
                            <input
                                value={values.subnetMask}
                                onChange={(event) => handleChange("subnetMask", event.target.value)}
                                placeholder="Ví dụ: 255.255.255.0"
                                disabled={loading}
                                className={fieldClassName}
                            />
                        </label>
                    </div>

                    <label className="block">
                        <span className={fieldLabelClassName}>Gateway</span>
                        <input
                            value={values.gateway}
                            onChange={(event) => handleChange("gateway", event.target.value)}
                            placeholder="Ví dụ: 192.168.1.1"
                            disabled={loading}
                            className={fieldClassName}
                        />
                    </label>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <label className="block">
                            <span className={fieldLabelClassName}>DNS ưu tiên</span>
                            <input
                                value={values.preferredDns}
                                onChange={(event) => handleChange("preferredDns", event.target.value)}
                                placeholder="Ví dụ: 8.8.8.8"
                                disabled={loading}
                                className={fieldClassName}
                            />
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>DNS thay thế</span>
                            <input
                                value={values.alternateDns}
                                onChange={(event) => handleChange("alternateDns", event.target.value)}
                                placeholder="Ví dụ: 8.8.4.4"
                                disabled={loading}
                                className={fieldClassName}
                            />
                        </label>
                    </div>

                    <label className="block">
                        <span className={fieldLabelClassName}>Mô tả</span>
                        <textarea
                            value={values.description}
                            onChange={(event) => handleChange("description", event.target.value)}
                            placeholder="Nhập mô tả..."
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
