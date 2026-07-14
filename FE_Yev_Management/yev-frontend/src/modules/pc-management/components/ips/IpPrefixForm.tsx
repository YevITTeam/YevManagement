"use client";

import { useEffect, useState } from "react";
import { BranchApi } from "@/modules/pc-management/api/branch.api";
import type { BranchDto } from "@/modules/pc-management/types/branch.dto";
import type { IpPrefixDto } from "@/modules/pc-management/types/ip.dto";

export interface IpPrefixFormValues {
    prefix: string;
    branchId: number;
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
    branchId: 0,
    subnetMask: "",
    gateway: "",
    preferredDns: "",
    alternateDns: "",
    description: "",
};

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

// Đúng 4 octet, mỗi octet 0-255 (dùng cho subnetMask/gateway/preferredDns/alternateDns).
const isValidIPv4 = (value: string): boolean => {
    const parts = value.split(".");
    if (parts.length !== 4) return false;
    return parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
};

// Đúng 3 octet, không có octet thứ 4 — docs/asset-api-fe.md §4.1.
const isValidPrefix = (value: string): boolean => {
    const parts = value.split(".");
    if (parts.length !== 3) return false;
    return parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
};

const isSameSubnet = (baseIp: string, otherIp: string, subnetMask: string): boolean => {
    const base = baseIp.split(".").map(Number);
    const other = otherIp.split(".").map(Number);
    const mask = subnetMask.split(".").map(Number);
    return base.every((octet, index) => (octet & mask[index]) === (other[index] & mask[index]));
};

// Đối chiếu docs/asset-api-fe.md §4.1: field nào có nhập phải là IPv4 hợp lệ; gateway phải
// cùng dải 3-octet với prefix, cùng subnet theo subnetMask, và không trùng .0/.255.
function validateIpPrefixForm(values: IpPrefixFormValues): string | null {
    const prefix = values.prefix.trim();
    const subnetMask = values.subnetMask.trim();
    const gateway = values.gateway.trim();
    const preferredDns = values.preferredDns.trim();
    const alternateDns = values.alternateDns.trim();

    if (!prefix) return "Vui lòng nhập dải mạng (Prefix).";
    if (!isValidPrefix(prefix)) {
        return "Dải mạng (Prefix) không hợp lệ — phải gồm đúng 3 octet (0-255), ví dụ: 10.50.2.";
    }

    if (!values.branchId) return "Vui lòng chọn Chi nhánh.";

    if (subnetMask && !isValidIPv4(subnetMask)) {
        return "Subnet mask không hợp lệ.";
    }

    if (gateway) {
        if (!isValidIPv4(gateway)) {
            return "Gateway không hợp lệ.";
        }

        const gatewayParts = gateway.split(".");
        const gatewayPrefix = gatewayParts.slice(0, 3).join(".");
        const gatewayLastOctet = Number(gatewayParts[3]);

        if (gatewayPrefix !== prefix) {
            return `Gateway phải nằm trong dải mạng ${prefix}.x`;
        }

        if (gatewayLastOctet === 0 || gatewayLastOctet === 255) {
            return "Gateway không được là địa chỉ mạng (.0) hoặc địa chỉ broadcast (.255).";
        }

        if (subnetMask && isValidIPv4(subnetMask) && !isSameSubnet(`${prefix}.0`, gateway, subnetMask)) {
            return "Gateway không cùng subnet với dải mạng theo subnet mask đã nhập.";
        }
    }

    if (preferredDns && !isValidIPv4(preferredDns)) {
        return "DNS ưu tiên không hợp lệ.";
    }

    if (alternateDns && !isValidIPv4(alternateDns)) {
        return "DNS thay thế không hợp lệ.";
    }

    return null;
}

// docs/asset-api-fe.md §4.1 (2026-07-13) — cho sửa Chi nhánh + cấu hình mạng qua PUT, riêng
// `prefix` bất biến (đổi prefix vẫn phải xoá + tạo lại dải mới) nên bị disable ở chế độ sửa.
export default function IpPrefixForm({ isOpen, mode, initial, loading = false, onClose, onSubmit }: IpPrefixFormProps) {
    const [values, setValues] = useState<IpPrefixFormValues>(emptyValues);
    const [formError, setFormError] = useState<string | null>(null);
    const [branches, setBranches] = useState<BranchDto[]>([]);

    useEffect(() => {
        if (!isOpen) return;
        BranchApi.getAllBranches().then((data) => setBranches(data)).catch((err) => console.error(err));
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            setValues(
                initial
                    ? {
                          prefix: initial.prefix,
                          branchId: initial.branchId ?? 0,
                          subnetMask: initial.subnetMask ?? "",
                          gateway: initial.gateway ?? "",
                          preferredDns: initial.preferredDns ?? "",
                          alternateDns: initial.alternateDns ?? "",
                          description: initial.description ?? "",
                      }
                    : emptyValues
            );
            setFormError(null);
        }
    }, [isOpen, initial]);

    if (!isOpen) return null;

    const handleChange = (field: keyof IpPrefixFormValues, value: string | number) => {
        setValues((current) => ({ ...current, [field]: value }));
        setFormError(null);
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        const error = validateIpPrefixForm(values);
        if (error) {
            setFormError(error);
            return;
        }
        setFormError(null);
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

                <p className="mb-4 rounded-lg border border-[#d8e2ff] bg-[#f4f5ff] px-3 py-2 text-sm text-[#004494]">
                    {mode === "create"
                        ? "Tạo dải mạng sẽ tự động sinh 255 địa chỉ IP con. Dải mạng (Prefix) cố định ngay lúc tạo — không thể sửa lại sau này, chỉ có thể xoá rồi tạo lại."
                        : "Có thể sửa Chi nhánh và cấu hình mạng. Dải mạng (Prefix) không sửa được — muốn đổi phải xoá rồi tạo lại."}
                </p>

                {formError && (
                    <p className="mb-4 rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-3 py-2 text-sm text-[#930006]">
                        {formError}
                    </p>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <label className="block">
                            <span className={fieldLabelClassName}>Dải mạng (Prefix)</span>
                            <input
                                value={values.prefix}
                                onChange={(event) => handleChange("prefix", event.target.value)}
                                placeholder="Ví dụ: 10.50.2"
                                disabled={loading || mode === "edit"}
                                autoFocus={mode === "create"}
                                required
                                className={fieldClassName}
                            />
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>Chi nhánh</span>
                            <select
                                value={values.branchId || ""}
                                onChange={(event) => handleChange("branchId", Number(event.target.value))}
                                disabled={loading}
                                autoFocus={mode === "edit"}
                                required
                                className={fieldClassName}
                            >
                                <option value="" disabled>
                                    Chọn chi nhánh...
                                </option>
                                {branches.map((branch) => (
                                    <option key={branch.id} value={branch.id}>
                                        {branch.branchName}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <label className="block">
                            <span className={fieldLabelClassName}>Subnet mask</span>
                            <input
                                value={values.subnetMask}
                                onChange={(event) => handleChange("subnetMask", event.target.value)}
                                placeholder="Ví dụ: 255.255.255.0"
                                disabled={loading}
                                required
                                className={fieldClassName}
                            />
                        </label>

                        <label className="block">
                            <span className={fieldLabelClassName}>Gateway</span>
                            <input
                                value={values.gateway}
                                onChange={(event) => handleChange("gateway", event.target.value)}
                                placeholder="Ví dụ: 10.50.2.1"
                                disabled={loading}
                                required
                                className={fieldClassName}
                            />
                        </label>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <label className="block">
                            <span className={fieldLabelClassName}>DNS ưu tiên</span>
                            <input
                                value={values.preferredDns}
                                onChange={(event) => handleChange("preferredDns", event.target.value)}
                                placeholder="Ví dụ: 8.8.8.8"
                                disabled={loading}
                                required
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
                                required
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
