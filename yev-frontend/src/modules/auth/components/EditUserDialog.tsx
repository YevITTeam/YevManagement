"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import { X } from "lucide-react";

import { AuthApi } from "@/modules/auth/api/auth.api";
import type { UserDto } from "@/modules/auth/types/auth.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";
import { RequiredMark } from "@/components/ui/RequiredMark";

interface Props {
    isOpen: boolean;
    user: UserDto | null;
    onClose: () => void;
    onUpdated: () => void;
}

const inputClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]";

const readOnlyClassName =
    "flex h-10 w-full items-center rounded-lg border border-[#e0e3e5] bg-[#f8fafc] px-3 text-sm text-[#5e3f3a]";

export default function EditUserDialog({ isOpen, user, onClose, onUpdated }: Props) {
    const [fullName, setFullName] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // Chỉ cho sửa Họ tên (FullName) — Tên đăng nhập Windows & Tên máy là read-only, khớp giới hạn
    // của PUT /api/Auth/update-user-fullname (docs/identity-api-fe.md §4).
    useDialogReset(isOpen, user, (current) => {
        setFullName(current?.fullName ?? "");
    });

    if (!isOpen || !user) return null;

    const resetAndClose = () => {
        if (isSaving) return;
        onClose();
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!fullName.trim()) {
            toast.error("Vui lòng nhập Họ tên.");
            return;
        }
        setIsSaving(true);
        try {
            await AuthApi.updateUserFullName({ userId: user.id, fullName: fullName.trim() });
            toast.success("Cập nhật họ tên thành công.");
            onUpdated();
        } catch (err) {
            toast.error(getApiErrorMessage(err, "Cập nhật họ tên thất bại."));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#191c1e]/60 backdrop-blur-sm">
            <div className="w-full max-w-lg overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-lg">
                <div className="flex items-center justify-between border-b border-[#e0e3e5] px-6 py-4">
                    <div>
                        <h3 className="text-lg font-semibold text-[#191c1e]">Sửa thông tin người dùng</h3>
                        <p className="mt-1 text-xs text-[#5e3f3a]">
                            Chỉ có thể sửa Họ tên hiển thị. Tên đăng nhập Windows và các thông tin khác không thể thay đổi.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={resetAndClose}
                        disabled={isSaving}
                        className="cursor-pointer text-[#5e3f3a] transition hover:text-[#e3000f] disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Đóng"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                            Tên đăng nhập Windows
                        </span>
                        <div className={readOnlyClassName}>{user.userName}</div>
                    </label>

                    {user.deviceName && (
                        <label className="block">
                            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                Tên máy (Device Name)
                            </span>
                            <div className={readOnlyClassName}>{user.deviceName}</div>
                        </label>
                    )}

                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                            Họ tên<RequiredMark />
                        </span>
                        <input
                            value={fullName}
                            onChange={(event) => setFullName(event.target.value)}
                            disabled={isSaving}
                            required
                            placeholder="Nguyễn Văn A"
                            className={inputClassName}
                            autoFocus
                        />
                    </label>

                    <div className="flex justify-end gap-2 border-t border-[#e0e3e5] pt-4">
                        <button
                            type="button"
                            onClick={resetAndClose}
                            disabled={isSaving}
                            className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Huỷ
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isSaving ? "Đang lưu..." : "Lưu"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
