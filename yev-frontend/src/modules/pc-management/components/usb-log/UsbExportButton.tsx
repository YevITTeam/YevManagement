"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "react-toastify";

import type { BlobDownloadResult } from "@/lib/client";
import { getApiErrorMessage } from "@/lib/apiError";
import { saveBlob } from "./usb-log-format";

interface UsbExportButtonProps {
    label: string;
    title: string;
    fallbackFileName: string;
    download: () => Promise<BlobDownloadResult>;
}

// Excel of whatever the list's applied filters select (BE caps it at 50,000 rows and says so in the sheet).
export default function UsbExportButton({ label, title, fallbackFileName, download }: UsbExportButtonProps) {
    const [busy, setBusy] = useState(false);

    const handleClick = async () => {
        setBusy(true);
        try {
            const { blob, fileName } = await download();
            saveBlob(blob, fileName ?? fallbackFileName);
        } catch (err) {
            toast.error(getApiErrorMessage(err, "Xuất Excel thất bại."));
        } finally {
            setBusy(false);
        }
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={busy}
            title={title}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border border-[#e0e3e5] bg-white px-3 text-sm font-semibold text-[#5e3f3a] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
        >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {label}
        </button>
    );
}
