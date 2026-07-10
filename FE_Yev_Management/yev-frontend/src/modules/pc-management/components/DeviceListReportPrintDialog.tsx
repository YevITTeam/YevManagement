"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { ROBOTO_REGULAR_BASE64, ROBOTO_BOLD_BASE64 } from "@/modules/pc-management/lib/pdf-fonts";
import { ReportApi } from "@/modules/pc-management/api/report.api";
import type { DeviceListReportItemDto } from "@/modules/pc-management/types/report.dto";
import { BranchApi } from "@/modules/pc-management/api/branch.api";
import type { BranchDto } from "@/modules/pc-management/types/branch.dto";
import { DeviceTypeApi } from "@/modules/pc-management/api/device-type.api";
import type { DeviceTypeDto } from "@/modules/pc-management/types/device-type.dto";
import { getApiErrorMessage } from "@/lib/apiError";

interface DeviceListReportPrintDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

function formatDate(value: string | null) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("vi-VN");
}

// Font mặc định của jsPDF (Helvetica) không có dấu tiếng Việt — phải nhúng font Roboto
// (hỗ trợ Unicode Latin Extended/Vietnamese) qua VFS thì chữ có dấu mới hiển thị đúng trong PDF.
function registerVietnameseFont(doc: jsPDF) {
    doc.addFileToVFS("Roboto-Regular.ttf", ROBOTO_REGULAR_BASE64);
    doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
    doc.addFileToVFS("Roboto-Bold.ttf", ROBOTO_BOLD_BASE64);
    doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
    doc.setFont("Roboto", "normal");
}

function buildReportPdf(title: string, rows: DeviceListReportItemDto[]) {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    registerVietnameseFont(doc);

    doc.setFont("Roboto", "bold");
    doc.setFontSize(14);
    doc.text(title, doc.internal.pageSize.getWidth() / 2, 14, { align: "center" });
    doc.setFont("Roboto", "normal");
    doc.setFontSize(9);
    doc.text(
        `Ngày in: ${new Date().toLocaleDateString("vi-VN")} — Tổng số: ${rows.length} thiết bị`,
        doc.internal.pageSize.getWidth() / 2,
        20,
        { align: "center" }
    );

    autoTable(doc, {
        startY: 26,
        styles: { font: "Roboto", fontStyle: "normal", fontSize: 8, cellPadding: 1.5 },
        headStyles: { font: "Roboto", fontStyle: "bold", fillColor: [227, 0, 15] },
        head: [["STT", "Mã thiết bị", "Tên thiết bị", "Địa chỉ IP", "Ngày mua", "Hạn sử dụng", "Hết hạn", "Kỳ T/C", "Ghi chú"]],
        body: rows.map((row) => [
            row.stt,
            row.deviceCode,
            row.deviceName,
            row.ipAddress ?? "-",
            formatDate(row.purchaseDate),
            formatDate(row.expirationDate),
            row.isExpired ? "X" : "O",
            row.financialPeriod ?? "-",
            row.note ?? "-",
        ]),
    });

    return doc;
}

export default function DeviceListReportPrintDialog({ isOpen, onClose }: DeviceListReportPrintDialogProps) {
    const [branches, setBranches] = useState<BranchDto[]>([]);
    const [deviceTypes, setDeviceTypes] = useState<DeviceTypeDto[]>([]);
    const [branchId, setBranchId] = useState<string>("");
    const [deviceTypeId, setDeviceTypeId] = useState<string>("");
    const [keyword, setKeyword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [rows, setRows] = useState<DeviceListReportItemDto[] | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setBranchId("");
        setDeviceTypeId("");
        setKeyword("");
        setRows(null);

        BranchApi.getAllBranches()
            .then(setBranches)
            .catch((err) => console.error(err));
        DeviceTypeApi.getAllDeviceTypes()
            .then(setDeviceTypes)
            .catch((err) => console.error(err));
    }, [isOpen]);

    const title = useMemo(() => {
        const deviceTypeName = deviceTypes.find((type) => String(type.id) === deviceTypeId)?.typeName;
        const branchName = branches.find((branch) => String(branch.id) === branchId)?.branchName;
        const scope = deviceTypeName ? `DANH SÁCH ${deviceTypeName.toUpperCase()}` : "DANH SÁCH THIẾT BỊ";
        return branchName ? `${scope} TẠI ${branchName.toUpperCase()}` : `${scope} TOÀN CÔNG TY`;
    }, [deviceTypes, branches, deviceTypeId, branchId]);

    if (!isOpen) return null;

    const fetchReport = async () => {
        setIsLoading(true);
        try {
            const result = await ReportApi.getDeviceListReport({
                deviceTypeId: deviceTypeId ? Number(deviceTypeId) : undefined,
                branchId: branchId ? Number(branchId) : undefined,
                keyword: keyword || undefined,
            });
            setRows(result);
        } catch (err) {
            toast.error(getApiErrorMessage(err, "Không thể tải dữ liệu báo cáo."));
        } finally {
            setIsLoading(false);
        }
    };

    const handleExportPdf = () => {
        if (!rows || rows.length === 0) {
            toast.error("Không có dữ liệu để xuất báo cáo.");
            return;
        }

        try {
            const doc = buildReportPdf(title, rows);
            doc.save(`${title.replace(/\s+/g, "-")}.pdf`);
            toast.success(`Xuất PDF thành công ${rows.length} thiết bị.`);
        } catch (err) {
            console.error("Export PDF failed:", err);
            toast.error("Xuất file PDF thất bại. Vui lòng thử lại.");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={onClose} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="print-report-title"
                className="z-60 mx-4 flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl border border-[#e0e3e5] bg-white shadow-xl"
            >
                <div className="flex items-center justify-between border-b border-[#e0e3e5] p-6 pb-4">
                    <div>
                        <h3 id="print-report-title" className="text-lg font-semibold text-[#191c1e]">
                            Xuất báo cáo danh sách thiết bị
                        </h3>
                        <p className="mt-1 text-xs text-[#5e3f3a]">Lọc phạm vi rồi xuất báo cáo ra file PDF.</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                        aria-label="Đóng"
                    >
                        ✕
                    </button>
                </div>

                <div className="space-y-3 border-b border-[#e0e3e5] p-4">
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                            Loại thiết bị
                        </span>
                        <select
                            value={deviceTypeId}
                            onChange={(event) => setDeviceTypeId(event.target.value)}
                            className="h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                        >
                            <option value="">Tất cả loại</option>
                            {deviceTypes.map((deviceType) => (
                                <option key={deviceType.id} value={deviceType.id}>
                                    {deviceType.typeName}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                            Chi nhánh
                        </span>
                        <select
                            value={branchId}
                            onChange={(event) => setBranchId(event.target.value)}
                            className="h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                        >
                            <option value="">Toàn công ty</option>
                            {branches.map((branch) => (
                                <option key={branch.id} value={branch.id}>
                                    {branch.branchName}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                            Từ khoá (mã/tên thiết bị)
                        </span>
                        <input
                            value={keyword}
                            onChange={(event) => setKeyword(event.target.value)}
                            placeholder="Nhập mã hoặc tên thiết bị..."
                            className="h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                        />
                    </label>

                    <button
                        type="button"
                        onClick={fetchReport}
                        disabled={isLoading}
                        className="cursor-pointer w-full rounded-lg border border-[#e0e3e5] bg-white px-3 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isLoading ? "Đang tải..." : "Xem số lượng dữ liệu"}
                    </button>
                </div>

                {rows !== null && (
                    <div className="border-b border-[#e0e3e5] px-4 py-3 text-sm text-[#5e3f3a]">
                        Tìm thấy <strong className="text-[#191c1e]">{rows.length}</strong> thiết bị khớp điều kiện lọc.
                    </div>
                )}

                <div className="flex justify-end gap-3 p-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                    >
                        Đóng
                    </button>
                    <button
                        type="button"
                        onClick={handleExportPdf}
                        disabled={!rows || rows.length === 0}
                        className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        ⬇ Xuất PDF
                    </button>
                </div>
            </div>
        </div>
    );
}
