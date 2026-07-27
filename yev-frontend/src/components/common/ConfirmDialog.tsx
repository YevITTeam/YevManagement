"use client";

import { useEffect } from "react";

interface ConfirmDialogProps {
    isOpen: boolean;
    title?: string;
    message?: React.ReactNode;
    onApprove: () => void | Promise<void>;
    onDenied?: () => void | Promise<void>;
    approveLabel?: string;
    deniedLabel?: string;
    loading?: boolean;
}

export default function ConfirmDialog({
    isOpen,
    title = "Xác nhận",
    message = "Bạn có chắc muốn thực hiện hành động này?",
    onApprove,
    onDenied,
    approveLabel = "Xác nhận",
    deniedLabel = "Huỷ",
    loading = false,
}: ConfirmDialogProps) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === "Escape") {
                e.preventDefault();
                onDenied?.();
            }
            if (e.key === "Enter") {
                e.preventDefault();
                if (!loading) onApprove();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [isOpen, loading, onApprove, onDenied]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={() => onDenied?.()} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirm-title"
                className="z-60 mx-4 w-full max-w-md rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
            >
                <h3 id="confirm-title" className="mb-2 text-lg font-semibold text-[#191c1e]">
                    {title}
                </h3>

                <div className="mb-5 text-sm text-[#5e3f3a]">{message}</div>

                <div className="flex justify-end gap-3">
                    <button
                        onClick={() => onDenied?.()}
                        className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={loading}
                    >
                        {deniedLabel}
                    </button>

                    <button
                        onClick={() => onApprove()}
                        className="cursor-pointer rounded-lg bg-[#930006] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#7a0005] disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={loading}
                    >
                        {loading ? "Đang..." : approveLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
