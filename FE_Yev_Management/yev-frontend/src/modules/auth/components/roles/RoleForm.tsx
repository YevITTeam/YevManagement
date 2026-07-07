"use client";

import { useState, FormEvent, useEffect } from "react";

interface Props {
    initial?: { id?: number; roleName: string; description?: string };
    onCancel?: () => void;
    onSubmit: (data: { roleName: string; description?: string }, id?: number) => Promise<void> | void;
}

export default function RoleForm({ initial, onCancel, onSubmit }: Props) {
    const [roleName, setRoleName] = useState("");
    const [description, setDescription] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (initial) {
            setRoleName(initial.roleName || "");
            setDescription(initial.description || "");
        } else {
            setRoleName("");
            setDescription("");
        }
    }, [initial]);

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
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">Tên quyền</label>
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
