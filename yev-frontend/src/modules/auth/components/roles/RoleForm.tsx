"use client";

import { useState, FormEvent } from "react";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";
import { RequiredMark } from "@/components/ui/RequiredMark";

interface Props {
    initial?: { id?: number; roleName: string; description?: string };
    onCancel?: () => void;
    onSubmit: (data: { roleName: string; description?: string }, id?: number) => Promise<void> | void;
}

// Component này không có prop isOpen — RoleList mount/gỡ nó bằng render có điều kiện
// ({showCreate && <RoleForm/>} / {editing && <RoleForm/>}), nên khởi tạo state ngay từ
// `initial` lúc mount (lazy initializer) để đúng dữ liệu ngay lần render đầu; useDialogReset
// chỉ còn lo trường hợp `initial` đổi trong khi component vẫn đang mounted (đổi bản ghi đang sửa).
export default function RoleForm({ initial, onCancel, onSubmit }: Props) {
    const [roleName, setRoleName] = useState(() => initial?.roleName || "");
    const [description, setDescription] = useState(() => initial?.description || "");
    const [submitting, setSubmitting] = useState(false);

    useDialogReset(true, initial, (current) => {
        setRoleName(current?.roleName || "");
        setDescription(current?.description || "");
    });

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!roleName.trim()) return;
        setSubmitting(true);
        try {
            await onSubmit({ roleName: roleName.trim(), description: description.trim() }, initial?.id);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                    Tên quyền<RequiredMark />
                </label>
                <input
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                    className="h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                    placeholder="ví dụ: Admin, Manager"
                    required
                />
            </div>

            <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">Mô tả (tuỳ chọn)</label>
                <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="block w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                    rows={3}
                />
            </div>

            <div className="flex justify-end gap-3">
                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                    >
                        Huỷ
                    </button>
                )}
                <button
                    type="submit"
                    disabled={submitting}
                    className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {initial ? (submitting ? "Lưu..." : "Lưu thay đổi") : submitting ? "Tạo..." : "Tạo quyền"}
                </button>
            </div>
        </form>
    );
}
