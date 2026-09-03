"use client";

import { useRef, useState } from "react";
import { Download, X } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

import { EmployeeImportApi } from "@/modules/attendance/api/employee-import.api";
import type { ProductionEmployeeAccumulationResultDto } from "@/modules/attendance/types/production-employee-import.dto";
import { getApiErrorMessage } from "@/lib/apiError";

interface EmployeeMonthlyAccumulationImportDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onImported: () => void;
}

// Import lũy kế OT theo tháng, tổng quát cho MỌI Phòng ban (2026-09-03) — KHÔNG có bước Preview/Confirm
// riêng (chỉ điều chỉnh CHÊNH LỆCH lũy kế của nhân viên đã tồn tại, cùng cơ chế
// ProductionEmployeeImportDialog "Áp dụng lũy kế" nhưng tự đọc file thay vì tái dùng rows đã Preview).
// Permission Attendance.EmployeeAccumulation.Import (đã có sẵn, tự động cấp cho Người phụ trách BẤT KỲ
// Phòng ban nào) — gate hiển thị nút mở dialog này ở EmployeeList.tsx.
export default function EmployeeMonthlyAccumulationImportDialog({
    isOpen,
    onClose,
    onImported,
}: EmployeeMonthlyAccumulationImportDialogProps) {
    const t = useTranslations("Attendance.Employee");
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [file, setFile] = useState<File | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [result, setResult] = useState<ProductionEmployeeAccumulationResultDto | null>(null);
    const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const resetState = () => {
        setFile(null);
        setResult(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleClose = () => {
        if (isImporting) return;
        const hadResult = result !== null;
        resetState();
        onClose();
        if (hadResult) onImported();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setResult(null);
        setFile(event.target.files?.[0] ?? null);
    };

    const handleDownloadTemplate = async () => {
        setIsDownloadingTemplate(true);
        try {
            const { blob, fileName } = await EmployeeImportApi.downloadMonthlyAccumulationTemplate();
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName ?? "Mau_Import_LuyKeOT.xlsx";
            link.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            toast.error(getApiErrorMessage(err, t("monthlyAccumulationTemplateError")));
        } finally {
            setIsDownloadingTemplate(false);
        }
    };

    const handleImport = async () => {
        if (!file) return;
        setIsImporting(true);
        try {
            const data = await EmployeeImportApi.importMonthlyAccumulation(year, month, file);
            setResult(data);
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("monthlyAccumulationImportError")));
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto py-8">
            <div className="fixed inset-0 bg-black/40" onClick={handleClose} />
            <div
                role="dialog"
                aria-modal="true"
                className="z-60 mx-4 w-full max-w-2xl rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl"
            >
                <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-[#191c1e]">{t("monthlyAccumulationImportTitle")}</h3>
                        <p className="mt-1 text-sm text-[#5e3f3a]">{t("monthlyAccumulationImportDesc")}</p>
                    </div>
                    <button
                        onClick={handleClose}
                        className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                        aria-label={t("importClose")}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {!result ? (
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-end gap-3">
                            <label className="block">
                                <span className="mb-1 block text-xs font-semibold text-[#5e3f3a]">{t("monthlyAccumulationYear")}</span>
                                <input
                                    type="number"
                                    value={year}
                                    onChange={(e) => setYear(Number(e.target.value))}
                                    disabled={isImporting}
                                    className="h-9 w-28 rounded-lg border border-[#e0e3e5] px-3 text-sm outline-none focus:border-[#e3000f]"
                                />
                            </label>
                            <label className="block">
                                <span className="mb-1 block text-xs font-semibold text-[#5e3f3a]">{t("monthlyAccumulationMonth")}</span>
                                <input
                                    type="number"
                                    min={1}
                                    max={12}
                                    value={month}
                                    onChange={(e) => setMonth(Number(e.target.value))}
                                    disabled={isImporting}
                                    className="h-9 w-20 rounded-lg border border-[#e0e3e5] px-3 text-sm outline-none focus:border-[#e3000f]"
                                />
                            </label>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx"
                            onChange={handleFileChange}
                            disabled={isImporting}
                            className="block w-full text-sm text-[#191c1e] file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[#f8fafc] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[#191c1e] hover:file:bg-[#f2f4f6]"
                        />
                        <button
                            type="button"
                            onClick={handleDownloadTemplate}
                            disabled={isDownloadingTemplate}
                            className="flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-[#5e3f3a] transition hover:text-[#191c1e] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Download className="h-3.5 w-3.5" /> {t("monthlyAccumulationDownloadTemplate")}
                        </button>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={handleClose}
                                disabled={isImporting}
                                className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {t("importCancel")}
                            </button>
                            <button
                                onClick={handleImport}
                                disabled={!file || isImporting || month < 1 || month > 12}
                                className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isImporting ? t("monthlyAccumulationImporting") : t("monthlyAccumulationImportSubmit")}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-4 rounded-lg bg-[#f8fafc] px-4 py-3 text-sm">
                            <span className="font-semibold text-emerald-600">
                                {t("monthlyAccumulationAdjustedCount", { count: result.adjustedCount })}
                            </span>
                            <span className="text-[#5e3f3a]">
                                {t("monthlyAccumulationUnchangedCount", { count: result.unchangedCount })}
                            </span>
                            <span className={result.skippedCount > 0 ? "font-semibold text-[#930006]" : "text-[#5e3f3a]"}>
                                {t("monthlyAccumulationSkippedCount", { count: result.skippedCount })}
                            </span>
                            <span className="text-[#5e3f3a]">
                                {t("monthlyAccumulationTotalDelta", { hours: result.totalDeltaHours.toFixed(2) })}
                            </span>
                        </div>

                        {result.skippedRows.length > 0 && (
                            <div className="max-h-96 overflow-y-auto rounded-lg border border-[#e0e3e5]">
                                <table className="min-w-full border-collapse text-left text-sm">
                                    <thead>
                                        <tr className="border-b border-[#e0e3e5] bg-[#fff4f2] text-xs font-semibold uppercase tracking-[0.15em] text-[#930006]">
                                            <th className="px-3 py-2">{t("monthlyAccumulationColCode")}</th>
                                            <th className="px-3 py-2">{t("monthlyAccumulationColReason")}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {result.skippedRows.map((row, index) => (
                                            <tr key={`${row.employeeCode}-${index}`} className="border-b border-[#f1f5f9]">
                                                <td className="px-3 py-2 font-semibold text-[#191c1e]">{row.employeeCode}</td>
                                                <td className="px-3 py-2 text-[#930006]">{row.reason}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="flex justify-end">
                            <button
                                onClick={handleClose}
                                className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009]"
                            >
                                {t("importClose")}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
