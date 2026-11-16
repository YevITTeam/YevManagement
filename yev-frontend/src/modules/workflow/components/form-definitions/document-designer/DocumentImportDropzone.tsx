"use client";

import { useRef, useState } from "react";
import { UploadCloud, Loader2, X } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { fixVniDocx } from "@/modules/workflow/lib/vniFix";

interface DocumentImportDropzoneProps {
    onClose: () => void;
    onImported: (bytes: ArrayBuffer) => void;
}

// Legacy VNI-* fonts are fixed only on runs that declare them (see lib/vniFix.ts).
export default function DocumentImportDropzone({ onClose, onImported }: DocumentImportDropzoneProps) {
    const t = useTranslations("Workflow.FormDefinition");
    const tCommon = useTranslations("Common");
    const inputRef = useRef<HTMLInputElement>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isConverting, setIsConverting] = useState(false);

    async function handleFile(file: File) {
        if (!file.name.toLowerCase().endsWith(".docx")) {
            toast.error(t("importDocxInvalidFile"));
            return;
        }
        setIsConverting(true);
        try {
            const { blob, convertedCount } = await fixVniDocx(file);
            const bytes = await blob.arrayBuffer();
            if (convertedCount > 0) {
                toast.info(t("importDocxVniFixed", { count: convertedCount }));
            }
            onImported(bytes);
        } catch (err) {
            console.error(err);
            toast.error(t("importDocxReadError"));
        } finally {
            setIsConverting(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={() => !isConverting && onClose()} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="document-import-title"
                className="z-60 mx-4 w-full max-w-lg rounded-xl border border-[#e0e3e5] bg-white p-4 shadow-xl sm:p-6"
            >
                <div className="mb-4 flex items-center justify-between gap-3 border-b border-[#e0e3e5] pb-4">
                    <h3 id="document-import-title" className="text-lg font-semibold text-[#191c1e]">
                        {t("importDocxTitle")}
                    </h3>
                    <button
                        type="button"
                        onClick={() => !isConverting && onClose()}
                        className="shrink-0 cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                        aria-label={tCommon("close")}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div
                    onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => {
                        e.preventDefault();
                        setIsDragOver(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) handleFile(file);
                    }}
                    onClick={() => !isConverting && inputRef.current?.click()}
                    className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center sm:p-10 transition-colors ${
                        isDragOver ? "border-[#e3000f] bg-[#fff4f2]" : "border-[#e0e3e5] hover:border-[#e3000f]/50"
                    } ${isConverting ? "pointer-events-none opacity-60" : ""}`}
                >
                    <input
                        ref={inputRef}
                        type="file"
                        accept=".docx"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFile(file);
                        }}
                    />
                    {isConverting ? (
                        <Loader2 className="h-10 w-10 animate-spin text-[#e3000f]" />
                    ) : (
                        <UploadCloud className="h-10 w-10 text-[#8a8f94]" />
                    )}
                    <p className="text-sm font-semibold text-[#191c1e]">{isConverting ? t("importDocxConverting") : t("importDocxDropHint")}</p>
                </div>
            </div>
        </div>
    );
}
