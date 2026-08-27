"use client";

import { useRef, useState } from "react";
import { Download, X } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

import { ProductionEmployeeImportApi } from "@/modules/attendance/api/production-employee-import.api";
import type {
    ProductionEmployeeAccumulationResultDto,
    ProductionEmployeeImportConfirmResultDto,
    ProductionEmployeeImportPreviewResultDto,
    ProductionEmployeeImportRowDto,
} from "@/modules/attendance/types/production-employee-import.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";

interface ProductionEmployeeImportDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onImported: () => void;
}

// Tách bản xem trước thành các tab thay vì dồn hết vào 1 bảng dài (2026-08-27, theo yêu cầu người
// dùng) — mỗi tab lọc lại từ CÙNG 1 mảng `rows`/`removedRows` đã có sẵn cờ isNew*/isUpdated*/isValid,
// không cần gọi lại BE.
type PreviewTab = "all" | "new" | "updated" | "unchanged" | "invalid" | "removed";

// Pattern Preview -> Confirm giống EmployeeImportDialog, thêm 1 bước "Áp dụng lũy kế" tách riêng SAU
// Confirm (chỉ khi đó Employee mới thật sự tồn tại để ghi lũy kế) — docs §Import nhân sự dưới chuyền.
export default function ProductionEmployeeImportDialog({ isOpen, onClose, onImported }: ProductionEmployeeImportDialogProps) {
    const t = useTranslations("Attendance.ProductionEmployeeImport");
    const { user } = useAuth();
    const canApplyAccumulation = hasPermission(user, "Attendance.EmployeeAccumulation.Import");

    const [file, setFile] = useState<File | null>(null);
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const [isApplyingAccumulation, setIsApplyingAccumulation] = useState(false);
    const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);

    const [preview, setPreview] = useState<ProductionEmployeeImportPreviewResultDto | null>(null);
    const [rows, setRows] = useState<ProductionEmployeeImportRowDto[]>([]);
    const [confirmResult, setConfirmResult] = useState<ProductionEmployeeImportConfirmResultDto | null>(null);
    const [activeTab, setActiveTab] = useState<PreviewTab>("all");

    const now = new Date();
    const [accumulationYear, setAccumulationYear] = useState(now.getFullYear());
    const [accumulationMonth, setAccumulationMonth] = useState(now.getMonth() + 1);
    const [accumulationResult, setAccumulationResult] = useState<ProductionEmployeeAccumulationResultDto | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const isBusy = isPreviewing || isConfirming || isApplyingAccumulation;

    const resetState = () => {
        setFile(null);
        setPreview(null);
        setRows([]);
        setConfirmResult(null);
        setAccumulationResult(null);
        setActiveTab("all");
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleClose = () => {
        if (isBusy) return;
        const hadResult = confirmResult !== null;
        resetState();
        onClose();
        if (hadResult) onImported();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selected = event.target.files?.[0] ?? null;
        setFile(selected);
        setPreview(null);
        setRows([]);
    };

    const handleDownloadTemplate = async () => {
        setIsDownloadingTemplate(true);
        try {
            const { blob, fileName } = await ProductionEmployeeImportApi.downloadTemplate();
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName ?? "Mau_Import_NhanSuDuoiChuyen.xlsx";
            link.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            toast.error(getApiErrorMessage(err, t("templateError")));
        } finally {
            setIsDownloadingTemplate(false);
        }
    };

    const handlePreview = async () => {
        if (!file) {
            toast.error(t("chooseErrorNoFile"));
            return;
        }
        setIsPreviewing(true);
        try {
            const result = await ProductionEmployeeImportApi.previewImport(file);
            setPreview(result);
            setRows(result.rows);
            setActiveTab("all");
            if (result.invalidRows > 0) {
                toast.warn(t("warnInvalidRows", { count: result.invalidRows }));
            } else {
                toast.success(t("previewSuccess", { count: result.totalRows }));
            }
        } catch (err) {
            toast.error(getApiErrorMessage(err, t("previewError")));
        } finally {
            setIsPreviewing(false);
        }
    };

    const handleConfirm = async () => {
        if (rows.length === 0) {
            toast.error(t("noRowsError"));
            return;
        }
        setIsConfirming(true);
        try {
            const result = await ProductionEmployeeImportApi.confirmImport(rows);
            setConfirmResult(result);
            toast.success(
                t("confirmSuccess", {
                    created: result.createdProductionEmployeeCount,
                    updated: result.updatedProductionEmployeeCount,
                    removed: result.removedProductionEmployeeCount,
                }) + (result.skippedCount > 0 ? t("confirmSuccessSkipped", { skipped: result.skippedCount }) : ".")
            );
        } catch (err) {
            toast.error(getApiErrorMessage(err, t("confirmError")));
        } finally {
            setIsConfirming(false);
        }
    };

    const handleApplyAccumulation = async () => {
        setIsApplyingAccumulation(true);
        try {
            const result = await ProductionEmployeeImportApi.applyAccumulation(accumulationYear, accumulationMonth, rows);
            setAccumulationResult(result);
            toast.success(t("accumulationSuccess", { adjusted: result.adjustedCount }));
        } catch (err) {
            toast.error(getApiErrorMessage(err, t("accumulationError")));
        } finally {
            setIsApplyingAccumulation(false);
        }
    };

    const canConfirm = preview !== null && rows.length > 0 && confirmResult === null;
    const rowsWithOtMonth = rows.filter((r) => r.otMonthHours !== null).length;

    const newRows = rows.filter((r) => r.isValid && r.isNewProductionEmployee);
    const updatedRows = rows.filter((r) => r.isValid && !r.isNewProductionEmployee && r.isUpdatedProductionEmployee);
    const unchangedRows = rows.filter((r) => r.isValid && !r.isNewProductionEmployee && !r.isUpdatedProductionEmployee);
    const invalidRows = rows.filter((r) => !r.isValid);
    const removedRows = preview?.removedRows ?? [];

    const tabs: { key: PreviewTab; label: string; count: number }[] = [
        { key: "all", label: t("tabAll"), count: rows.length },
        { key: "new", label: t("tabNew"), count: newRows.length },
        { key: "updated", label: t("tabUpdated"), count: updatedRows.length },
        { key: "unchanged", label: t("tabUnchanged"), count: unchangedRows.length },
        { key: "invalid", label: t("tabInvalid"), count: invalidRows.length },
        { key: "removed", label: t("tabRemoved"), count: removedRows.length },
    ];

    const rowsByTab: Record<Exclude<PreviewTab, "removed">, ProductionEmployeeImportRowDto[]> = {
        all: rows,
        new: newRows,
        updated: updatedRows,
        unchanged: unchangedRows,
        invalid: invalidRows,
    };
    const visibleRows = activeTab === "removed" ? [] : rowsByTab[activeTab];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={handleClose} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="import-production-employee-title"
                className="z-60 mx-4 flex max-h-[85vh] w-full max-w-6xl flex-col rounded-xl border border-[#e0e3e5] bg-white shadow-xl"
            >
                <div className="flex items-center justify-between border-b border-[#e0e3e5] p-6 pb-4">
                    <div>
                        <h3 id="import-production-employee-title" className="text-lg font-semibold text-[#191c1e]">
                            {t("title")}
                        </h3>
                        <p className="mt-1 text-xs text-[#5e3f3a]">{t("description")}</p>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isBusy}
                        className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e] disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={t("close")}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {confirmResult ? (
                    <div className="flex-1 overflow-auto p-6">
                        <div className="mb-4 flex flex-wrap items-center gap-4 rounded-lg border border-[#e0e3e5] bg-[#f8fafc] px-4 py-3 text-sm">
                            <span className="font-semibold text-emerald-600">
                                {t("createdCount", { count: confirmResult.createdProductionEmployeeCount })}
                            </span>
                            <span className="text-[#5e3f3a]">{t("updatedCount", { count: confirmResult.updatedProductionEmployeeCount })}</span>
                            <span className="text-[#5e3f3a]">{t("createdEmployeeCount", { count: confirmResult.createdEmployeeCount })}</span>
                            <span className="text-[#930006]">{t("removedCount", { count: confirmResult.removedProductionEmployeeCount })}</span>
                            <span className={confirmResult.skippedCount > 0 ? "font-semibold text-[#930006]" : "text-[#5e3f3a]"}>
                                {t("skippedCount", { count: confirmResult.skippedCount })}
                            </span>
                        </div>

                        {confirmResult.skippedRows.length > 0 && (
                            <div className="mb-6">
                                <h4 className="mb-2 text-sm font-semibold text-[#930006]">{t("skippedRowsTitle")}</h4>
                                <table className="min-w-full border-collapse text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-[#e0e3e5] bg-[#fff4f2] font-semibold uppercase tracking-[0.1em] text-[#930006]">
                                            <th className="whitespace-nowrap px-3 py-2">{t("colRow")}</th>
                                            <th className="whitespace-nowrap px-3 py-2">{t("colCode")}</th>
                                            <th className="px-3 py-2">{t("colError")}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {confirmResult.skippedRows.map((row) => (
                                            <tr key={row.rowNumber} className="border-b border-[#f1f5f9]">
                                                <td className="whitespace-nowrap px-3 py-2 font-semibold text-[#191c1e]">{row.rowNumber}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#191c1e]">{row.employeeCode}</td>
                                                <td className="px-3 py-2 text-[#930006]">{row.errors.join("; ")}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {canApplyAccumulation && (
                            <div className="rounded-lg border border-[#e0e3e5] p-4">
                                <h4 className="mb-1 text-sm font-semibold text-[#191c1e]">{t("accumulationTitle")}</h4>
                                <p className="mb-3 text-xs text-[#5e3f3a]">{t("accumulationDescription", { count: rowsWithOtMonth })}</p>

                                {accumulationResult ? (
                                    <div className="flex flex-wrap items-center gap-4 rounded-lg bg-[#f8fafc] px-4 py-3 text-sm">
                                        <span className="font-semibold text-emerald-600">
                                            {t("accumulationAdjustedCount", { count: accumulationResult.adjustedCount })}
                                        </span>
                                        <span className="text-[#5e3f3a]">
                                            {t("accumulationUnchangedCount", { count: accumulationResult.unchangedCount })}
                                        </span>
                                        <span className={accumulationResult.skippedCount > 0 ? "font-semibold text-[#930006]" : "text-[#5e3f3a]"}>
                                            {t("accumulationSkippedCount", { count: accumulationResult.skippedCount })}
                                        </span>
                                        <span className="text-[#5e3f3a]">
                                            {t("accumulationTotalDelta", { hours: accumulationResult.totalDeltaHours.toFixed(2) })}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap items-end gap-3">
                                        <label className="block">
                                            <span className="mb-1 block text-xs font-semibold text-[#5e3f3a]">{t("accumulationYear")}</span>
                                            <input
                                                type="number"
                                                value={accumulationYear}
                                                onChange={(e) => setAccumulationYear(Number(e.target.value))}
                                                disabled={isBusy}
                                                className="h-9 w-28 rounded-lg border border-[#e0e3e5] px-3 text-sm outline-none focus:border-[#e3000f]"
                                            />
                                        </label>
                                        <label className="block">
                                            <span className="mb-1 block text-xs font-semibold text-[#5e3f3a]">{t("accumulationMonth")}</span>
                                            <input
                                                type="number"
                                                min={1}
                                                max={12}
                                                value={accumulationMonth}
                                                onChange={(e) => setAccumulationMonth(Number(e.target.value))}
                                                disabled={isBusy}
                                                className="h-9 w-20 rounded-lg border border-[#e0e3e5] px-3 text-sm outline-none focus:border-[#e3000f]"
                                            />
                                        </label>
                                        <button
                                            type="button"
                                            onClick={handleApplyAccumulation}
                                            disabled={isBusy || rowsWithOtMonth === 0}
                                            className="h-9 cursor-pointer rounded-lg bg-[#e3000f] px-4 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {isApplyingAccumulation ? t("accumulationApplying") : t("accumulationApplyButton")}
                                        </button>
                                    </div>
                                )}

                                {accumulationResult && accumulationResult.skippedRows.length > 0 && (
                                    <table className="mt-3 min-w-full border-collapse text-left text-xs">
                                        <thead>
                                            <tr className="border-b border-[#e0e3e5] font-semibold uppercase tracking-[0.1em] text-[#930006]">
                                                <th className="whitespace-nowrap px-3 py-2">{t("colCode")}</th>
                                                <th className="px-3 py-2">{t("colError")}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {accumulationResult.skippedRows.map((row, index) => (
                                                <tr key={`${row.employeeCode}-${index}`} className="border-b border-[#f1f5f9]">
                                                    <td className="whitespace-nowrap px-3 py-2 text-[#191c1e]">{row.employeeCode}</td>
                                                    <td className="px-3 py-2 text-[#930006]">{row.reason}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="flex flex-wrap items-center gap-3 border-b border-[#e0e3e5] p-4">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx"
                                onChange={handleFileChange}
                                disabled={isBusy}
                                className="flex-1 text-sm text-[#191c1e] file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-[#f8fafc] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[#191c1e] hover:file:bg-[#f2f4f6]"
                            />
                            <button
                                type="button"
                                onClick={handlePreview}
                                disabled={!file || isBusy}
                                className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isPreviewing ? t("previewing") : t("previewButton")}
                            </button>
                            <button
                                type="button"
                                onClick={handleDownloadTemplate}
                                disabled={isDownloadingTemplate}
                                className="flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-[#5e3f3a] transition hover:text-[#191c1e] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Download className="h-3.5 w-3.5" /> {t("downloadTemplate")}
                            </button>
                        </div>

                        {preview && (
                            <div className="flex flex-wrap gap-1 border-b border-[#e0e3e5] bg-[#f8fafc] px-4 pt-3">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        onClick={() => setActiveTab(tab.key)}
                                        className={`cursor-pointer rounded-t-lg border border-b-0 px-3.5 py-2 text-xs font-semibold transition ${
                                            activeTab === tab.key
                                                ? "border-[#e0e3e5] bg-white text-[#e3000f]"
                                                : "border-transparent text-[#5e3f3a] hover:text-[#191c1e]"
                                        } ${tab.key === "invalid" && tab.count > 0 ? "text-[#930006]" : ""} ${
                                            tab.key === "removed" && tab.count > 0 ? "text-[#930006]" : ""
                                        }`}
                                    >
                                        {tab.label} ({tab.count})
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="flex-1 overflow-auto p-2">
                            {!preview ? (
                                <div className="px-4 py-12 text-center text-sm text-[#5e3f3a]">
                                    {isPreviewing ? t("readingFile") : t("noPreviewYet")}
                                </div>
                            ) : activeTab === "removed" ? (
                                removedRows.length === 0 ? (
                                    <div className="px-4 py-12 text-center text-sm text-[#5e3f3a]">{t("tabRemovedEmpty")}</div>
                                ) : (
                                    <table className="min-w-full border-collapse text-left text-xs">
                                        <thead>
                                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] font-semibold uppercase tracking-[0.1em] text-[#5e3f3a]">
                                                <th className="whitespace-nowrap px-3 py-2">{t("colCode")}</th>
                                                <th className="px-3 py-2">{t("colName")}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {removedRows.map((row) => (
                                                <tr key={row.employeeCode} className="border-b border-[#f1f5f9] bg-[#fff4f2]">
                                                    <td className="whitespace-nowrap px-3 py-2 font-semibold text-[#191c1e]">{row.employeeCode}</td>
                                                    <td className="px-3 py-2 text-[#5e3f3a]">{row.fullName}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )
                            ) : visibleRows.length === 0 ? (
                                <div className="px-4 py-12 text-center text-sm text-[#5e3f3a]">{t("tabEmpty")}</div>
                            ) : (
                                <table className="min-w-full border-collapse text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] font-semibold uppercase tracking-[0.1em] text-[#5e3f3a]">
                                            <th className="whitespace-nowrap px-3 py-2">{t("colRow")}</th>
                                            <th className="whitespace-nowrap px-3 py-2">{t("colCode")}</th>
                                            <th className="whitespace-nowrap px-3 py-2">{t("colName")}</th>
                                            <th className="whitespace-nowrap px-3 py-2">{t("colBlock")}</th>
                                            <th className="whitespace-nowrap px-3 py-2">{t("colTeam")}</th>
                                            <th className="whitespace-nowrap px-3 py-2">{t("colShiftTeam")}</th>
                                            <th className="whitespace-nowrap px-3 py-2">{t("colStatus")}</th>
                                            <th className="min-w-[200px] px-3 py-2">{t("colError")}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visibleRows.map((row) => (
                                            <tr
                                                key={row.rowNumber}
                                                className={`border-b border-[#f1f5f9] ${!row.isValid ? "bg-[#fff4f2]" : ""}`}
                                            >
                                                <td className="whitespace-nowrap px-3 py-2 font-semibold text-[#191c1e]">{row.rowNumber}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#191c1e]">{row.employeeCode}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">
                                                    {row.lastName ?? "-"} {row.firstName ?? ""}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">{row.blockCode ?? "-"}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">{row.teamCode ?? "-"}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">{row.shiftTeamCode ?? "-"}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">
                                                    {[
                                                        row.isNewEmployee && t("tagNewEmployee"),
                                                        row.isValid && row.isNewProductionEmployee && t("tagNewPe"),
                                                        row.isValid && !row.isNewProductionEmployee && row.isUpdatedProductionEmployee && t("tagUpdatedPe"),
                                                    ]
                                                        .filter(Boolean)
                                                        .join(", ") || "-"}
                                                </td>
                                                <td className="px-3 py-2 text-[#930006]">{row.errors.join("; ") || "-"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </>
                )}

                <div className="flex justify-end gap-3 border-t border-[#e0e3e5] p-4">
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isBusy}
                        className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {confirmResult ? t("closeButton") : t("cancelButton")}
                    </button>
                    {!confirmResult && (
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={!canConfirm || isBusy}
                            className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isConfirming ? t("confirming") : t("confirmButton")}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
