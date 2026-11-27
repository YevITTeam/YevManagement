"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

import type { BlobDownloadResult } from "@/lib/client";
import { getApiErrorMessage } from "@/lib/apiError";

interface ExportFilteredButtonProps {
    download: () => Promise<BlobDownloadResult>;
    fallbackFileName: string;
}

// Current data of the employees filtered on the list, in the import layout, so users edit instead of retyping.
export default function ExportFilteredButton({ download, fallbackFileName }: ExportFilteredButtonProps) {
    const t = useTranslations("Attendance.Employee");
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const { blob, fileName } = await download();
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName ?? fallbackFileName;
            link.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            toast.error(getApiErrorMessage(err, t("exportFilteredError")));
        } finally {
            setIsExporting(false);
        }
    };

    const Icon = isExporting ? Loader2 : FileDown;
    return (
        <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            title={t("exportFilteredHint")}
            aria-label={t("exportFilteredButton")}
            className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-[#e0e3e5] bg-white text-[#5e3f3a] transition hover:bg-[#f2f4f6] hover:text-[#191c1e] disabled:cursor-not-allowed disabled:opacity-40"
        >
            <Icon className={`h-4 w-4 ${isExporting ? "animate-spin" : ""}`} />
        </button>
    );
}
