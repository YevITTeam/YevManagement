"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, FileSpreadsheet, X } from "lucide-react";
import { toast } from "react-toastify";

import { DeviceConfigurationImportApi } from "@/modules/pc-management/api/device-configuration-import.api";
import { DeviceTypeApi } from "@/modules/pc-management/api/device-type.api";
import type { DeviceTypeDto } from "@/modules/pc-management/types/device-type.dto";
import {
    DomainAccountState,
    type DeviceConfigurationImportConfirmResultDto,
    DeviceConfigurationImportPreviewRowDto,
    DeviceMissingInTaniumDto,
} from "@/modules/pc-management/types/device-configuration-import.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

interface ImportDeviceConfigurationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onImported: () => void;
}

// Dòng bị bỏ qua vì còn lỗi validate ở bước preview — bỏ hẳn khỏi request Confirm
// (không gửi lên server) để tránh bị BE từ chối cả batch, xem device-configuration-import.dto.ts.
interface LocalSkippedRow {
    rowNumber: number;
    computerName: string;
    errors: string[];
}

export default function ImportDeviceConfigurationDialog({
    isOpen,
    onClose,
    onImported,
}: ImportDeviceConfigurationDialogProps) {
    const [file, setFile] = useState<File | null>(null);
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const [isCheckingMissing, setIsCheckingMissing] = useState(false);
    const [isExportingReport, setIsExportingReport] = useState(false);
    // Báo cáo đối chiếu đang hiện trên màn hình (thay bảng "Xem trước" cho tới khi đóng / xem trước lại).
    const [missingDevices, setMissingDevices] = useState<DeviceMissingInTaniumDto[] | null>(null);
    const [missingPrefixes, setMissingPrefixes] = useState<string[]>([]);
    const [rows, setRows] = useState<DeviceConfigurationImportPreviewRowDto[]>([]);
    const [summary, setSummary] = useState<{
        totalRows: number;
        validRows: number;
        invalidRows: number;
        outOfScopeSkippedCount: number;
    } | null>(null);
    const [result, setResult] = useState<DeviceConfigurationImportConfirmResultDto | null>(null);
    const [localSkippedRows, setLocalSkippedRows] = useState<LocalSkippedRow[]>([]);
    const [createMissingUsers, setCreateMissingUsers] = useState(true);
    // Tiền tố mã máy đối chiếu báo cáo — người dùng có thể sửa tự do, mặc định đủ 4 họ mã chuẩn
    // (YDC/YLC/YDF/TYC, xem StandardFamilyPrefixes bên BE), không giới hạn phải nhập đúng 4 mã này.
    // YDF không có trong bảng LoaiThietBi (nó là 1 họ mã con của YDC/Desktop) nên không xuất hiện
    // trong danh sách Loại thiết bị chọn nhanh bên dưới — vẫn giữ mặc định trong ô nhập.
    const [prefixesInput, setPrefixesInput] = useState("YDC, YLC, YDF, TYC");
    const [deviceTypes, setDeviceTypes] = useState<DeviceTypeDto[]>([]);
    const [isTypePickerOpen, setIsTypePickerOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const typePickerRef = useRef<HTMLDivElement>(null);

    // Danh sách Loại thiết bị chỉ dùng để điền nhanh vào ô tiền tố — nạp 1 lần, không phụ thuộc isOpen.
    useFetchEffect(
        () => DeviceTypeApi.getAllDeviceTypes(),
        [],
        (data) => setDeviceTypes(data),
        "Không thể tải danh sách loại thiết bị.",
        undefined,
        "device-types-all"
    );

    useEffect(() => {
        if (!isTypePickerOpen) return;
        const handlePointerDown = (event: MouseEvent) => {
            if (typePickerRef.current?.contains(event.target as Node)) return;
            setIsTypePickerOpen(false);
        };
        document.addEventListener("mousedown", handlePointerDown);
        return () => document.removeEventListener("mousedown", handlePointerDown);
    }, [isTypePickerOpen]);

    if (!isOpen) return null;

    const currentPrefixes = prefixesInput
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

    const toggleTypeCode = (typeCode: string) => {
        const exists = currentPrefixes.some((p) => p.toUpperCase() === typeCode.toUpperCase());
        const next = exists
            ? currentPrefixes.filter((p) => p.toUpperCase() !== typeCode.toUpperCase())
            : [...currentPrefixes, typeCode];
        setPrefixesInput(next.join(", "));
    };

    const isBusy = isPreviewing || isConfirming || isCheckingMissing || isExportingReport;

    const resetState = () => {
        setFile(null);
        setRows([]);
        setSummary(null);
        setResult(null);
        setLocalSkippedRows([]);
        setMissingDevices(null);
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
        setMissingDevices(null);
    };

    const handlePreview = async () => {
        if (!file) {
            toast.error("Vui lòng chọn file Tanium trước.");
            return;
        }
        setIsPreviewing(true);
        setMissingDevices(null);
        try {
            const previewResult = await DeviceConfigurationImportApi.previewImport(file);
            setRows(previewResult.rows);
            setSummary({
                totalRows: previewResult.totalRows,
                validRows: previewResult.validRows,
                invalidRows: previewResult.invalidRows,
                outOfScopeSkippedCount: previewResult.outOfScopeSkippedCount,
            });
            if (previewResult.invalidRows > 0) {
                toast.warn(`Có ${previewResult.invalidRows} dòng lỗi — các dòng này sẽ tự bị bỏ qua khi xác nhận đồng bộ.`);
            } else {
                toast.success(`Đã xem trước ${previewResult.totalRows} dòng, tất cả hợp lệ.`);
            }
        } catch (err) {
            toast.error(getApiErrorMessage(err, "Xem trước file Tanium thất bại."));
        } finally {
            setIsPreviewing(false);
        }
    };

    // Đối chiếu độc lập với "Xem trước" — BE tự đọc lại đúng file này, không cần đã bấm Xem trước.
    // Chỉ so Device đang "Đang sử dụng" (Tanium chỉ quét được máy đang bật/đang dùng thật sự).
    const handleCheckMissingDevices = async () => {
        if (!file) {
            toast.error("Vui lòng chọn file Tanium trước.");
            return;
        }
        setIsCheckingMissing(true);
        try {
            const items = await DeviceConfigurationImportApi.getMissingDevices(file, currentPrefixes);
            setMissingDevices(items);
            setMissingPrefixes(currentPrefixes);
        } catch (err) {
            toast.error(getApiErrorMessage(err, "Xuất báo cáo đối chiếu thất bại."));
        } finally {
            setIsCheckingMissing(false);
        }
    };

    // Tải đúng báo cáo đang hiện dưới dạng Excel (dùng lại file + tiền tố đã đối chiếu).
    const handleDownloadMissingDevicesReport = async () => {
        if (!file) return;
        setIsExportingReport(true);
        try {
            const { blob, fileName } = await DeviceConfigurationImportApi.exportMissingDevicesReport(file, missingPrefixes);

            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName;
            link.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            toast.error(getApiErrorMessage(err, "Tải báo cáo Excel thất bại."));
        } finally {
            setIsExportingReport(false);
        }
    };

    const handleConfirm = async () => {
        const validRows = rows.filter((row) => row.isValid);
        if (validRows.length === 0) {
            toast.error("Không có dòng hợp lệ nào để đồng bộ.");
            return;
        }
        setIsConfirming(true);
        try {
            const rawRows = validRows.map((row) => ({
                computerName: row.computerName,
                taniumIpAddress: row.taniumIpAddress,
                lastLoggedInUser: row.lastLoggedInUser,
                userEmail: row.userEmail,
                manufacturer: row.manufacturer,
                model: row.model,
                serialNumber: row.serialNumber,
                cpu: row.cpu,
                ram: row.ram,
                size: row.size,
            }));
            const confirmResult = await DeviceConfigurationImportApi.confirmImport(rawRows, createMissingUsers);
            setResult(confirmResult);
            setLocalSkippedRows(
                rows
                    .filter((row) => !row.isValid)
                    .map((row) => ({ rowNumber: row.rowNumber, computerName: row.computerName, errors: row.errors }))
            );
            toast.success(
                `Đồng bộ thành công — tạo mới ${confirmResult.createdConfigCount} cấu hình, ` +
                    `cập nhật ${confirmResult.updatedConfigCount} cấu hình, ghi Serial cho ${confirmResult.serialUpdatedCount} thiết bị, ` +
                    `cập nhật tài khoản domain cho ${confirmResult.managerAccountUpdatedCount} thiết bị, thêm ${confirmResult.emailAddedCount} email` +
                    (confirmResult.ipReassignedCount > 0 ? `, gán IP cho ${confirmResult.ipReassignedCount} thiết bị.` : ".")
            );
            if (confirmResult.usersUnavailableCount > 0 || confirmResult.usersFailedCount > 0) {
                toast.warn(
                    `Chưa tạo được user cho ${confirmResult.usersUnavailableCount + confirmResult.usersFailedCount} tài khoản ` +
                        "(không kết nối được AD hoặc tạo lỗi) — đồng bộ lại sau để tạo bù."
                );
            }
        } catch (err) {
            toast.error(getApiErrorMessage(err, "Xác nhận đồng bộ thất bại."));
        } finally {
            setIsConfirming(false);
        }
    };

    const willCreateCount = new Set(
        rows
            .filter((row) => row.isValid && row.accountState === DomainAccountState.WillCreate)
            .map((row) => row.resolvedManagerDomainAccount?.toLowerCase())
    ).size;

    const renderAccountBadge = (state: number | null) => {
        switch (state) {
            case DomainAccountState.ExistsInIdentity:
                return <span className="text-[#16a34a]">Đã có trên Identity</span>;
            case DomainAccountState.WillCreate:
                return <span className="font-semibold text-[#e3000f]">Sẽ tạo user mới</span>;
            case DomainAccountState.Disabled:
                return <span className="text-[#b45309]">Bị vô hiệu hoá trong AD</span>;
            case DomainAccountState.NotInDirectory:
                return <span className="text-[#b45309]">Không có trong AD</span>;
            case DomainAccountState.DirectoryUnavailable:
                return <span className="text-[#b45309]">Không kiểm tra được AD</span>;
            default:
                return null;
        }
    };

    const canConfirm = summary !== null && rows.some((row) => row.isValid) && result === null;

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
                            <span className="font-semibold text-[#16a34a]">Tạo mới {result.createdConfigCount} cấu hình</span>
                            <span className="text-[#5e3f3a]">Cập nhật: {result.updatedConfigCount}</span>
                            <span className="text-[#5e3f3a]">Gán IP: {result.ipReassignedCount}</span>
                            <span className="text-[#5e3f3a]">Ghi Serial: {result.serialUpdatedCount}</span>
                            <span className="text-[#5e3f3a]">Tài khoản domain: {result.managerAccountUpdatedCount}</span>
                            <span className="text-[#5e3f3a]">Email thêm mới: {result.emailAddedCount}</span>
                            <span className="text-[#5e3f3a]">
                                User Identity: tạo {result.usersCreatedCount}
                                {result.usersSkippedCount > 0 ? `, bỏ qua ${result.usersSkippedCount}` : ""}
                                {result.usersUnavailableCount + result.usersFailedCount > 0
                                    ? `, chưa tạo được ${result.usersUnavailableCount + result.usersFailedCount}`
                                    : ""}
                            </span>
                            <span className={localSkippedRows.length > 0 ? "font-semibold text-[#930006]" : "text-[#5e3f3a]"}>
                                Bỏ qua (lỗi): {localSkippedRows.length}
                            </span>
                        </div>

                        {localSkippedRows.length > 0 && (
                            <div>
                                <h4 className="mb-2 text-sm font-semibold text-[#930006]">
                                    Dòng bị bỏ qua (chưa gửi lên server — sửa lại file rồi đồng bộ bù sau)
                                </h4>
                                <table className="min-w-full border-collapse text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-[#e0e3e5] bg-[#fff4f2] font-semibold uppercase tracking-[0.1em] text-[#930006]">
                                            <th className="whitespace-nowrap px-3 py-2">Dòng</th>
                                            <th className="whitespace-nowrap px-3 py-2">Computer Name</th>
                                            <th className="px-3 py-2">Lỗi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {localSkippedRows.map((row) => (
                                            <tr key={row.rowNumber} className="border-b border-[#f1f5f9]">
                                                <td className="whitespace-nowrap px-3 py-2 font-semibold text-[#191c1e]">{row.rowNumber}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#191c1e]">{row.computerName}</td>
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
                                href="/assets/file-samples/Computer_Name.xlsx"
                                download="Computer_Name.xlsx"
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
                            <label className="flex items-center gap-1.5 text-xs text-[#5e3f3a]">
                                Tiền tố mã máy:
                                <input
                                    type="text"
                                    value={prefixesInput}
                                    onChange={(e) => setPrefixesInput(e.target.value)}
                                    disabled={isBusy}
                                    placeholder="VD: YDC, YLC, YDF, TYC"
                                    title="Chỉ đối chiếu thiết bị có mã bắt đầu bằng 1 trong các tiền tố này (cách nhau bằng dấu phẩy) — để trống nếu muốn đối chiếu tất cả."
                                    className="w-40 rounded-lg border border-[#e0e3e5] px-2 py-1.5 text-xs text-[#191c1e] disabled:cursor-not-allowed disabled:opacity-50"
                                />
                            </label>

                            <div ref={typePickerRef} className="relative">
                                <button
                                    type="button"
                                    onClick={() => setIsTypePickerOpen((current) => !current)}
                                    disabled={isBusy}
                                    title="Chọn nhanh tiền tố theo Loại thiết bị có sẵn trong hệ thống"
                                    className="flex cursor-pointer items-center gap-1 rounded-lg border border-[#e0e3e5] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Loại thiết bị
                                    <ChevronDown className="h-3.5 w-3.5" />
                                </button>
                                {isTypePickerOpen && (
                                    <div className="absolute left-0 top-full z-10 mt-1 max-h-64 w-56 overflow-y-auto rounded-lg border border-[#e0e3e5] bg-white p-1.5 shadow-lg">
                                        {deviceTypes.length === 0 ? (
                                            <div className="px-2 py-2 text-xs text-[#5e3f3a]">Không có loại thiết bị nào.</div>
                                        ) : (
                                            deviceTypes.map((dt) => {
                                                const checked = currentPrefixes.some(
                                                    (p) => p.toUpperCase() === dt.typeCode.toUpperCase()
                                                );
                                                return (
                                                    <label
                                                        key={dt.id}
                                                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-[#191c1e] hover:bg-[#f8fafc]"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => toggleTypeCode(dt.typeCode)}
                                                            className="h-3.5 w-3.5 cursor-pointer accent-[#e3000f]"
                                                        />
                                                        <span className="font-semibold">{dt.typeCode}</span>
                                                        <span className="truncate text-[#5e3f3a]">{dt.typeName}</span>
                                                    </label>
                                                );
                                            })
                                        )}
                                    </div>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={handleCheckMissingDevices}
                                disabled={!file || isBusy}
                                title='Liệt kê thiết bị đang "Đang sử dụng" trong hệ thống nhưng không có trong file Tanium (giới hạn theo tiền tố mã máy), có thể tải Excel — không cần bấm "Xem trước" trước'
                                className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <FileSpreadsheet className="h-3.5 w-3.5" />
                                {isCheckingMissing ? "Đang đối chiếu..." : "Xuất báo cáo đối chiếu"}
                            </button>
                        </div>

                        {missingDevices !== null ? (
                            <>
                                <div className="flex flex-wrap items-center gap-4 border-b border-[#e0e3e5] bg-[#f8fafc] px-4 py-3 text-xs font-semibold">
                                    <span className={missingDevices.length > 0 ? "text-[#b45309]" : "text-[#16a34a]"}>
                                        Thiếu trong Tanium: {missingDevices.length} thiết bị
                                    </span>
                                    <span className="text-[#5e3f3a]">
                                        Thiết bị &quot;Đang sử dụng&quot; không có trong file
                                        {missingPrefixes.length > 0 ? ` — mã bắt đầu bằng ${missingPrefixes.join(", ")}` : ""}
                                    </span>
                                    <div className="ml-auto flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={handleDownloadMissingDevicesReport}
                                            disabled={isBusy || missingDevices.length === 0}
                                            title="Tải báo cáo này dưới dạng file Excel"
                                            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <FileSpreadsheet className="h-3.5 w-3.5" />
                                            {isExportingReport ? "Đang tải..." : "Tải Excel"}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setMissingDevices(null)}
                                            disabled={isBusy}
                                            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                            Đóng báo cáo
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-auto p-2">
                                    {missingDevices.length === 0 ? (
                                        <div className="px-4 py-12 text-center text-sm text-[#16a34a]">
                                            Không có thiết bị nào bị thiếu — mọi thiết bị &quot;Đang sử dụng&quot; đều có trong file Tanium.
                                        </div>
                                    ) : (
                                        <table className="min-w-full border-collapse text-left text-xs">
                                            <thead>
                                                <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] font-semibold uppercase tracking-[0.1em] text-[#5e3f3a]">
                                                    <th className="whitespace-nowrap px-3 py-2">STT</th>
                                                    <th className="whitespace-nowrap px-3 py-2">Mã máy</th>
                                                    <th className="whitespace-nowrap px-3 py-2">Tên máy</th>
                                                    <th className="whitespace-nowrap px-3 py-2">Số seri</th>
                                                    <th className="whitespace-nowrap px-3 py-2">Chi nhánh</th>
                                                    <th className="whitespace-nowrap px-3 py-2">Loại thiết bị</th>
                                                    <th className="whitespace-nowrap px-3 py-2">Nhóm / Bộ phận</th>
                                                    <th className="whitespace-nowrap px-3 py-2">Người quản lý</th>
                                                    <th className="whitespace-nowrap px-3 py-2">Địa chỉ IP</th>
                                                    <th className="min-w-[160px] px-3 py-2">Ghi chú</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {missingDevices.map((device, index) => (
                                                    <tr key={device.deviceCode} className="border-b border-[#f1f5f9]">
                                                        <td className="whitespace-nowrap px-3 py-2 font-semibold text-[#191c1e]">{index + 1}</td>
                                                        <td className="whitespace-nowrap px-3 py-2 font-semibold text-[#191c1e]">{device.deviceCode}</td>
                                                        <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">{device.deviceName}</td>
                                                        <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">{device.serialNumber ?? "-"}</td>
                                                        <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">{device.branchName}</td>
                                                        <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">{device.deviceTypeName}</td>
                                                        <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">
                                                            {[device.groupName, device.departmentName].filter(Boolean).join(" / ") || "-"}
                                                        </td>
                                                        <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">{device.manager || "-"}</td>
                                                        <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">{device.ipAddress ?? "-"}</td>
                                                        <td className="max-w-[240px] truncate px-3 py-2 text-[#5e3f3a]" title={device.note ?? undefined}>
                                                            {device.note ?? "-"}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
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
                                    <span className="text-[#930006]">— Các dòng lỗi sẽ tự bị bỏ qua khi xác nhận đồng bộ.</span>
                                )}
                                <label className="ml-auto flex cursor-pointer items-center gap-2 text-[#191c1e]">
                                    <input
                                        type="checkbox"
                                        checked={createMissingUsers}
                                        onChange={(e) => setCreateMissingUsers(e.target.checked)}
                                        disabled={isBusy}
                                        className="h-3.5 w-3.5 cursor-pointer accent-[#e3000f]"
                                    />
                                    Tạo user Identity (role Basic) cho tài khoản có trong AD
                                    {willCreateCount > 0 ? ` — ${willCreateCount} tài khoản` : ""}
                                </label>
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
                                            <th className="whitespace-nowrap px-3 py-2">Serial</th>
                                            <th className="whitespace-nowrap px-3 py-2">CPU</th>
                                            <th className="whitespace-nowrap px-3 py-2">RAM</th>
                                            <th className="whitespace-nowrap px-3 py-2">Ổ cứng</th>
                                            <th className="whitespace-nowrap px-3 py-2">IP Tanium</th>
                                            <th className="whitespace-nowrap px-3 py-2">Tài khoản / Email</th>
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
                                                <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">
                                                    {row.resolvedSerialNumber ? (
                                                        row.resolvedSerialNumber
                                                    ) : row.serialNumber ? (
                                                        <span className="text-[#b45309]" title="Sẽ không ghi Serial — xem cảnh báo">
                                                            {row.serialNumber} (bỏ qua)
                                                        </span>
                                                    ) : (
                                                        "-"
                                                    )}
                                                </td>
                                                <td className="max-w-[160px] truncate px-3 py-2 text-[#5e3f3a]" title={row.cpu ?? undefined}>
                                                    {row.cpu ?? "-"}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">{row.ram ?? "-"}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">{row.size ?? "-"}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">{row.taniumIpAddress ?? "-"}</td>
                                                <td className="whitespace-nowrap px-3 py-2 text-[#5e3f3a]">
                                                    {row.resolvedManagerDomainAccount ? (
                                                        <div>
                                                            {row.resolvedManagerDomainAccount}
                                                            <div className="text-[11px]">{renderAccountBadge(row.accountState)}</div>
                                                        </div>
                                                    ) : row.lastLoggedInUser ? (
                                                        <div className="text-[#8a8f94]" title="Tài khoản Local — không lưu">
                                                            {row.lastLoggedInUser}
                                                        </div>
                                                    ) : null}
                                                    {row.resolvedEmails.length > 0 ? (
                                                        row.resolvedEmails.map((email) => (
                                                            <div key={email} className="text-xs">
                                                                {email}
                                                            </div>
                                                        ))
                                                    ) : !row.lastLoggedInUser ? (
                                                        "-"
                                                    ) : null}
                                                </td>
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
                            </>
                        )}
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
                            {isConfirming ? "Đang đồng bộ..." : "Xác nhận đồng bộ"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
