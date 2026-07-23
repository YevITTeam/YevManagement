"use client";

import { useState } from "react";
import { ipStatusLabels } from "./ip-status";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";

// docs/asset-api-fe.md §4.2 — PUT /api/IpAddress/bulk-status: status chỉ nhận 0/1,
// updateNote=false (mặc định) giữ nguyên note riêng từng IP.
export interface IpBulkStatusFormValues {
    status: "0" | "1";
    updateNote: boolean;
    note: string;
}

interface IpBulkStatusFormProps {
    isOpen: boolean;
    selectedCount: number;
    loading?: boolean;
    onClose: () => void;
    onSubmit: (values: IpBulkStatusFormValues) => void | Promise<void>;
}

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]";

const emptyValues: IpBulkStatusFormValues = { status: "0", updateNote: false, note: "" };

export default function IpBulkStatusForm({ isOpen, selectedCount, loading = false, onClose, onSubmit }: IpBulkStatusFormProps) {
    const [values, setValues] = useState<IpBulkStatusFormValues>(emptyValues);

    useDialogReset(isOpen, isOpen, () => {
        setValues(emptyValues);
    });

    if (!isOpen) return null;

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
                aria-labelledby="ip-bulk-status-form-title"
                className="z-60 mx-4 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
            >
                <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                    <h3 id="ip-bulk-status-form-title" className="text-lg font-semibold text-[#191c1e]">
                        Đổi trạng thái hàng loạt
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
                    <p className="rounded-lg border border-[#d8e2ff] bg-[#f4f5ff] px-3 py-2 text-sm text-[#004494]">
                        Đang áp dụng cho <strong>{selectedCount}</strong> địa chỉ IP đã chọn. IP đang gắn thiết bị sẽ tự động bị bỏ qua.
                    </p>

                    <label className="block">
                        <span className={fieldLabelClassName}>Trạng thái mới</span>
                        <select
                            value={values.status}
                            onChange={(event) => setValues((current) => ({ ...current, status: event.target.value as "0" | "1" }))}
                            disabled={loading}
                            className={fieldClassName}
                        >
                            <option value="0">{ipStatusLabels[0]}</option>
                            <option value="1">{ipStatusLabels[1]}</option>
                        </select>
                    </label>

                    <label className="flex items-center gap-2 text-sm text-[#191c1e]">
                        <input
                            type="checkbox"
                            checked={values.updateNote}
                            onChange={(event) => setValues((current) => ({ ...current, updateNote: event.target.checked }))}
                            disabled={loading}
                            className="h-4 w-4 rounded border-[#e0e3e5]"
                        />
                        Đồng thời ghi đè Ghi chú cho toàn bộ IP cập nhật được
                    </label>

                    {values.updateNote && (
                        <label className="block">
                            <span className={fieldLabelClassName}>Ghi chú mới</span>
                            <textarea
                                value={values.note}
                                onChange={(event) => setValues((current) => ({ ...current, note: event.target.value }))}
                                placeholder="Để trống để xoá ghi chú hiện có..."
                                disabled={loading}
                                rows={3}
                                className="w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
                            />
                        </label>
                    )}

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
                            {loading ? "Đang cập nhật..." : "Áp dụng"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
