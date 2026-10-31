"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { toast } from "react-toastify";

import { DeviceImportApi } from "@/modules/pc-management/api/device-import.api";
import type {
    DeviceImportConfirmResultDto,
    DeviceImportPreviewRowDto,
} from "@/modules/pc-management/types/device-import.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import PrintDeviceQrLabelsDialog from "@/modules/pc-management/components/PrintDeviceQrLabelsDialog";
import ConfirmDialog from "@/components/common/ConfirmDialog";

interface ImportDeviceDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onImported: () => void;
    // After Confirm, pendingTransfers (from the old-device-code column) prefill the Transfer screen.
    onRequestTransfer?: (transfer: { oldDeviceId: number; oldDeviceCode: string; newDeviceId: number }) => void;
}

function formatDate(value: string | null) {
    if (!value) return "-";
    // BE returns "dd/MM/yyyy"; parse manually because new Date() reads it as MM/dd/yyyy.
    const slashMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
        const [, day, month, year] = slashMatch;
        return `${Number(day)}/${Number(month)}/${year}`;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("vi-VN");
}

export default function ImportDeviceDialog({ isOpen, onClose, onImported, onRequestTransfer }: ImportDeviceDialogProps) {
    const [file, setFile] = useState<File | null>(null);
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const [rows, setRows] = useState<DeviceImportPreviewRowDto[]>([]);
    const [summary, setSummary] = useState<{ totalRows: number; validRows: number; invalidRows: number } | null>(null);
    const [result, setResult] = useState<DeviceImportConfirmResultDto | null>(null);
    const [showPrintPrompt, setShowPrintPrompt] = useState(false);
    // null = closed.
    const [qrPrintDeviceIds, setQrPrintDeviceIds] = useState<number[] | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const isBusy = isPreviewing || isConfirming;

    const resetState = () => {
        setFile(null);
        setRows([]);
        setSummary(null);
        setResult(null);
        setShowPrintPrompt(false);
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
            toast.error("Vui lòng chọn file trước.");
            return;
        }
        setIsPreviewing(true);
        try {
            const previewResult = await DeviceImportApi.previewImport(file);
            setRows(previewResult.rows);
            setSummary({ totalRows: previewResult.totalRows, validRows: previewResult.validRows, invalidRows: previewResult.invalidRows });
            if (previewResult.invalidRows > 0) {
                toast.warn(`Có ${previewResult.invalidRows} dòng lỗi — các dòng này sẽ bị bỏ qua khi xác nhận import.`);
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
        if (rows.length === 0) return;
        setIsConfirming(true);
        try {
            const rawRows = rows.map((row) => ({
                rowNumber: row.rowNumber,
                deviceCode: row.deviceCode,
                branchCode: row.branchCode,
                deviceTypeCode: row.deviceTypeCode,
                supplierCode: row.supplierCode,
                purchaseDate: row.purchaseDate,
                note: row.note,
                serialNumber: row.serialNumber,
                maker: row.maker,
                model: row.model,
                cpu: row.cpu,
                ram: row.ram,
                hardDrive: row.hardDrive,
                oldDeviceCode: row.oldDeviceCode,
            }));
            const confirmResult = await DeviceImportApi.confirmImport(rawRows);
            setResult(confirmResult);
            toast.success(
                `Đã tạo ${confirmResult.createdCount}, cập nhật ${confirmResult.updatedCount} thiết bị` +
                    (confirmResult.skippedCount > 0 ? `, bỏ qua ${confirmResult.skippedCount} dòng lỗi.` : ".")
            );
            if (confirmResult.createdCount > 0) {
                setShowPrintPrompt(true);
            }
        } catch (err) {
            toast.error(getApiErrorMessage(err, "Xác nhận import thất bại."));
        } finally {
            setIsConfirming(false);
        }
    };

    const canConfirm = summary !== null && rows.length > 0 && result === null;

    // Processed = preview rows minus rows skipped at Confirm, split by isUpdate (duplicate code on an unused device updates it).
    const processedRows = result
        ? rows.filter((row) => !result.skippedRows.some((skipped) => skipped.rowNumber === row.rowNumber))
        : [];
    const createdRows = processedRows.filter((row) => !row.isUpdate);
    const updatedRows = processedRows.filter((row) => row.isUpdate);
    // Preview rows carry no deviceId, so this assumes createdDeviceIds follows the order of created rows;
    // "print all" and the post-import prompt use result.createdDeviceIds directly.
    const createdRowDeviceIds = result ? createdRows.map((_, index) => result.createdDeviceIds[index]) : [];

    return (
        <>
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={handleClose} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="import-device-title"
                className="z-60 mx-4 flex max-h-[85vh] w-full max-w-5xl flex-col rounded-xl border border-[#e0e3e5] bg-white shadow-xl"
            >
                <div className="flex items-center justify-between border-b border-[#e0e3e5] p-6 pb-4">
                    <div>
                        <h3 id="import-device-title" className="text-lg font-semibold text-[#191c1e]">
                            Nhập thiết bị từ Excel
                        </h3>
                        <p className="mt-1 text-xs text-[#5e3f3a]">
                            Chọn file theo mẫu công ty, xem trước để kiểm tra lỗi trước khi xác nhận import. MQL đã
                            tồn tại và đang &quot;Chờ sử dụng&quot; sẽ được cập nhật thay vì báo lỗi trùng.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isBusy}
                        className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e] disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Đóng"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {result ? (
                    <div className="flex-1 overflow-auto p-6">
                        <div className="mb-4 flex flex-wrap items-center gap-4 rounded-lg border border-[#e0e3e5] bg-[#f8fafc] px-4 py-3 text-sm">
                            <span className="font-semibold text-[#16a34a]">Đã tạo {result.createdCount} thiết bị</span>
                            <span className="font-semibold text-[#2563eb]">Đã cập nhật {result.updatedCount} thiết bị</span>
                            <span className="text-[#5e3f3a]">
                                Cấu hình: tạo mới {result.createdConfigCount} / cập nhật {result.updatedConfigCount}
                            </span>
                            <span className={result.skippedCount > 0 ? "font-semibold text-[#930006]" : "text-[#5e3f3a]"}>
                                Bỏ qua (lỗi): {result.skippedCount}
                            </span>
                        </div>

                        {result.skippedRows.length > 0 && (
                            <div className="mb-6">
                                <h4 className="mb-2 text-sm font-semibold text-[#930006]">Dòng bị bỏ qua</h4>
                                <table className="min-w-full border-collapse text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-[#e0e3e5] bg-[#fff4f2] font-semibold uppercase tracking-[0.1em] text-[#930006]">
                                            <th className="whitespace-nowrap px-3 py-2">Dòng</th>
                                            <th className="whitespace-nowrap px-3 py-2">MQL</th>
                                            <th className="px-3 py-2">Lỗi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {result.skippedRows.map((row) => (
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

                        {createdRows.length > 0 && (
                            <div className="mb-6">
                                <div className="mb-2 flex items-center justify-between gap-3">
                                    <h4 className="text-sm font-semibold text-[#191c1e]">Thiết bị đã tạo</h4>
                                    <button
                                        type="button"
                                        onClick={() => setQrPrintDeviceIds(result?.createdDeviceIds ?? [])}
                                        className="cursor-pointer rounded-md border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                                    >
                                         In tất cả nhãn
                                    </button>
                                </div>
                                <table className="min-w-full border-collapse text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] font-semibold uppercase tracking-[0.1em] text-[#5e3f3a]">
                                            <th className="whitespace-nowrap px-3 py-2">MQL</th>
                                            <th className="whitespace-nowrap px-3 py-2">Serial</th>
                                            <th className="whitespace-nowrap px-3 py-2 text-right">Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {createdRows.map((row, index) => (
                                            <tr key={row.rowNumber} className="border-b border-[#f1f5f9]">
                                                <td className="whitespace-nowrap px-3 py-2 text-[#191c1e]">{row.deviceCode}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">{row.serialNumber ?? "-"}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => setQrPrintDeviceIds([createdRowDeviceIds[index]])}
                                                        className="cursor-pointer font-semibold text-[#e3000f] transition hover:text-[#b40009]"
                                                    >
                                                        In nhãn
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {updatedRows.length > 0 && (
                            <div className="mb-6">
                                <h4 className="mb-2 text-sm font-semibold text-[#191c1e]">
                                    Thiết bị đã cập nhật (MQL đã tồn tại, đang &quot;Chờ sử dụng&quot;)
                                </h4>
                                <table className="min-w-full border-collapse text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] font-semibold uppercase tracking-[0.1em] text-[#5e3f3a]">
                                            <th className="whitespace-nowrap px-3 py-2">MQL</th>
                                            <th className="whitespace-nowrap px-3 py-2">Mã Xưởng</th>
                                            <th className="whitespace-nowrap px-3 py-2">Mã Loại TB</th>
                                            <th className="whitespace-nowrap px-3 py-2">Mã NCC</th>
                                            <th className="whitespace-nowrap px-3 py-2">Ngày mua</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {updatedRows.map((row) => (
                                            <tr key={row.rowNumber} className="border-b border-[#f1f5f9]">
                                                <td className="whitespace-nowrap px-3 py-2 text-[#191c1e]">{row.deviceCode}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">{row.branchCode}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">{row.deviceTypeCode}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">{row.supplierCode}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">{formatDate(row.purchaseDate)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {result.pendingTransfers.length > 0 && (
                            <div>
                                <h4 className="mb-2 text-sm font-semibold text-[#191c1e]">
                                    Gợi ý chuyển máy (từ cột &quot;MQL Cũ&quot;) — chưa thực hiện, bấm &quot;Chuyển máy&quot; để xác nhận
                                </h4>
                                <table className="min-w-full border-collapse text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] font-semibold uppercase tracking-[0.1em] text-[#5e3f3a]">
                                            <th className="whitespace-nowrap px-3 py-2">Máy cũ</th>
                                            <th className="whitespace-nowrap px-3 py-2">Máy mới</th>
                                            <th className="whitespace-nowrap px-3 py-2 text-right">Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {result.pendingTransfers.map((transfer) => (
                                            <tr key={transfer.newDeviceId} className="border-b border-[#f1f5f9]">
                                                <td className="whitespace-nowrap px-3 py-2 text-[#191c1e]">{transfer.oldDeviceCode}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#191c1e]">{transfer.newDeviceCode}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            onRequestTransfer?.({
                                                                oldDeviceId: transfer.oldDeviceId,
                                                                oldDeviceCode: transfer.oldDeviceCode,
                                                                newDeviceId: transfer.newDeviceId,
                                                            })
                                                        }
                                                        className="cursor-pointer font-semibold text-[#e3000f] transition hover:text-[#b40009]"
                                                    >
                                                        Chuyển máy
                                                    </button>
                                                </td>
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
                                href="/assets/file-samples/ImportDeviceSample.xlsx"
                                download="ImportDeviceSample.xlsx"
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
                                <span className="text-[#2563eb]">
                                    Sẽ cập nhật: {rows.filter((row) => row.isUpdate).length} (MQL đã tồn tại, &quot;Chờ sử dụng&quot;)
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
                                            <th className="whitespace-nowrap px-3 py-2">Loại dòng</th>
                                            <th className="whitespace-nowrap px-3 py-2">MQL</th>
                                            <th className="whitespace-nowrap px-3 py-2">Mã Xưởng</th>
                                            <th className="whitespace-nowrap px-3 py-2">Mã Loại TB</th>
                                            <th className="whitespace-nowrap px-3 py-2">Mã NCC</th>
                                            <th className="whitespace-nowrap px-3 py-2">Ngày mua</th>
                                            <th className="whitespace-nowrap px-3 py-2">Serial</th>
                                            <th className="whitespace-nowrap px-3 py-2">Hãng</th>
                                            <th className="whitespace-nowrap px-3 py-2">Model</th>
                                            <th className="whitespace-nowrap px-3 py-2">CPU</th>
                                            <th className="whitespace-nowrap px-3 py-2">RAM</th>
                                            <th className="whitespace-nowrap px-3 py-2">Ổ cứng</th>
                                            <th className="whitespace-nowrap px-3 py-2">MQL cũ</th>
                                            <th className="whitespace-nowrap px-3 py-2">Ghi chú</th>
                                            <th className="min-w-[220px] px-3 py-2">Lỗi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row) => (
                                            <tr
                                                key={row.rowNumber}
                                                className={`border-b border-[#f1f5f9] ${row.isValid ? "" : "bg-[#fff4f2]"}`}
                                            >
                                                <td className="whitespace-nowrap px-3 py-2 font-semibold text-[#191c1e]">{row.rowNumber}</td>
                                                <td className="whitespace-nowrap px-3 py-2">
                                                    <span
                                                        className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                                                            row.isUpdate ? "bg-[#dbeafe] text-[#2563eb]" : "bg-[#dcfce7] text-[#16a34a]"
                                                        }`}
                                                    >
                                                        {row.isUpdate ? "Cập nhật" : "Tạo mới"}
                                                    </span>
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#191c1e]">{row.deviceCode}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">{row.branchCode}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">{row.deviceTypeCode}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">{row.supplierCode}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">{formatDate(row.purchaseDate)}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">{row.serialNumber ?? "-"}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">{row.maker ?? "-"}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">{row.model ?? "-"}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">{row.cpu ?? "-"}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">{row.ram ?? "-"}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">{row.hardDrive ?? "-"}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">{row.oldDeviceCode ?? "-"}</td>
                                                <td className="max-w-[200px] truncate px-3 py-2 text-[#5e3f3a]" title={row.note ?? undefined}>
                                                    {row.note ?? "-"}
                                                </td>
                                                <td className="px-3 py-2 text-[#930006]">
                                                    {row.isValid ? "-" : row.errors.join("; ")}
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
                            {isConfirming ? "Đang import..." : "Xác nhận import"}
                        </button>
                    )}
                </div>
            </div>
        </div>

        <ConfirmDialog
            isOpen={showPrintPrompt}
            title="In mã thiết bị"
            message={`Đã import thành công ${result?.createdCount ?? 0} thiết bị. Bạn có muốn in mã thiết bị vừa import không?`}
            approveLabel="In mã"
            deniedLabel="Để sau"
            onApprove={() => {
                setQrPrintDeviceIds(result?.createdDeviceIds ?? []);
                setShowPrintPrompt(false);
            }}
            onDenied={() => setShowPrintPrompt(false)}
        />

        <PrintDeviceQrLabelsDialog
            isOpen={qrPrintDeviceIds !== null}
            deviceIds={qrPrintDeviceIds ?? []}
            onClose={() => setQrPrintDeviceIds(null)}
        />
        </>
    );
}
