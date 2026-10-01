"use client";

import { useEffect, type ReactNode } from "react";

interface FormDialogProps {
    isOpen: boolean;
    title: string;
    onClose: () => void;
    onSubmit: () => void;
    loading?: boolean;
    submitLabel: string;
    cancelLabel: string;
    maxWidthClassName?: string;
    children: ReactNode;
}

// Small "select a few fields, then confirm" dialog — same chrome as ConfirmDialog.tsx but with a
// custom body instead of a plain message. Extracted from 2 near-identical hand-rolled modals in
// WorkflowRequestDetail.tsx (send-back / add-approver) so the module doesn't keep 1 modal shell
// per feature.
export default function FormDialog({
    isOpen,
    title,
    onClose,
    onSubmit,
    loading,
    submitLabel,
    cancelLabel,
    maxWidthClassName = "max-w-sm",
    children,
}: FormDialogProps) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (!isOpen || loading) return;
            if (e.key === "Escape") {
                e.preventDefault();
                onClose();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [isOpen, loading, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={() => !loading && onClose()} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="form-dialog-title"
                className={`z-60 mx-4 w-full ${maxWidthClassName} rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl`}
            >
                <h3 id="form-dialog-title" className="mb-4 text-lg font-semibold text-[#191c1e]">
                    {title}
                </h3>

                <div className="space-y-4">{children}</div>

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={() => !loading && onClose()}
                        disabled={loading}
                        className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onSubmit}
                        disabled={loading}
                        className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {submitLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
