"use client";

import { useRef, useState } from "react";
import { toast } from "react-toastify";

import { DeviceLiquidationImportApi } from "@/modules/pc-management/api/device-liquidation-import.api";
import type {
    DeviceLiquidationImportConfirmResultDto,
    DeviceLiquidationImportPreviewRowDto,
} from "@/modules/pc-management/types/device-liquidation-import.dto";
import { getApiErrorMessage } from "@/lib/apiError";

interface ImportDeviceLiquidationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onImported: () => void;
}

// Dòng bị bỏ qua vì còn lỗi validate ở bước preview — bỏ hẳn khỏi request Confirm
// (không gửi lên server) để tránh bị BE từ chối cả batch, xem device-liquidation-import.dto.ts.
interface LocalSkippedRow {
    rowNumber: number;
    deviceCode: string;
    errors: string[];
}

export default function ImportDeviceLiquidationDialog({
    isOpen,
    onClose,
    onImported,
}: ImportDeviceLiquidationDialogProps) {
    const [file, setFile] = useState<File | null>(null);
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const [rows, setRows] = useState<DeviceLiquidationImportPreviewRowDto[]>([]);
    const [summary, setSummary] = useState<{ totalRows: number; validRows: number; invalidRows: number } | null>(null);
    const [result, setResult] = useState<DeviceLiquidationImportConfirmResultDto | null>(null);
    const [localSkippedRows, setLocalSkippedRows] = useState<LocalSkippedRow[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const isBusy = isPreviewing || isConfirming;

    const resetState = () => {
        setFile(null);
        setRows([]);
        setSummary(null);
        setResult(null);
        setLocalSkippedRows([]);
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
            toast.error("Vui lòng chọn file danh sách mã máy trước.");
            return;
        }
        setIsPreviewing(true);
        try {
            const previewResult = await DeviceLiquidationImportApi.previewImport(file);
            setRows(previewResult.rows);
            setSummary({
                totalRows: previewResult.totalRows,
                validRows: previewResult.validRows,
                invalidRows: previewResult.invalidRows,
            });
            if (previewResult.invalidRows > 0) {
                toast.warn(`Có ${previewResult.invalidRows} dòng lỗi — các dòng này sẽ tự bị bỏ qua khi xác nhận thanh lý.`);
            } else {
                toast.success(`Đã xem trước ${previewResult.totalRows} dòng, tất cả hợp lệ.`);
            }
        } catch (err) {
            toast.error(getApiErrorMessage(err, "Xem trước file thất bại."));
        } finally {
            setIsPreviewing(false);
        }
    };

    const handleConfirm = async () => {
        const validRows = rows.filter((row) => row.isValid);
        if (validRows.length === 0) {
            toast.error("Không có dòng hợp lệ nào để thanh lý.");
            return;
        }
        setIsConfirming(true);
        try {
            const rawRows = validRows.map((row) => ({ deviceCode: row.deviceCode }));
            const confirmResult = await DeviceLiquidationImportApi.confirmImport(rawRows);
            setResult(confirmResult);
            setLocalSkippedRows(
                rows
                    .filter((row) => !row.isValid)
                    .map((row) => ({ rowNumber: row.rowNumber, deviceCode: row.deviceCode, errors: row.errors }))
            );
            toast.success(
                `Đã thanh lý ${confirmResult.liquidatedCount} thiết bị` +
                    (confirmResult.skippedCount > 0 ? `, bỏ qua ${confirmResult.skippedCount} dòng.` : ".")
            );
        } catch (err) {
            toast.error(getApiErrorMessage(err, "Xác nhận thanh lý thất bại."));
        } finally {
            setIsConfirming(false);
        }
    };

    const canConfirm = summary !== null && rows.some((row) => row.isValid) && result === null;

    // skippedRows server trả về (BE re-validate) hợp nhất với các dòng FE đã tự lọc bỏ trước khi gửi.
    const allSkippedRows: LocalSkippedRow[] = result
        ? [...localSkippedRows, ...result.skippedRows]
        : localSkippedRows;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={handleClose} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="import-device-liquidation-title"
                className="z-60 mx-4 flex max-h-[85vh] w-full max-w-4xl flex-col rounded-xl border border-[#e0e3e5] bg-white shadow-xl"
            >
                <div className="flex items-center justify-between border-b border-[#e0e3e5] p-6 pb-4">
                    <div>
                        <h3 id="import-device-liquidation-title" className="text-lg font-semibold text-[#191c1e]">
                            Nhập thanh lý hàng loạt
                        </h3>
                        <p className="mt-1 text-xs text-[#5e3f3a]">
                            Chọn file danh sách mã máy (1 cột &quot;Mã máy&quot;) để chuyển hàng loạt thiết bị đang
                            &quot;Chờ thanh lý&quot; sang &quot;Đã thanh lý&quot;. Thiết bị sẽ bị gỡ hết IP và ẩn email
                            sau khi thanh lý.
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
                            <span className="font-semibold text-[#16a34a]">Đã thanh lý {result.liquidatedCount} thiết bị</span>
                            <span className="text-[#5e3f3a]">Đã gỡ IP: {result.releasedIpCount}</span>
                            <span className={allSkippedRows.length > 0 ? "font-semibold text-[#930006]" : "text-[#5e3f3a]"}>
                                Bỏ qua (lỗi): {allSkippedRows.length}
                            </span>
                        </div>

                        {allSkippedRows.length > 0 && (
                            <div>
                                <h4 className="mb-2 text-sm font-semibold text-[#930006]">Dòng bị bỏ qua</h4>
                                <table className="min-w-full border-collapse text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-[#e0e3e5] bg-[#fff4f2] font-semibold uppercase tracking-[0.1em] text-[#930006]">
                                            <th className="whitespace-nowrap px-3 py-2">Dòng</th>
                                            <th className="whitespace-nowrap px-3 py-2">Mã máy</th>
                                            <th className="px-3 py-2">Lỗi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {allSkippedRows.map((row) => (
                                            <tr key={row.rowNumber} className="border-b border-[#f1f5f9]">
                                                <td className="whitespace-nowrap px-3 py-2 font-semibold text-[#191c1e]">{row.rowNumber}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#191c1e]">{row.deviceCode}</td>
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
                                accept=".xlsx,.xls,.csv"
                                onChange={handleFileChange}
                                disabled={isBusy}
                                className="flex-1 text-sm text-[#191c1e] file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-[#f8fafc] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[#191c1e] hover:file:bg-[#f2f4f6]"
                            />
                            <a
                                href="/assets/file-samples/ImportDeviceLiquidation.xlsx"
                                download="ImportDeviceLiquidation.xlsx"
                                className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-[#f8fafc] px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                            >
                                Tải file mẫu
                            </a>
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
                                {summary.invalidRows > 0 && (
                                    <span className="text-[#930006]">— Các dòng lỗi sẽ tự bị bỏ qua khi xác nhận thanh lý.</span>
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
                                            <th className="whitespace-nowrap px-3 py-2">Mã máy</th>
                                            <th className="whitespace-nowrap px-3 py-2">Trạng thái hiện tại</th>
                                            <th className="min-w-[240px] px-3 py-2">Lỗi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row) => (
                                            <tr
                                                key={row.rowNumber}
                                                className={`border-b border-[#f1f5f9] ${!row.isValid ? "bg-[#fff4f2]" : ""}`}
                                            >
                                                <td className="whitespace-nowrap px-3 py-2 font-semibold text-[#191c1e]">{row.rowNumber}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#191c1e]">{row.deviceCode}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">{row.currentStatusText}</td>
                                                <td className="px-3 py-2">
                                                    {!row.isValid ? (
                                                        <span className="text-[#930006]">{row.errors.join("; ")}</span>
                                                    ) : (
                                                        "-"
                                                    )}
                                                </td>
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
                            {isConfirming ? "Đang thanh lý..." : "Xác nhận thanh lý"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
