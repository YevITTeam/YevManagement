"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { cutOutSignature } from "@/lib/signatureCutout";

interface SignatureUploadProps {
    // Raw base64 (no data: prefix) of the active signature, for preview.
    initialImage?: string | null;
    onChange: (base64: string | null) => void;
    disabled?: boolean;
}

// Real signature image upload (scan/photo), deliberately not a drawing canvas.
export default function SignatureUpload({ initialImage, onChange, disabled = false }: SignatureUploadProps) {
    const t = useTranslations("Attendance.SignatureUpload");
    const tCommon = useTranslations("Common");
    const inputRef = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<string | null>(initialImage ?? null);

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
                // eslint-disable-next-line @next/next/no-img-element -- base64 data URI; next/image can't optimize it and needs fixed width/height
                <img
                    src={`data:image/png;base64,${preview}`}
                    alt={t("newImageAlt")}
                    className="h-24 w-full rounded-lg border border-[#e0e3e5] bg-white object-contain"
                />
            ) : (
                <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-[#e0e3e5] bg-[#f8fafc] text-xs text-[#5e3f3a]">
                    {t("noImageSelected")}
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
                        {tCommon("delete")}
                    </button>
                )}
            </div>
        </div>
    );
}
