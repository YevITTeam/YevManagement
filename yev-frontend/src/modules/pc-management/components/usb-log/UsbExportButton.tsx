"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "react-toastify";

import type { BlobDownloadResult } from "@/lib/client";
import { getApiErrorMessage } from "@/lib/apiError";
import { saveBlob } from "./usb-log-format";

export interface UsbExportItem {
    label: string;
    fallbackFileName: string;
    download: () => Promise<BlobDownloadResult>;
}

// Excel of whatever the list's applied filters select (BE caps it at 50,000 rows and says so in the sheet).
// One item downloads on click; several open a small menu.
export default function UsbExportButton({ items }: { items: UsbExportItem[] }) {
    const t = useTranslations("usbLog");
    const [busy, setBusy] = useState(false);
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const close = (event: MouseEvent) => !containerRef.current?.contains(event.target as Node) && setOpen(false);
        const escape = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
        document.addEventListener("mousedown", close);
        document.addEventListener("keydown", escape);
        return () => {
            document.removeEventListener("mousedown", close);
            document.removeEventListener("keydown", escape);
        };
    }, [open]);

    const run = async (item: UsbExportItem) => {
        setOpen(false);
        setBusy(true);
        try {
            const { blob, fileName } = await item.download();
            saveBlob(blob, fileName ?? item.fallbackFileName);
        } catch (err) {
            toast.error(getApiErrorMessage(err, t("common.exportFailed")));
        } finally {
            setBusy(false);
        }
    };

    const label = items.length === 1 ? items[0].label : t("common.export");

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => (items.length === 1 ? run(items[0]) : setOpen((current) => !current))}
                disabled={busy}
                title={label}
                aria-label={label}
                aria-haspopup={items.length > 1 ? "menu" : undefined}
                aria-expanded={items.length > 1 ? open : undefined}
                className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-[#e0e3e5] bg-white text-[#5e3f3a] transition hover:bg-[#f2f4f6] hover:text-[#191c1e] disabled:cursor-not-allowed disabled:opacity-50"
            >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            </button>
            {open && (
                <div role="menu" className="absolute right-0 z-20 mt-1 w-max min-w-44 overflow-hidden rounded-lg border border-[#e0e3e5] bg-white py-1 shadow-lg">
                    {items.map((item) => (
                        <button
                            key={item.label}
                            type="button"
                            role="menuitem"
                            onClick={() => run(item)}
                            className="flex w-full cursor-pointer items-center gap-2 whitespace-nowrap px-3 py-2 text-left text-sm font-medium text-[#5e3f3a] transition hover:bg-[#f8fafc] hover:text-[#191c1e]"
                        >
                            <FileSpreadsheet className="h-4 w-4" />
                            {item.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
