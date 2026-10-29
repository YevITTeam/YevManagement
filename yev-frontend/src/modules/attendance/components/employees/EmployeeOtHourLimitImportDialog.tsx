"use client";

import { useRef, useState } from "react";
import { Download, X } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

import { EmployeeImportApi } from "@/modules/attendance/api/employee-import.api";
import type { EmployeeOtHourLimitImportResultDto } from "@/modules/attendance/types/employee-import.dto";
import ExportFilteredButton from "./ExportFilteredButton";
import type { EmployeeExportFilter } from "@/modules/attendance/types/employee-import.dto";
import { getApiErrorMessage } from "@/lib/apiError";

interface EmployeeOtHourLimitImportDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onImported: () => void;
    exportFilter: EmployeeExportFilter;
}

// Mục 5 (2026-08-27) — KHÔNG có bước Preview/Confirm như EmployeeImportDialog (chỉ update 2 field số
// trên nhân viên đã tồn tại, không tạo mới/không có Department-Group phụ thuộc cần rà trước) — chọn
// file rồi áp dụng thẳng, xem lại kết quả từng dòng ngay trong dialog này.
export default function EmployeeOtHourLimitImportDialog({ isOpen, onClose, onImported, exportFilter }: EmployeeOtHourLimitImportDialogProps) {
    const t = useTranslations("Attendance.Employee");
    const [file, setFile] = useState<File | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [result, setResult] = useState<EmployeeOtHourLimitImportResultDto | null>(null);
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
            const { blob, fileName } = await EmployeeImportApi.downloadOtHourLimitTemplate();
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName ?? "Mau_Import_GioiHanOT.xlsx";
            link.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            toast.error(getApiErrorMessage(err, t("otHourLimitTemplateError")));
        } finally {
            setIsDownloadingTemplate(false);
        }
    };

    const handleImport = async () => {
        if (!file) return;
        setIsImporting(true);
        try {
            const data = await EmployeeImportApi.importOtHourLimits(file);
            setResult(data);
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, t("otHourLimitImportError")));
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={handleClose} />
            <div
                role="dialog"
                aria-modal="true"
                className="z-60 mx-4 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-[#e0e3e5] bg-white shadow-xl"
            >
                <div className="flex items-center justify-between border-b border-[#e0e3e5] p-6 pb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-[#191c1e]">{t("otHourLimitImportTitle")}</h3>
                    </div>
                    <button
                        onClick={handleClose}
                        className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                        aria-label={t("importClose")}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-auto p-6">
                {!result ? (
                    <div className="space-y-4">
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
                            <Download className="h-3.5 w-3.5" /> {t("otHourLimitDownloadTemplate")}
                        </button>
                        <ExportFilteredButton download={() => EmployeeImportApi.exportOtHourLimits(exportFilter)} fallbackFileName="GioiHanOT.xlsx" />
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
                                disabled={!file || isImporting}
                                className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isImporting ? t("otHourLimitImporting") : t("otHourLimitImportSubmit")}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <p className="text-sm font-semibold text-[#191c1e]">
                            {t("otHourLimitImportResultSummary", { updated: result.updatedCount, skipped: result.skippedCount })}
                        </p>
                        <div className="max-h-96 overflow-y-auto rounded-lg border border-[#e0e3e5]">
                            <table className="min-w-full border-collapse text-left text-sm">
                                <thead>
                                    <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                        <th className="px-3 py-2">{t("otHourLimitColEmployeeCode")}</th>
                                        <th className="px-3 py-2">{t("otHourLimitColMonthly")}</th>
                                        <th className="px-3 py-2">{t("otHourLimitColYearly")}</th>
                                        <th className="px-3 py-2">{t("otHourLimitColResult")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.rows.map((row) => (
                                        <tr key={row.rowNumber} className="border-b border-[#f1f5f9]">
                                            <td className="px-3 py-2 font-semibold text-[#191c1e]">{row.employeeCode}</td>
                                            <td className="px-3 py-2 text-[#191c1e]">{row.monthlyLimit ?? "-"}</td>
                                            <td className="px-3 py-2 text-[#191c1e]">{row.yearlyLimit ?? "-"}</td>
                                            <td className="px-3 py-2">
                                                {row.success ? (
                                                    <span className="text-emerald-700">{t("otHourLimitRowSuccess")}</span>
                                                ) : (
                                                    <span className="text-[#930006]">{row.error}</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
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
        </div>
    );
}
