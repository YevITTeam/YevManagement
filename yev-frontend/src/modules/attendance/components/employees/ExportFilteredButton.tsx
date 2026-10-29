"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";
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

    return (
        <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            title={t("exportFilteredHint")}
            className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-[#5e3f3a] transition hover:text-[#191c1e] disabled:cursor-not-allowed disabled:opacity-50"
        >
            <FileDown className="h-3.5 w-3.5" /> {isExporting ? t("exportFilteredBusy") : t("exportFilteredButton")}
        </button>
    );
}
