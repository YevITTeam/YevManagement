"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface SecondaryPasswordDialogProps {
    isOpen: boolean;
    title: string;
    label: string;
    hint: string;
    // true = hiện hint dạng cảnh báo (người dùng chưa đăng ký mật khẩu cấp 2).
    hintIsWarning?: boolean;
    value: string;
    onChange: (value: string) => void;
    confirmLabel: string;
    cancelLabel: string;
    closeLabel: string;
    loading?: boolean;
    onConfirm: () => void;
    onClose: () => void;
}

// Popup nhập mật khẩu cấp 2 lúc bấm nút chốt (Tạo/Lưu đơn) — thay cho ô nhập nằm cố định trên trang.
// Enter = xác nhận, Escape = đóng (giống ConfirmDialog).
export default function SecondaryPasswordDialog({
    isOpen,
    title,
    label,
    hint,
    hintIsWarning = false,
    value,
    onChange,
    confirmLabel,
    cancelLabel,
    closeLabel,
    loading = false,
    onConfirm,
    onClose,
}: SecondaryPasswordDialogProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) inputRef.current?.focus();
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto py-8"
            onKeyDown={(event) => {
                if (event.key === "Escape" && !loading) onClose();
            }}
        >
            <div className="fixed inset-0 bg-black/40" onClick={() => !loading && onClose()} />
            <div role="dialog" aria-modal="true" className="z-60 mx-4 w-full max-w-sm rounded-xl border border-[#e0e3e5] bg-white p-5 shadow-xl">
                <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-[#191c1e]">{title}</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e] disabled:opacity-50"
                        aria-label={closeLabel}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (!loading) onConfirm();
                    }}
                    className="space-y-3"
                >
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                            {label} <span className="text-[#930006]">*</span>
                        </span>
                        <input
                            ref={inputRef}
                            type="password"
                            value={value}
                            onChange={(event) => onChange(event.target.value)}
                            disabled={loading}
                            autoComplete="off"
                            className="h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
                        />
                    </label>
                    <p
                        className={`rounded-lg border px-3 py-2 text-xs ${
                            hintIsWarning ? "border-[#e9bcb6] bg-[#fff4f2] text-[#930006]" : "border-[#e0e3e5] bg-[#f8fafc] text-[#5e3f3a]"
                        }`}
                    >
                        {hint}
                    </p>
                    <div className="flex justify-end gap-3 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {cancelLabel}
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {confirmLabel}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
