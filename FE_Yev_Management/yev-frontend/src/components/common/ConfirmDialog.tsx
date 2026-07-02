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
                className="z-60 bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6"
            >
                <h3 id="confirm-title" className="text-lg font-semibold text-gray-800 mb-2">
                    {title}
                </h3>

                <div className="text-sm text-gray-600 mb-4">{message}</div>

                <div className="flex justify-end gap-3">
                    <button
                        onClick={() => onDenied?.()}
                        className="cursor-pointer px-3 py-1.5 rounded-md border bg-white text-gray-700"
                        disabled={loading}
                    >
                        {deniedLabel}
                    </button>

                    <button
                        onClick={() => onApprove()}
                        className="cursor-pointer px-3 py-1.5 rounded-md bg-red-600 text-white"
                        disabled={loading}
                    >
                        {loading ? "Đang..." : approveLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
