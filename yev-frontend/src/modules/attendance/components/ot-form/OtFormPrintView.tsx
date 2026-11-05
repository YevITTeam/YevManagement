"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Loader2, Printer, RectangleHorizontal, RectangleVertical, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";

import { OtFormApi } from "@/modules/attendance/api/ot-form.api";
import type { OtFormDto } from "@/modules/attendance/types/ot-form.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import { useAttendanceSetting } from "@/modules/attendance/hooks/useAttendanceSetting";
import {
    EMPLOYEE_PAGE_CAPACITY,
    PAGE_SPECS,
    renderOtFormPages,
    type PaperSize,
} from "@/modules/attendance/lib/otFormPrintTemplate";
import { otFormPdfFileName, renderPagesToPdfBlob } from "@/modules/attendance/lib/otFormPdf";

interface OtFormPrintViewProps {
    onClose?: () => void;
    id: number;
}

// Borders/paddings for the template's tables; must match GRID_LAYOUT in otFormPdf.ts so print and PDF look the same.
function pageCss(paperSize: PaperSize) {
    const { widthPt, heightPt, marginsPt } = PAGE_SPECS[paperSize];
    const [left, top, right, bottom] = marginsPt;
    return `
@page { size: ${paperSize === "a5" ? "A5 landscape" : "A4 portrait"}; margin: 0; }
.otp-page { width: ${widthPt}pt; height: ${heightPt}pt; padding: ${top}pt ${right}pt ${bottom}pt ${left}pt; box-sizing: border-box;
  overflow: hidden; margin: 0 auto 16px; background: #fff; color: #000; font-family: "Times New Roman", "Noto Serif JP", serif;
  font-size: 9pt; line-height: 1.05; box-shadow: 0 1px 3px rgba(0,0,0,.12); }
.otp-page:last-child { margin-bottom: 0; }
.otp-page .otp-jp { font-family: "MS Mincho", "Yu Mincho", "Noto Serif JP", serif; }
.otp-page table { border-collapse: collapse; table-layout: fixed; width: 100%; }
.otp-page td { overflow: hidden; }
.otp-page .otp-grid > tbody > tr > td { border: 0.6pt solid #000; padding: 1pt 3pt; }
.otp-page .otp-plain > tbody > tr > td { border: 0; padding: 0; }
.otp-page img { display: inline-block; }
@media print {
  .otp-page { margin: 0; box-shadow: none; break-after: page; }
  .otp-page:last-child { break-after: auto; }
}`;
}

const PAPER_OPTIONS = [
    { size: "a4" as const, icon: RectangleVertical },
    { size: "a5" as const, icon: RectangleHorizontal },
];

export default function OtFormPrintView({ id, onClose }: OtFormPrintViewProps) {
    const t = useTranslations("Attendance.OtFormPrint");
    const [form, setForm] = useState<OtFormDto | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [manualPaperSize, setManualPaperSize] = useState<PaperSize>("a4");
    // Auto-pick paper size only until the user chooses manually.
    const [paperSizeTouched, setPaperSizeTouched] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const { setting } = useAttendanceSetting();

    useEffect(() => {
        OtFormApi.getOtFormById(id)
            .then(setForm)
            .catch((err) => {
                console.error(err);
                setError(getApiErrorMessage(err, t("loadError")));
            });
    }, [id, t]);

    // Auto-pick A5 when everyone fits on one A5 back page to save paper.
    const printableCount = form ? form.employees.filter((e) => !e.isRemoved).length : 0;
    const paperSize: PaperSize = paperSizeTouched ? manualPaperSize : printableCount <= EMPLOYEE_PAGE_CAPACITY.a5.rest ? "a5" : "a4";

    const pages = useMemo(() => (form ? renderOtFormPages(form, paperSize, setting) : []), [form, paperSize, setting]);

    function selectPaperSize(size: PaperSize) {
        setPaperSizeTouched(true);
        setManualPaperSize(size);
    }

    async function exportPdf() {
        if (!form) return;
        setIsExporting(true);
        try {
            const blob = await renderPagesToPdfBlob(pages, paperSize);
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = otFormPdfFileName(form);
            link.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            toast.error(t("exportPdfError"));
        } finally {
            setIsExporting(false);
        }
    }

    const closeButton = onClose && (
        <button
            onClick={onClose}
            className="cursor-pointer rounded-md p-2 text-[#5e3f3a] transition hover:bg-[#f2f4f6]"
            aria-label="Close"
        >
            <X className="h-5 w-5" />
        </button>
    );

    if (error || !form) {
        return (
            <div className="flex items-center justify-between gap-3 bg-white px-4 py-3">
                {error ? (
                    <span className="text-sm text-[#930006]">{error}</span>
                ) : (
                    <span className="inline-flex items-center gap-2 text-sm text-[#5e3f3a]">
                        <Loader2 className="h-4 w-4 animate-spin" /> {t("loading")}
                    </span>
                )}
                {closeButton}
            </div>
        );
    }

    const rejectHistory = form.approvalHistories.find((item) => item.action === 2) ?? null;

    return (
        <div className="min-h-full bg-[#eceef0] print:bg-white">
            <style>{pageCss(paperSize)}</style>

            <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[#e0e3e5] bg-white px-4 py-3 print:hidden">
                <div role="radiogroup" aria-label={t("paperSizeLabel")} className="inline-flex rounded-lg border border-[#e0e3e5] bg-[#f2f4f6] p-0.5">
                    {PAPER_OPTIONS.map(({ size, icon: Icon }) => {
                        const active = paperSize === size;
                        return (
                            <button
                                key={size}
                                role="radio"
                                aria-checked={active}
                                onClick={() => selectPaperSize(size)}
                                title={size === "a4" ? t("paperSizeA4") : t("paperSizeA5")}
                                className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                                    active ? "bg-white text-[#e3000f] shadow-sm" : "text-[#5e3f3a] hover:text-[#191c1e]"
                                }`}
                            >
                                <Icon className="h-4 w-4" /> {size === "a4" ? t("paperSizeA4Short") : t("paperSizeA5Short")}
                            </button>
                        );
                    })}
                </div>
                <span className="text-xs text-[#8a8f94]">{t("pageCount", { count: pages.length })}</span>

                <div className="ml-auto flex items-center gap-2">
                    <button
                        onClick={exportPdf}
                        disabled={isExporting}
                        className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} {t("exportPdfButton")}
                    </button>
                    <button
                        onClick={() => window.print()}
                        className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009]"
                    >
                        <Printer className="h-4 w-4" /> {t("printButton")}
                    </button>
                    {closeButton}
                </div>
            </div>

            {rejectHistory && (
                <div className="no-print border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-2 text-sm text-[#930006] print:hidden">
                    {t("rejectedBy", { name: rejectHistory.approverFullName ?? rejectHistory.approverUserName, comment: rejectHistory.comment ?? "" })}
                </div>
            )}

            <div className="overflow-x-auto p-6 print:overflow-visible print:p-0">
                {/* The template escapes every data field; markup is shared with the PDF export (otFormPdf.ts). */}
                {pages.map((html, index) => (
                    <div key={index} className="otp-page" dangerouslySetInnerHTML={{ __html: html }} />
                ))}
            </div>
        </div>
    );
}
