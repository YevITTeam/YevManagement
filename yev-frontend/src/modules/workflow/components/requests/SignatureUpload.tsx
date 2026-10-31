"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { cutOutSignature } from "@/lib/signatureCutout";

interface SignatureUploadProps {
    onChange: (base64: string | null) => void;
    disabled?: boolean;
    // Initial value only (lazy init), not resynced after mount; the parent owns the real state.
    initialBase64?: string | null;
}

// Image file -> base64, no hand-drawn canvas. Mirrors attendance's SignatureUpload (no cross-module import).
export default function SignatureUpload({ onChange, disabled = false, initialBase64 = null }: SignatureUploadProps) {
    const t = useTranslations("Workflow.WorkflowRequest");
    const inputRef = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<string | null>(() => initialBase64);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        cutOutSignature(file)
            .then((base64) => {
                setPreview(base64);
                onChange(base64);
            })
            .catch(console.error);
    };

    const handleClear = () => {
        setPreview(null);
        onChange(null);
        if (inputRef.current) inputRef.current.value = "";
    };

    return (
        <div className="space-y-2">
            {preview ? (
                <>
                    {/* eslint-disable-next-line @next/next/no-img-element -- base64 data URI */}
                    <img src={`data:image/png;base64,${preview}`} alt={t("signaturePreviewAlt")} className="h-20 w-full rounded-lg border border-[#e0e3e5] bg-white object-contain" />
                    {preview === initialBase64 && <p className="text-[11px] text-[#5e3f3a]">{t("usingSavedSignature")}</p>}
                </>
            ) : (
                <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-[#e0e3e5] bg-[#f8fafc] text-xs text-[#5e3f3a]">
                    {t("noSignatureSelected")}
                </div>
            )}
            <div className="flex items-center justify-between gap-3">
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    disabled={disabled}
                    onChange={handleFileChange}
                    className="block w-full cursor-pointer text-xs text-[#5e3f3a] file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[#eceef0] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[#191c1e] hover:file:bg-[#e0e3e5] disabled:cursor-not-allowed disabled:opacity-50"
                />
                {preview && (
                    <button
                        type="button"
                        onClick={handleClear}
                        disabled={disabled}
                        className="cursor-pointer whitespace-nowrap text-xs font-semibold text-[#930006] transition hover:text-[#e3000f] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {t("clearSignature")}
                    </button>
                )}
            </div>
        </div>
    );
}
