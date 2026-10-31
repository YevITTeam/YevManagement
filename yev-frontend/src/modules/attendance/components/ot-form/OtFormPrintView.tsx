"use client";

import { useEffect, useMemo, useState } from "react";
import { Printer, RectangleHorizontal, RectangleVertical, X } from "lucide-react";
import { useTranslations } from "next-intl";

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

export default function OtFormPrintView({ id, onClose }: OtFormPrintViewProps) {
    const t = useTranslations("Attendance.OtFormPrint");
    const [form, setForm] = useState<OtFormDto | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [manualPaperSize, setManualPaperSize] = useState<PaperSize>("a4");
    // Auto-pick paper size only until the user chooses manually.
    const [paperSizeTouched, setPaperSizeTouched] = useState(false);
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

    if (error) {
        return <div className="p-8 text-sm text-[#930006]">{error}</div>;
    }

    if (!form) {
        return <div className="p-8 text-sm text-[#5e3f3a]">{t("loading")}</div>;
    }

    const rejectHistory = form.approvalHistories.find((item) => item.action === 2) ?? null;
    const isA5 = paperSize === "a5";

    return (
        <div className="bg-[#f2f4f6] py-6 print:bg-white print:py-0">
            <style>{pageCss(paperSize)}</style>

            <div className="no-print print:hidden mx-auto mb-4 max-w-4xl space-y-2">
                <div className="flex flex-col gap-3 rounded-lg border border-[#e0e3e5] bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">{t("paperSizeLabel")}</span>
                        <button
                            onClick={() => selectPaperSize("a4")}
                            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                                paperSize === "a4"
                                    ? "border-[#e3000f] bg-[#fff4f2] text-[#e3000f]"
                                    : "border-[#e0e3e5] bg-white text-[#191c1e] hover:bg-[#f2f4f6]"
                            }`}
                        >
                            <RectangleVertical className="h-4 w-4" /> {t("paperSizeA4Short")}
                        </button>
                        <button
                            onClick={() => selectPaperSize("a5")}
                            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                                paperSize === "a5"
                                    ? "border-[#e3000f] bg-[#fff4f2] text-[#e3000f]"
                                    : "border-[#e0e3e5] bg-white text-[#191c1e] hover:bg-[#f2f4f6]"
                            }`}
                        >
                            <RectangleHorizontal className="h-4 w-4" /> {t("paperSizeA5Short")}
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => window.print()}
                            className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009]"
                        >
                            <Printer className="h-4 w-4" /> {t("printButton")}
                        </button>
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="cursor-pointer rounded-lg p-2 text-[#5e3f3a] transition hover:bg-[#f2f4f6]"
                                aria-label="Close"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        )}
                    </div>
                </div>
                <p className="px-1 text-xs text-[#8a8f94]">{isA5 ? t("paperSizeA5") : t("paperSizeA4")}</p>
                {rejectHistory && (
                    <p className="px-1 text-sm text-[#930006]">
                        {t("rejectedBy", { name: rejectHistory.approverFullName ?? rejectHistory.approverUserName, comment: rejectHistory.comment ?? "" })}
                    </p>
                )}
            </div>

            <div className="overflow-x-auto print:overflow-visible">
                {/* The template escapes every data field; markup is shared with the PDF export (otFormPdf.ts). */}
                {pages.map((html, index) => (
                    <div key={index} className="otp-page" dangerouslySetInnerHTML={{ __html: html }} />
                ))}
            </div>
        </div>
    );
}
