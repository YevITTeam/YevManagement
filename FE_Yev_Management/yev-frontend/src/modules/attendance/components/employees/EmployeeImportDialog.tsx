"use client";

import { useRef, useState } from "react";
import { toast } from "react-toastify";

import { EmployeeImportApi } from "@/modules/attendance/api/employee-import.api";
import type {
    EmployeeImportConfirmResultDto,
    EmployeeImportPreviewRowDto,
} from "@/modules/attendance/types/employee-import.dto";
import { getApiErrorMessage } from "@/lib/apiError";

interface EmployeeImportDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onImported: () => void;
}

// Pattern Preview → Confirm giống hệt import Device bên module Asset
// (src/modules/pc-management/components/devices/ImportDeviceConfigurationDialog.tsx) —
// docs/attendance-api-fe.md §3.7/§8.
export default function EmployeeImportDialog({ isOpen, onClose, onImported }: EmployeeImportDialogProps) {
    const [file, setFile] = useState<File | null>(null);
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const [rows, setRows] = useState<EmployeeImportPreviewRowDto[]>([]);
    const [summary, setSummary] = useState<{
        totalRows: number;
        validRows: number;
        invalidRows: number;
        newDepartmentCount: number;
        newGroupCount: number;
    } | null>(null);
    const [result, setResult] = useState<EmployeeImportConfirmResultDto | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const isBusy = isPreviewing || isConfirming;

    const resetState = () => {
        setFile(null);
        setRows([]);
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

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selected = event.target.files?.[0] ?? null;
        setFile(selected);
        setRows([]);
        setSummary(null);
    };

    const handlePreview = async () => {
        if (!file) {
            toast.error("Vui lòng chọn file Excel nhân sự trước.");
            return;
        }
        setIsPreviewing(true);
        try {
            const previewResult = await EmployeeImportApi.previewImport(file);
            setRows(previewResult.rows);
            setSummary({
                totalRows: previewResult.totalRows,
                validRows: previewResult.validRows,
                invalidRows: previewResult.invalidRows,
                newDepartmentCount: previewResult.newDepartmentCount,
                newGroupCount: previewResult.newGroupCount,
            });
            if (previewResult.invalidRows > 0) {
                toast.warn(`Có ${previewResult.invalidRows} dòng lỗi — các dòng này sẽ tự bị bỏ qua khi xác nhận import.`);
            } else {
                toast.success(`Đã xem trước ${previewResult.totalRows} dòng, tất cả hợp lệ.`);
            }
        } catch (err) {
            toast.error(getApiErrorMessage(err, "Xem trước file Excel thất bại."));
        } finally {
            setIsPreviewing(false);
        }
    };

    const handleConfirm = async () => {
        if (rows.length === 0) {
            toast.error("Chưa có dữ liệu xem trước để import.");
            return;
        }
        setIsConfirming(true);
        try {
            // Gửi lại NGUYÊN rows từ Preview (kể cả dòng isValid=false) — BE tự re-validate và bỏ qua
            // dòng lỗi, không phải FE tự lọc trước (docs §3.7).
            const confirmResult = await EmployeeImportApi.confirmImport(rows);
            setResult(confirmResult);
            toast.success(
                `Import thành công — tạo mới ${confirmResult.createdEmployeeCount} nhân viên, ` +
                    `cập nhật ${confirmResult.updatedEmployeeCount} nhân viên` +
                    (confirmResult.skippedCount > 0 ? `, bỏ qua ${confirmResult.skippedCount} dòng lỗi.` : ".")
            );
        } catch (err) {
            toast.error(getApiErrorMessage(err, "Xác nhận import thất bại."));
        } finally {
            setIsConfirming(false);
        }
    };

    const canConfirm = summary !== null && rows.length > 0 && result === null;

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
                    <div>
                        <h3 id="import-employee-title" className="text-lg font-semibold text-[#191c1e]">
                            Import nhân sự từ Excel
                        </h3>
                        <p className="mt-1 text-xs text-[#5e3f3a]">
                            Chọn file .xlsx (cột: No./Employee code/Full name/Department/Department Name/Group/Group
                            Name) — upsert theo mã nhân viên, tự tạo Bộ phận/Nhóm mới nếu chưa có.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isBusy}
                        className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e] disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Đóng"
                    >
                        ✕
                    </button>
                </div>

                {result ? (
                    <div className="flex-1 overflow-auto p-6">
                        <div className="mb-4 flex flex-wrap items-center gap-4 rounded-lg border border-[#e0e3e5] bg-[#f8fafc] px-4 py-3 text-sm">
                            <span className="font-semibold text-[#16a34a]">Tạo mới {result.createdEmployeeCount} nhân viên</span>
                            <span className="text-[#5e3f3a]">Cập nhật: {result.updatedEmployeeCount}</span>
                            <span className="text-[#5e3f3a]">Bộ phận mới: {result.createdDepartmentCount}</span>
                            <span className="text-[#5e3f3a]">Nhóm mới: {result.createdGroupCount}</span>
                            <span className={result.skippedCount > 0 ? "font-semibold text-[#930006]" : "text-[#5e3f3a]"}>
                                Bỏ qua (lỗi): {result.skippedCount}
                            </span>
                        </div>

                        {result.skippedRows.length > 0 && (
                            <div>
                                <h4 className="mb-2 text-sm font-semibold text-[#930006]">Dòng bị bỏ qua</h4>
                                <table className="min-w-full border-collapse text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-[#e0e3e5] bg-[#fff4f2] font-semibold uppercase tracking-[0.1em] text-[#930006]">
                                            <th className="whitespace-nowrap px-3 py-2">Dòng</th>
                                            <th className="whitespace-nowrap px-3 py-2">Mã NV</th>
                                            <th className="px-3 py-2">Lỗi</th>
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
                                {isPreviewing ? "Đang xem trước..." : "Xem trước"}
                            </button>
                        </div>

                        {summary && (
                            <div className="flex flex-wrap items-center gap-4 border-b border-[#e0e3e5] bg-[#f8fafc] px-4 py-3 text-xs font-semibold">
                                <span className="text-[#191c1e]">Tổng: {summary.totalRows} dòng</span>
                                <span className="text-[#16a34a]">Hợp lệ: {summary.validRows}</span>
                                <span className={summary.invalidRows > 0 ? "text-[#930006]" : "text-[#5e3f3a]"}>
                                    Lỗi: {summary.invalidRows}
                                </span>
                                <span className="text-[#5e3f3a]">
                                    Bộ phận mới: {summary.newDepartmentCount} · Nhóm mới: {summary.newGroupCount}
                                </span>
                                {summary.invalidRows > 0 && (
                                    <span className="text-[#930006]">— Các dòng lỗi sẽ tự bị bỏ qua khi xác nhận import.</span>
                                )}
                            </div>
                        )}

                        <div className="flex-1 overflow-auto p-2">
                            {rows.length === 0 ? (
                                <div className="px-4 py-12 text-center text-sm text-[#5e3f3a]">
                                    {isPreviewing ? "Đang đọc file..." : "Chưa có dữ liệu xem trước. Chọn file rồi bấm \"Xem trước\"."}
                                </div>
                            ) : (
                                <table className="min-w-full border-collapse text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] font-semibold uppercase tracking-[0.1em] text-[#5e3f3a]">
                                            <th className="whitespace-nowrap px-3 py-2">Dòng</th>
                                            <th className="whitespace-nowrap px-3 py-2">Mã NV</th>
                                            <th className="whitespace-nowrap px-3 py-2">Họ / Tên tách được</th>
                                            <th className="whitespace-nowrap px-3 py-2">Bộ phận</th>
                                            <th className="whitespace-nowrap px-3 py-2">Nhóm</th>
                                            <th className="whitespace-nowrap px-3 py-2">Mới?</th>
                                            <th className="min-w-[200px] px-3 py-2">Lỗi</th>
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
                                                    {row.departmentCode} — {row.departmentNameVn}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">
                                                    {row.groupCode} — {row.groupNameVn}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">
                                                    {[
                                                        row.isNewEmployee && "NV",
                                                        row.isNewDepartment && "BP",
                                                        row.isNewGroup && "Nhóm",
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
                        {result ? "Đóng" : "Huỷ"}
                    </button>
                    {!result && (
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={!canConfirm || isBusy}
                            className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isConfirming ? "Đang import..." : "Xác nhận import"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
