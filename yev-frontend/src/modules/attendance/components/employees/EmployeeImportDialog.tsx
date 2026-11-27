"use client";

import { useRef, useState } from "react";
import { Building2, Download, FileSpreadsheet, Loader2, UserPlus, Users, X } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

import { EmployeeImportApi } from "@/modules/attendance/api/employee-import.api";
import {
    EMPLOYEE_IMPORT_MODE,
    type EmployeeImportConfirmResultDto,
    type EmployeeImportMode,
    type EmployeeImportPreviewRowDto,
    type EmployeeImportRemovedRowDto,
} from "@/modules/attendance/types/employee-import.dto";
import ExportFilteredButton from "./ExportFilteredButton";
import type { EmployeeExportFilter } from "@/modules/attendance/types/employee-import.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import InfoTooltip from "@/components/ui/InfoTooltip";
import { IconButton, IconFlag } from "@/components/ui/ListToolbar";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/common/EmptyState";

interface EmployeeImportDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onImported: () => void;
    exportFilter: EmployeeExportFilter;
}

export default function EmployeeImportDialog({ isOpen, onClose, onImported, exportFilter }: EmployeeImportDialogProps) {
    const t = useTranslations("Attendance.Employee");
    const tCommon = useTranslations("Common");
    const [file, setFile] = useState<File | null>(null);
    const [mode, setMode] = useState<EmployeeImportMode>(EMPLOYEE_IMPORT_MODE.add);
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const [rows, setRows] = useState<EmployeeImportPreviewRowDto[]>([]);
    const [removedRows, setRemovedRows] = useState<EmployeeImportRemovedRowDto[]>([]);
    const [summary, setSummary] = useState<{
        totalRows: number;
        validRows: number;
        invalidRows: number;
        newDepartmentCount: number;
        newGroupCount: number;
    } | null>(null);
    const [result, setResult] = useState<EmployeeImportConfirmResultDto | null>(null);
    const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const isBusy = isPreviewing || isConfirming;

    const resetState = () => {
        setFile(null);
        setRows([]);
        setRemovedRows([]);
        setSummary(null);
        setResult(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleClose = () => {
        if (isBusy) return;
        const hadResult = result !== null;
        resetState();
        onClose();
        if (hadResult) onImported();
    };

    const clearPreview = () => {
        setRows([]);
        setRemovedRows([]);
        setSummary(null);
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setFile(event.target.files?.[0] ?? null);
        clearPreview();
    };

    // The preview depends on the mode (group resolution and resigned list), so switching discards it.
    const handleModeChange = (next: EmployeeImportMode) => {
        setMode(next);
        clearPreview();
    };

    const handlePreview = async () => {
        if (!file) {
            toast.error(t("importChooseErrorNoFile"));
            return;
        }
        setIsPreviewing(true);
        try {
            const previewResult = await EmployeeImportApi.previewImport(file, mode);
            setRows(previewResult.rows);
            setRemovedRows(previewResult.removedRows);
            setSummary({
                totalRows: previewResult.totalRows,
                validRows: previewResult.validRows,
                invalidRows: previewResult.invalidRows,
                newDepartmentCount: previewResult.newDepartmentCount,
                newGroupCount: previewResult.newGroupCount,
            });
            if (previewResult.invalidRows > 0) {
                toast.warn(t("importWarnInvalidRows", { count: previewResult.invalidRows }));
            } else {
                toast.success(t("importPreviewSuccess", { count: previewResult.totalRows }));
            }
        } catch (err) {
            toast.error(getApiErrorMessage(err, t("importPreviewError")));
        } finally {
            setIsPreviewing(false);
        }
    };

    const handleConfirm = async () => {
        if (rows.length === 0) {
            toast.error(t("importNoRowsError"));
            return;
        }
        setIsConfirming(true);
        try {
            // Send all rows including invalid ones; BE re-validates and skips bad rows.
            const confirmResult = await EmployeeImportApi.confirmImport(rows, mode);
            setResult(confirmResult);
            toast.success(
                t("importConfirmSuccess", {
                    created: confirmResult.createdEmployeeCount,
                    updated: confirmResult.updatedEmployeeCount,
                }) +
                    (confirmResult.skippedCount > 0
                        ? t("importConfirmSuccessSkipped", { skipped: confirmResult.skippedCount })
                        : ".")
            );
        } catch (err) {
            toast.error(getApiErrorMessage(err, t("importConfirmError")));
        } finally {
            setIsConfirming(false);
        }
    };

    const canConfirm = summary !== null && rows.length > 0 && result === null;

    const handleDownloadTemplate = async () => {
        setIsDownloadingTemplate(true);
        try {
            const { blob, fileName } = await EmployeeImportApi.downloadTemplate();
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName ?? "Mau_Import_NhanVien.xlsx";
            link.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            toast.error(getApiErrorMessage(err, t("importTemplateError")));
        } finally {
            setIsDownloadingTemplate(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={handleClose} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="import-employee-title"
                className="z-60 mx-4 flex max-h-[85vh] w-full max-w-6xl flex-col rounded-xl border border-[#e0e3e5] bg-white shadow-xl"
            >
                <div className="flex items-center justify-between border-b border-[#e0e3e5] p-6 pb-4">
                    <div className="flex items-center gap-1.5">
                        <h3 id="import-employee-title" className="text-lg font-semibold text-[#191c1e]">
                            {t("importTitle")}
                        </h3>
                        <InfoTooltip text={t("importDescription")} />
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isBusy}
                        className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e] disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={tCommon("close")}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {result ? (
                    <div className="flex-1 overflow-auto p-6">
                        <div className="mb-4 flex flex-wrap items-center gap-4 rounded-lg border border-[#e0e3e5] bg-[#f8fafc] px-4 py-3 text-sm">
                            <span className="font-semibold text-emerald-600">
                                {t("importCreatedCount", { count: result.createdEmployeeCount })}
                            </span>
                            <span className="text-[#5e3f3a]">{t("importUpdatedCount", { count: result.updatedEmployeeCount })}</span>
                            {result.createdDepartmentCount > 0 && (
                                <span className="text-[#5e3f3a]">{t("importNewDepartmentCount", { count: result.createdDepartmentCount })}</span>
                            )}
                            {result.createdGroupCount > 0 && (
                                <span className="text-[#5e3f3a]">{t("importNewGroupCount", { count: result.createdGroupCount })}</span>
                            )}
                            {result.resignedCount > 0 && (
                                <span className="text-[#930006]">{t("importRemovedCount", { count: result.resignedCount })}</span>
                            )}
                            <span className={result.skippedCount > 0 ? "font-semibold text-[#930006]" : "text-[#5e3f3a]"}>
                                {t("importSkippedCount", { count: result.skippedCount })}
                            </span>
                        </div>

                        {result.skippedRows.length > 0 && (
                            <div>
                                <h4 className="mb-2 text-sm font-semibold text-[#930006]">{t("importSkippedRowsTitle")}</h4>
                                <table className="min-w-full border-collapse text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-[#e0e3e5] bg-[#fff4f2] font-semibold uppercase tracking-[0.1em] text-[#930006]">
                                            <th className="whitespace-nowrap px-3 py-2">{t("importColRow")}</th>
                                            <th className="whitespace-nowrap px-3 py-2">{t("importColCode")}</th>
                                            <th className="px-3 py-2">{t("importColError")}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {result.skippedRows.map((row) => (
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
                    </div>
                ) : (
                    <>
                        <div className="flex flex-wrap items-center gap-3 border-b border-[#e0e3e5] p-4">
                            <div className="inline-flex shrink-0 rounded-lg border border-[#e0e3e5] bg-[#f8fafc] p-0.5" role="radiogroup">
                                {([
                                    [EMPLOYEE_IMPORT_MODE.add, t("importModeAdd"), t("importModeAddHint")],
                                    [EMPLOYEE_IMPORT_MODE.overwrite, t("importModeOverwrite"), t("importModeOverwriteHint")],
                                ] as const).map(([value, label, hint]) => (
                                    <button
                                        key={value}
                                        type="button"
                                        role="radio"
                                        aria-checked={mode === value}
                                        title={hint}
                                        disabled={isBusy}
                                        onClick={() => handleModeChange(value)}
                                        className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed ${
                                            mode === value ? "bg-white text-[#191c1e] shadow-sm" : "text-[#5e3f3a] hover:text-[#191c1e]"
                                        }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
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
                                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isPreviewing && <Loader2 className="h-4 w-4 animate-spin" />}
                                {t("importPreviewButton")}
                            </button>
                            <IconButton icon={Download} label={tCommon("downloadTemplate")} onClick={handleDownloadTemplate} disabled={isDownloadingTemplate} />
                            <ExportFilteredButton download={() => EmployeeImportApi.exportEmployees(exportFilter)} fallbackFileName="NhanVien.xlsx" />
                        </div>

                        {summary && (
                            <div className="flex flex-wrap items-center gap-4 border-b border-[#e0e3e5] bg-[#f8fafc] px-4 py-3 text-xs font-semibold">
                                <span className="text-[#191c1e]">{t("importSummaryTotal", { count: summary.totalRows })}</span>
                                <span className="text-emerald-600">{t("importSummaryValid", { count: summary.validRows })}</span>
                                <span
                                    className={summary.invalidRows > 0 ? "text-[#930006]" : "text-[#5e3f3a]"}
                                    title={summary.invalidRows > 0 ? t("importSummaryHint") : undefined}
                                >
                                    {t("importSummaryInvalid", { count: summary.invalidRows })}
                                </span>
                                {summary.newDepartmentCount > 0 && (
                                    <span className="text-[#5e3f3a]">{t("importNewDepartmentCount", { count: summary.newDepartmentCount })}</span>
                                )}
                                {summary.newGroupCount > 0 && (
                                    <span className="text-[#5e3f3a]">{t("importNewGroupCount", { count: summary.newGroupCount })}</span>
                                )}
                                {removedRows.length > 0 && (
                                    <span className="text-[#930006]">{t("importRemovedCount", { count: removedRows.length })}</span>
                                )}
                            </div>
                        )}

                        <div className="flex-1 overflow-auto p-2">
                            {rows.length === 0 ? (
                                isPreviewing ? (
                                    <div className="space-y-2 p-2">
                                        {Array.from({ length: 6 }, (_, i) => (
                                            <Skeleton key={i} className="h-6 w-full" />
                                        ))}
                                    </div>
                                ) : (
                                    <EmptyState icon={FileSpreadsheet} title={t("importNoPreviewYet")} />
                                )
                            ) : (
                                <table className="min-w-full border-collapse text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] font-semibold uppercase tracking-[0.1em] text-[#5e3f3a]">
                                            <th className="whitespace-nowrap px-3 py-2">{t("importColRow")}</th>
                                            <th className="whitespace-nowrap px-3 py-2">{t("importColCode")}</th>
                                            <th className="whitespace-nowrap px-3 py-2">{t("importColResolvedName")}</th>
                                            <th className="whitespace-nowrap px-3 py-2">{t("importColDepartment")}</th>
                                            <th className="whitespace-nowrap px-3 py-2">{t("importColGroup")}</th>
                                            <th className="whitespace-nowrap px-3 py-2">{t("importColProduction")}</th>
                                            <th className="whitespace-nowrap px-3 py-2">{t("importColNew")}</th>
                                            <th className="min-w-[200px] px-3 py-2">{t("importColError")}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row) => (
                                            <tr
                                                key={row.rowNumber}
                                                className={`border-b border-[#f1f5f9] ${!row.isValid ? "bg-[#fff4f2]" : ""}`}
                                            >
                                                <td className="whitespace-nowrap px-3 py-2 font-semibold text-[#191c1e]">{row.rowNumber}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#191c1e]">{row.employeeCode}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">
                                                    {row.resolvedLastName ?? "-"} {row.resolvedFirstName ?? ""}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">
                                                    {[row.workshopCode, row.departmentCode].filter(Boolean).join(" · ") || "-"}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">
                                                    {row.groupCode ? `${row.groupCode} — ${row.groupNameVn ?? ""}` : "-"}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">
                                                    {[row.lineCode, row.teamCode, row.shiftTeamCode, row.staffKind, row.congDoan, row.taskName]
                                                        .filter(Boolean)
                                                        .join(" · ") || "-"}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">
                                                    <span className="inline-flex gap-1">
                                                        {row.isNewEmployee && <IconFlag icon={UserPlus} label={t("importNewEmployeeTag")} tone="success" />}
                                                        {row.isNewDepartment && <IconFlag icon={Building2} label={t("importNewDepartmentTag")} tone="neutral" />}
                                                        {row.isNewGroup && <IconFlag icon={Users} label={t("importNewGroupTag")} tone="neutral" />}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2">
                                                    {row.errors.length === 0 ? "-" : <div className="text-[#930006]">{row.errors.join("; ")}</div>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                            {removedRows.length > 0 && (
                                <div className="mt-4 px-1">
                                    <h4 className="mb-2 text-sm font-semibold text-[#930006]">{t("importRemovedTitle")}</h4>
                                    <table className="min-w-full border-collapse text-left text-xs">
                                        <tbody>
                                            {removedRows.map((row) => (
                                                <tr key={row.employeeCode} className="border-b border-[#f1f5f9]">
                                                    <td className="whitespace-nowrap px-3 py-2 font-semibold text-[#191c1e]">{row.employeeCode}</td>
                                                    <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">{row.fullName}</td>
                                                    <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">{row.groupNameVn ?? "-"}</td>
                                                    <td className="w-full px-3 py-2 text-[#5e3f3a]">{row.lineCode ?? "-"}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
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
                        {result ? tCommon("close") : tCommon("cancel")}
                    </button>
                    {!result && (
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={!canConfirm || isBusy}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isConfirming && <Loader2 className="h-4 w-4 animate-spin" />}
                            {tCommon("import")}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
