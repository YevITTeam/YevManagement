"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { BranchApi } from "@/modules/pc-management/api/branch.api";
import type { BranchDto } from "@/modules/pc-management/types/branch.dto";
import type { IpPrefixDto } from "@/modules/pc-management/types/ip.dto";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { RequiredMark } from "@/components/ui/RequiredMark";

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

// Four octets, each 0-255.
const isValidIPv4 = (value: string): boolean => {
    const parts = value.split(".");
    if (parts.length !== 4) return false;
    return parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
};

// Exactly three octets.
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

// Filled fields must be valid IPv4; gateway must be in the prefix's subnet per subnetMask and not .0/.255.
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

// `prefix` is immutable (changing it means delete + recreate), so it's disabled in edit mode.
export default function IpPrefixForm({ isOpen, mode, initial, loading = false, onClose, onSubmit }: IpPrefixFormProps) {
    const [values, setValues] = useState<IpPrefixFormValues>(emptyValues);
    const [formError, setFormError] = useState<string | null>(null);
    const [branches, setBranches] = useState<BranchDto[]>([]);

    useEffect(() => {
        if (!isOpen) return;
        BranchApi.getAllBranches().then((data) => setBranches(data)).catch((err) => console.error(err));
    }, [isOpen]);

    useDialogReset(isOpen, initial, (current) => {
        setValues(
            current
                ? {
                      prefix: current.prefix,
                      branchId: current.branchId ?? 0,
                      subnetMask: current.subnetMask ?? "",
                      gateway: current.gateway ?? "",
                      preferredDns: current.preferredDns ?? "",
                      alternateDns: current.alternateDns ?? "",
                      description: current.description ?? "",
                  }
                : emptyValues
        );
        setFormError(null);
    });

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
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <p className="mb-4 rounded-lg border border-[#d8e2ff] bg-[#f4f5ff] px-3 py-2 text-sm text-[#004494]">
                    {mode === "create"
                        ? "Tạo dải mạng sẽ tự động sinh 254 địa chỉ IP con (từ .1 đến .254, không sinh .0 và .255). Dải mạng (Prefix) cố định ngay lúc tạo — không thể sửa lại sau này, chỉ có thể xoá rồi tạo lại."
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
                            <span className={fieldLabelClassName}>Dải mạng (Prefix)<RequiredMark /></span>
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
                            <span className={fieldLabelClassName}>Chi nhánh<RequiredMark /></span>
                            <SearchableSelect
                                options={branches.map((b) => ({ value: b.id, label: b.branchName, searchText: b.branchName.toLowerCase() }))}
                                value={values.branchId || ""}
                                onChange={(v) => handleChange("branchId", v === "" ? 0 : v)}
                                placeholder="Chọn chi nhánh..."
                                disabled={loading}
                            />
                        </label>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <label className="block">
                            <span className={fieldLabelClassName}>Subnet mask<RequiredMark /></span>
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
                            <span className={fieldLabelClassName}>Gateway<RequiredMark /></span>
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
                            <span className={fieldLabelClassName}>DNS ưu tiên<RequiredMark /></span>
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
                            <span className={fieldLabelClassName}>DNS thay thế<RequiredMark /></span>
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
