"use client";

import { useRef, useState } from "react";
import { toast } from "react-toastify";

import { DeviceConfigurationImportApi } from "@/modules/pc-management/api/device-configuration-import.api";
import type { DeviceConfigurationImportPreviewRowDto } from "@/modules/pc-management/types/device-configuration-import.dto";
import { getApiErrorMessage } from "@/lib/apiError";

interface ImportDeviceConfigurationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onImported: () => void;
}

export default function ImportDeviceConfigurationDialog({
    isOpen,
    onClose,
    onImported,
}: ImportDeviceConfigurationDialogProps) {
    const [file, setFile] = useState<File | null>(null);
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const [rows, setRows] = useState<DeviceConfigurationImportPreviewRowDto[]>([]);
    const [summary, setSummary] = useState<{
        totalRows: number;
        validRows: number;
        invalidRows: number;
        outOfScopeSkippedCount: number;
    } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const isBusy = isPreviewing || isConfirming;

    const resetState = () => {
        setFile(null);
        setRows([]);
        setSummary(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleClose = () => {
        if (isBusy) return;
        resetState();
        onClose();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selected = event.target.files?.[0] ?? null;
        setFile(selected);
        setRows([]);
        setSummary(null);
    };

    const handlePreview = async () => {
        if (!file) {
            toast.error("Vui lòng chọn file Tanium trước.");
            return;
        }
        setIsPreviewing(true);
        try {
            const result = await DeviceConfigurationImportApi.previewImport(file);
            setRows(result.rows);
            setSummary({
                totalRows: result.totalRows,
                validRows: result.validRows,
                invalidRows: result.invalidRows,
                outOfScopeSkippedCount: result.outOfScopeSkippedCount,
            });
            if (result.invalidRows > 0) {
                toast.warn(`Có ${result.invalidRows} dòng lỗi — kiểm tra lại rồi xem trước lại.`);
            } else {
                toast.success(`Đã xem trước ${result.totalRows} dòng, tất cả hợp lệ.`);
            }
        } catch (err) {
            toast.error(getApiErrorMessage(err, "Xem trước file Tanium thất bại."));
        } finally {
            setIsPreviewing(false);
        }
    };

    const handleConfirm = async () => {
        if (!summary || summary.invalidRows > 0 || rows.length === 0) return;
        setIsConfirming(true);
        try {
            const rawRows = rows.map((row) => ({
                computerName: row.computerName,
                taniumIpAddress: row.taniumIpAddress,
                manufacturer: row.manufacturer,
                model: row.model,
                cpu: row.cpu,
                ram: row.ram,
                size: row.size,
            }));
            const result = await DeviceConfigurationImportApi.confirmImport(rawRows);
            toast.success(
                `Đồng bộ thành công — tạo mới ${result.createdConfigCount} cấu hình, ` +
                    `cập nhật ${result.updatedConfigCount} cấu hình` +
                    (result.ipReassignedCount > 0 ? `, gán lại IP cho ${result.ipReassignedCount} thiết bị.` : ".")
            );
            resetState();
            onImported();
        } catch (err) {
            toast.error(getApiErrorMessage(err, "Xác nhận đồng bộ thất bại."));
        } finally {
            setIsConfirming(false);
        }
    };

    const canConfirm = summary !== null && summary.invalidRows === 0 && rows.length > 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={handleClose} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="import-device-configuration-title"
                className="z-60 mx-4 flex max-h-[85vh] w-full max-w-6xl flex-col rounded-xl border border-[#e0e3e5] bg-white shadow-xl"
            >
                <div className="flex items-center justify-between border-b border-[#e0e3e5] p-6 pb-4">
                    <div>
                        <h3 id="import-device-configuration-title" className="text-lg font-semibold text-[#191c1e]">
                            Đồng bộ cấu hình từ Tanium
                        </h3>
                        <p className="mt-1 text-xs text-[#5e3f3a]">
                            Chọn file kiểm kê xuất từ Tanium — chỉ cập nhật cấu hình phần cứng cho thiết bị đã có sẵn
                            trong hệ thống (mã YDC/YLC/YDF/AC/TYC), không tạo thiết bị mới.
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

                <div className="flex flex-wrap items-center gap-3 border-b border-[#e0e3e5] p-4">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls,.csv"
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
                            Đã bỏ qua {summary.outOfScopeSkippedCount} máy ngoài phạm vi (không thuộc mã
                            YDC/YLC/YDF/AC/TYC)
                        </span>
                        {summary.invalidRows > 0 && (
                            <span className="text-[#930006]">— Sửa lại file gốc rồi chọn lại và xem trước lại.</span>
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
                                    <th className="whitespace-nowrap px-3 py-2">Computer Name</th>
                                    <th className="whitespace-nowrap px-3 py-2">Mã / Tên tách được</th>
                                    <th className="whitespace-nowrap px-3 py-2">Hãng / Model</th>
                                    <th className="whitespace-nowrap px-3 py-2">CPU</th>
                                    <th className="whitespace-nowrap px-3 py-2">RAM</th>
                                    <th className="whitespace-nowrap px-3 py-2">Ổ cứng</th>
                                    <th className="whitespace-nowrap px-3 py-2">IP Tanium</th>
                                    <th className="min-w-[200px] px-3 py-2">Lỗi / Cảnh báo</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => (
                                    <tr
                                        key={row.rowNumber}
                                        className={`border-b border-[#f1f5f9] ${
                                            !row.isValid ? "bg-[#fff4f2]" : row.warnings.length > 0 ? "bg-[#fffbeb]" : ""
                                        }`}
                                    >
                                        <td className="whitespace-nowrap px-3 py-2 font-semibold text-[#191c1e]">{row.rowNumber}</td>
                                        <td className="whitespace-nowrap px-3 py-2 text-[#191c1e]" title={row.computerName}>
                                            {row.computerName}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">
                                            {row.parsedDeviceCode} — {row.parsedDeviceName}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">
                                            {row.manufacturer ?? "-"} / {row.model ?? "-"}
                                        </td>
                                        <td className="max-w-[160px] truncate px-3 py-2 text-[#5e3f3a]" title={row.cpu ?? undefined}>
                                            {row.cpu ?? "-"}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">{row.ram ?? "-"}</td>
                                        <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">{row.size ?? "-"}</td>
                                        <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">{row.taniumIpAddress ?? "-"}</td>
                                        <td className="px-3 py-2">
                                            {!row.isValid && (
                                                <div className="text-[#930006]">{row.errors.join("; ")}</div>
                                            )}
                                            {row.warnings.length > 0 && (
                                                <div className="text-[#b45309]">{row.warnings.join("; ")}</div>
                                            )}
                                            {row.isValid && row.warnings.length === 0 && "-"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="flex justify-end gap-3 border-t border-[#e0e3e5] p-4">
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isBusy}
                        className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Huỷ
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={!canConfirm || isBusy}
                        className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isConfirming ? "Đang đồng bộ..." : "Xác nhận đồng bộ"}
                    </button>
                </div>
            </div>
        </div>
    );
}
