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
        <form onSubmit={handleSubmit} className="space-y-3">
            <div>
                <label className="block text-sm font-medium text-gray-700">Tên quyền</label>
                <input
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="ví dụ: Admin, Manager"
                    required
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">Mô tả (tuỳ chọn)</label>
                <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    rows={3}
                />
            </div>

            <div className="flex gap-2 justify-end">
                {onCancel && (
                    <button type="button" onClick={onCancel} className="cursor-pointer px-3 py-1 rounded-md border">
                        Huỷ
                    </button>
                )}
                <button
                    type="submit"
                    disabled={submitting}
                    className=" cursor-pointer px-3 py-1 rounded-md bg-blue-600 text-white disabled:opacity-60"
                >
                    {initial ? (submitting ? "Lưu..." : "Lưu thay đổi") : submitting ? "Tạo..." : "Tạo quyền"}
                </button>
            </div>
        </form>
    );
}
