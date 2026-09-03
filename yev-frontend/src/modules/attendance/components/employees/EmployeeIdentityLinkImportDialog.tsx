"use client";

import { useRef, useState } from "react";
import { Download, X } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";

import { EmployeeIdentityLinkImportApi } from "@/modules/attendance/api/employee-identity-link-import.api";
import type {
    EmployeeIdentityLinkImportConfirmResultDto,
    EmployeeIdentityLinkImportPreviewResultDto,
    EmployeeIdentityLinkImportRowDto,
} from "@/modules/attendance/types/employee-identity-link-import.dto";
import { getApiErrorMessage } from "@/lib/apiError";

interface EmployeeIdentityLinkImportDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onImported: () => void;
}

// Import Excel hàng loạt liên kết Employee ↔ User Identity + tự tạo tài khoản nếu chưa có + gán chữ ký
// — Admin-only (2026-09-03). Pattern Preview → Confirm giống EmployeeImportDialog, NHƯNG Confirm gửi
// lại NGUYÊN file (không phải rows) — mỗi dòng có thể kèm 1 ảnh chữ ký nhúng, không tiện round-trip
// qua JSON. `file` giữ nguyên trong state nên Confirm tái dùng đúng File object đã Preview.
export default function EmployeeIdentityLinkImportDialog({ isOpen, onClose, onImported }: EmployeeIdentityLinkImportDialogProps) {
    const t = useTranslations("Attendance.Employee");
    const [file, setFile] = useState<File | null>(null);
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const [preview, setPreview] = useState<EmployeeIdentityLinkImportPreviewResultDto | null>(null);
    const [result, setResult] = useState<EmployeeIdentityLinkImportConfirmResultDto | null>(null);
    const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const isBusy = isPreviewing || isConfirming;

    const resetState = () => {
        setFile(null);
        setPreview(null);
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

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setFile(event.target.files?.[0] ?? null);
        setPreview(null);
        setResult(null);
    };

    const handlePreview = async () => {
        if (!file) {
            toast.error(t("identityLinkChooseErrorNoFile"));
            return;
        }
        setIsPreviewing(true);
        try {
            const previewResult = await EmployeeIdentityLinkImportApi.preview(file);
            setPreview(previewResult);
            if (previewResult.invalidRows > 0) {
                toast.warn(t("identityLinkWarnInvalidRows", { count: previewResult.invalidRows }));
            } else {
                toast.success(t("identityLinkPreviewSuccess", { count: previewResult.totalRows }));
            }
        } catch (err) {
            toast.error(getApiErrorMessage(err, t("identityLinkPreviewError")));
        } finally {
            setIsPreviewing(false);
        }
    };

    const handleConfirm = async () => {
        if (!file || !preview || preview.rows.length === 0) {
            toast.error(t("identityLinkNoRowsError"));
            return;
        }
        setIsConfirming(true);
        try {
            const confirmResult = await EmployeeIdentityLinkImportApi.confirm(file);
            setResult(confirmResult);
            toast.success(
                t("identityLinkConfirmSuccess", {
                    success: confirmResult.successCount,
                    created: confirmResult.createdIdentityUserCount,
                    signatures: confirmResult.signatureSetCount,
                }) + (confirmResult.skippedCount > 0 ? t("identityLinkConfirmSuccessSkipped", { skipped: confirmResult.skippedCount }) : ".")
            );
            if (confirmResult.jobTitleAssignedCount > 0 || confirmResult.coordinatorAddedCount > 0) {
                toast.info(
                    t("identityLinkConfirmSuccessExtra", {
                        jobTitles: confirmResult.jobTitleAssignedCount,
                        coordinators: confirmResult.coordinatorAddedCount,
                    })
                );
            }
        } catch (err) {
            toast.error(getApiErrorMessage(err, t("identityLinkConfirmError")));
        } finally {
            setIsConfirming(false);
        }
    };

    const canConfirm = preview !== null && preview.rows.length > 0 && result === null;

    const handleDownloadTemplate = async () => {
        setIsDownloadingTemplate(true);
        try {
            const { blob, fileName } = await EmployeeIdentityLinkImportApi.downloadTemplate();
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName ?? "Mau_Import_LienKetTaiKhoan.xlsx";
            link.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            toast.error(getApiErrorMessage(err, t("identityLinkTemplateError")));
        } finally {
            setIsDownloadingTemplate(false);
        }
    };

    const rows: EmployeeIdentityLinkImportRowDto[] = preview?.rows ?? [];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={handleClose} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="import-identity-link-title"
                className="z-60 mx-4 flex max-h-[85vh] w-full max-w-6xl flex-col rounded-xl border border-[#e0e3e5] bg-white shadow-xl"
            >
                <div className="flex items-center justify-between border-b border-[#e0e3e5] p-6 pb-4">
                    <div>
                        <h3 id="import-identity-link-title" className="text-lg font-semibold text-[#191c1e]">
                            {t("identityLinkImportTitle")}
                        </h3>
                        <p className="mt-1 text-xs text-[#5e3f3a]">{t("identityLinkImportDescription")}</p>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isBusy}
                        className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e] disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={t("importClose")}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {result ? (
                    <div className="flex-1 overflow-auto p-6">
                        <div className="mb-4 flex flex-wrap items-center gap-4 rounded-lg border border-[#e0e3e5] bg-[#f8fafc] px-4 py-3 text-sm">
                            <span className="font-semibold text-emerald-600">
                                {t("identityLinkConfirmSuccess", {
                                    success: result.successCount,
                                    created: result.createdIdentityUserCount,
                                    signatures: result.signatureSetCount,
                                })}
                            </span>
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
                                {isPreviewing ? t("identityLinkPreviewing") : t("identityLinkPreviewButton")}
                            </button>
                            <button
                                type="button"
                                onClick={handleDownloadTemplate}
                                disabled={isDownloadingTemplate}
                                className="flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-[#5e3f3a] transition hover:text-[#191c1e] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Download className="h-3.5 w-3.5" /> {t("identityLinkDownloadTemplate")}
                            </button>
                        </div>

                        {preview && (
                            <div className="flex flex-wrap items-center gap-4 border-b border-[#e0e3e5] bg-[#f8fafc] px-4 py-3 text-xs font-semibold">
                                <span className="text-[#191c1e]">{t("identityLinkSummaryTotal", { count: preview.totalRows })}</span>
                                <span className="text-emerald-600">{t("identityLinkSummaryValid", { count: preview.validRows })}</span>
                                <span className={preview.invalidRows > 0 ? "text-[#930006]" : "text-[#5e3f3a]"}>
                                    {t("identityLinkSummaryInvalid", { count: preview.invalidRows })}
                                </span>
                                <span className="text-[#5e3f3a]">
                                    {t("identityLinkSummaryNewAccounts", { count: preview.newIdentityUserCount })} ·{" "}
                                    {t("identityLinkSummarySignatures", { count: preview.rowsWithSignatureCount })} ·{" "}
                                    {t("identityLinkSummaryJobTitles", { count: preview.rowsWithJobTitleCount })} ·{" "}
                                    {t("identityLinkSummaryCoordinators", { count: preview.rowsWithCoordinatorCount })}
                                </span>
                            </div>
                        )}

                        <div className="flex-1 overflow-auto p-2">
                            {rows.length === 0 ? (
                                <div className="px-4 py-12 text-center text-sm text-[#5e3f3a]">
                                    {isPreviewing ? t("identityLinkReadingFile") : t("identityLinkNoPreviewYet")}
                                </div>
                            ) : (
                                <table className="min-w-full border-collapse text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] font-semibold uppercase tracking-[0.1em] text-[#5e3f3a]">
                                            <th className="whitespace-nowrap px-3 py-2">{t("importColRow")}</th>
                                            <th className="whitespace-nowrap px-3 py-2">{t("importColCode")}</th>
                                            <th className="whitespace-nowrap px-3 py-2">{t("identityLinkColUserName")}</th>
                                            <th className="whitespace-nowrap px-3 py-2">{t("identityLinkColRole")}</th>
                                            <th className="whitespace-nowrap px-3 py-2">{t("identityLinkColJobTitle")}</th>
                                            <th className="whitespace-nowrap px-3 py-2">{t("identityLinkColCoordinator")}</th>
                                            <th className="whitespace-nowrap px-3 py-2">{t("identityLinkColSignature")}</th>
                                            <th className="whitespace-nowrap px-3 py-2">{t("identityLinkColStatus")}</th>
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
                                                <td className="whitespace-nowrap px-3 py-2 text-[#191c1e]">
                                                    {row.employeeCode} {row.resolvedEmployeeFullName ? `— ${row.resolvedEmployeeFullName}` : ""}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">{row.userName ?? "-"}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">{row.roleName ?? "Basic"}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">{row.resolvedJobTitleName ?? "-"}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">
                                                    {row.isCoordinator ? (row.coordinatorScopeDescription ?? t("identityLinkSignatureYes")) : "-"}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">
                                                    {row.hasSignatureImage ? t("identityLinkSignatureYes") : t("identityLinkSignatureNo")}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">
                                                    {row.identityUserAlreadyExists ? t("identityLinkStatusExisting") : t("identityLinkStatusNew")}
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
                        {result ? t("importClose") : t("importCancel")}
                    </button>
                    {!result && (
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={!canConfirm || isBusy}
                            className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isConfirming ? t("identityLinkConfirming") : t("identityLinkConfirmButton")}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
