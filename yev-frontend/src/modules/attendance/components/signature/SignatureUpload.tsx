"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ImageUp, X } from "lucide-react";
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
        // The dashed box is the picker itself: the native input shows browser-language "No file chosen" text.
        <div className="relative">
            <label
                title={t("uploadHint")}
                className={`flex h-24 cursor-pointer items-center justify-center rounded-lg border text-xs text-[#5e3f3a] transition focus-within:border-[#e3000f] focus-within:ring-2 focus-within:ring-[#ffe0e3] ${
                    preview ? "border-[#e0e3e5] bg-white" : "border-dashed border-[#e0e3e5] bg-[#f8fafc] hover:border-[#e3000f] hover:text-[#e3000f]"
                } ${disabled ? "pointer-events-none opacity-50" : ""}`}
            >
                {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element -- base64 data URI; next/image can't optimize it and needs fixed width/height
                    <img src={`data:image/png;base64,${preview}`} alt={t("newImageAlt")} className="h-full w-full rounded-lg object-contain" />
                ) : (
                    <span className="inline-flex items-center gap-1.5 font-semibold">
                        <ImageUp className="h-4 w-4" />
                        {t("noImageSelected")}
                    </span>
                )}
                <input ref={inputRef} type="file" accept="image/*" disabled={disabled} onChange={handleFileChange} className="sr-only" />
            </label>
            {preview && (
                <button
                    type="button"
                    onClick={handleClear}
                    disabled={disabled}
                    title={tCommon("delete")}
                    aria-label={tCommon("delete")}
                    className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-[#e0e3e5] bg-white text-[#930006] transition hover:bg-[#fff4f2] hover:text-[#e3000f] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            )}
        </div>
    );
}
