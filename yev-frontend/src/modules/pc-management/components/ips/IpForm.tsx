"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { IpAddressDto } from "@/modules/pc-management/types/ip.dto";
import { ipStatusDotClasses, ipStatusLabels } from "./ip-status";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";
import { StyledSelect } from "@/components/ui/StyledSelect";

// docs/asset-module.md §4 (2026-07-11) — PUT /api/IpAddress/{id} chỉ đổi được
// status + note. IP đang gắn thiết bị (deviceId != null) chỉ đổi được note;
// IP chưa gắn chỉ được đặt status 0 (Chưa gán) hoặc 1 (Đã gán khác).
export interface IpFormValues {
    status: string;
    note: string;
}

interface IpFormProps {
    isOpen: boolean;
    initial: IpAddressDto | null;
    loading?: boolean;
    onClose: () => void;
    onSubmit: (values: IpFormValues) => void | Promise<void>;
}

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";
const readonlyValueClassName = "flex h-10 items-center rounded-lg border border-[#e0e3e5] bg-[#f8fafc] px-3 text-sm text-[#191c1e]";

export default function IpForm({ isOpen, initial, loading = false, onClose, onSubmit }: IpFormProps) {
    const [values, setValues] = useState<IpFormValues>({ status: "0", note: "" });

    const isAssignedToDevice = initial?.deviceId != null;
    const statusOptions = isAssignedToDevice ? [2] : [0, 1];

    useDialogReset(isOpen, initial, (current) => {
        if (!current) return;
        setValues({
            status: String(current.status ?? 0),
            note: current.note ?? "",
        });
    });

    if (!isOpen || !initial) return null;

    const handleChange = (field: keyof IpFormValues, value: string) => {
        setValues((current) => ({ ...current, [field]: value }));
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
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
                        Cập nhật địa chỉ IP
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
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <span className={fieldLabelClassName}>Địa chỉ IP</span>
                            <div className={readonlyValueClassName}>{initial.ipAddress}</div>
                        </div>
                        <div>
                            <span className={fieldLabelClassName}>Dải mạng</span>
                            <div className={readonlyValueClassName}>{initial.prefix}</div>
                        </div>
                    </div>

                    <div>
                        <span className={fieldLabelClassName}>Thiết bị</span>
                        <div className={readonlyValueClassName}>{initial.deviceCode ?? "—"}</div>
                    </div>

                    {isAssignedToDevice ? (
                        <p className="rounded-lg border border-[#d8e2ff] bg-[#f4f5ff] px-3 py-2 text-sm text-[#004494]">
                            IP này đang gắn thiết bị nên chỉ có thể sửa Ghi chú. Muốn gỡ gán, thực hiện qua màn hình Thiết bị.
                        </p>
                    ) : (
                        <label className="block">
                            <span className={fieldLabelClassName}>Trạng thái</span>
                            <StyledSelect
                                value={values.status}
                                onChange={(status) => handleChange("status", status)}
                                disabled={loading}
                                triggerClassName={`${fieldClassName} pr-9`}
                                options={statusOptions.map((status) => ({
                                    value: String(status),
                                    label: ipStatusLabels[status],
                                    dotClassName: ipStatusDotClasses[status],
                                }))}
                            />
                        </label>
                    )}

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
                            {loading ? "Đang lưu..." : "Lưu thay đổi"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
