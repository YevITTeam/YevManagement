"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, X } from "lucide-react";
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
import { DeviceDepartmentApi } from "@/modules/pc-management/api/device-department.api";
import type { DeviceDepartmentDto } from "@/modules/pc-management/types/device-department.dto";
import { DeviceGroupApi } from "@/modules/pc-management/api/device-group.api";
import type { DeviceGroupDto } from "@/modules/pc-management/types/device-group.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import { useDialogReset } from "@/modules/common/hooks/useDialogReset";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { StyledSelect } from "@/components/ui/StyledSelect";

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
        headStyles: { font: "Roboto", fontStyle: "bold", fillColor: [226, 232, 240], textColor: [30, 41, 59], lineWidth: 0.1, lineColor: [148, 163, 184] },
        bodyStyles: { lineWidth: 0.1, lineColor: [203, 213, 225] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
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
    const [departments, setDepartments] = useState<DeviceDepartmentDto[]>([]);
    const [groups, setGroups] = useState<DeviceGroupDto[]>([]);
    const [deviceTypeIds, setDeviceTypeIds] = useState<number[]>([]);
    const [branchId, setBranchId] = useState<string>("");
    const [departmentId, setDepartmentId] = useState<string>("");
    const [groupId, setGroupId] = useState<string>("");
    // "" = both statuses, "0" = Chưa sử dụng, "1" = Đang sử dụng.
    const [status, setStatus] = useState<string>("");
    const [isLoading, setIsLoading] = useState(false);
    const [rows, setRows] = useState<DeviceListReportItemDto[] | null>(null);
    // Filter key the cached rows were fetched with; rows are shown only while it still matches the form.
    const [rowsFilterKey, setRowsFilterKey] = useState("");

    const filterKey = JSON.stringify([deviceTypeIds, branchId, departmentId, groupId, status]);
    const visibleRows = rows !== null && rowsFilterKey === filterKey ? rows : null;

    useDialogReset(isOpen, null, () => {
        setDeviceTypeIds([]);
        setBranchId("");
        setDepartmentId("");
        setGroupId("");
        setStatus("");
        setRows(null);
    });

    useEffect(() => {
        if (!isOpen) return;
        BranchApi.getAllBranches()
            .then(setBranches)
            .catch((err) => console.error(err));
        DeviceTypeApi.getAllDeviceTypes()
            .then(setDeviceTypes)
            .catch((err) => console.error(err));
        DeviceDepartmentApi.getAllDeviceDepartments()
            .then(setDepartments)
            .catch((err) => console.error(err));
    }, [isOpen]);

    // Group list follows the selected department; with no department selected every group is listed.
    useEffect(() => {
        if (!isOpen) return;
        let isCancelled = false;
        DeviceGroupApi.getAllDeviceGroups(departmentId === "" ? undefined : Number(departmentId))
            .then((data) => {
                if (!isCancelled) setGroups(data);
            })
            .catch((err) => console.error(err));
        return () => {
            isCancelled = true;
        };
    }, [isOpen, departmentId]);

    const title = useMemo(() => {
        const selectedTypes = deviceTypes.filter((type) => deviceTypeIds.includes(type.id));
        const scope = selectedTypes.length === 1 ? `DANH SÁCH ${selectedTypes[0].typeName.toUpperCase()}` : "DANH SÁCH THIẾT BỊ";

        const location: string[] = [];
        const branchName = branches.find((branch) => String(branch.id) === branchId)?.branchName;
        const departmentName = departments.find((department) => String(department.id) === departmentId)?.departmentName;
        const groupName = groups.find((group) => String(group.id) === groupId)?.groupName;
        if (branchName) location.push(`TẠI ${branchName.toUpperCase()}`);
        if (departmentName) location.push(`BỘ PHẬN ${departmentName.toUpperCase()}`);
        if (groupName) location.push(`NHÓM ${groupName.toUpperCase()}`);

        return location.length > 0 ? `${scope} ${location.join(" - ")}` : `${scope} TOÀN CÔNG TY`;
    }, [deviceTypes, deviceTypeIds, branches, branchId, departments, departmentId, groups, groupId]);

    if (!isOpen) return null;

    const fetchReport = async () => {
        setIsLoading(true);
        try {
            const result = await ReportApi.getDeviceListReport({
                deviceTypeIds: deviceTypeIds.length > 0 ? deviceTypeIds : undefined,
                branchId: branchId ? Number(branchId) : undefined,
                departmentId: departmentId ? Number(departmentId) : undefined,
                groupId: groupId ? Number(groupId) : undefined,
                status: status === "" ? undefined : Number(status),
            });
            setRows(result);
            setRowsFilterKey(filterKey);
        } catch (err) {
            toast.error(getApiErrorMessage(err, "Không thể tải dữ liệu báo cáo."));
        } finally {
            setIsLoading(false);
        }
    };

    const handleExportPdf = () => {
        if (!visibleRows || visibleRows.length === 0) {
            toast.error("Không có dữ liệu để xuất báo cáo.");
            return;
        }

        try {
            const doc = buildReportPdf(title, visibleRows);
            doc.save(`${title.replace(/\s+/g, "-")}.pdf`);
            toast.success(`Xuất PDF thành công ${visibleRows.length} thiết bị.`);
        } catch (err) {
            console.error("Export PDF failed:", err);
            toast.error("Xuất file PDF thất bại. Vui lòng thử lại.");
        }
    };

    const labelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/40" onClick={onClose} />

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="print-report-title"
                className="z-60 mx-4 flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-[#e0e3e5] bg-white shadow-xl"
            >
                <div className="flex items-center justify-between border-b border-[#e0e3e5] px-6 py-4">
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
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="grid gap-x-4 gap-y-3 overflow-y-auto p-6 sm:grid-cols-2">
                    <div className="block sm:col-span-2">
                        <span className={labelClassName}>Loại thiết bị</span>
                        <MultiSelect
                            options={deviceTypes.map((dt) => ({ value: dt.id, label: dt.typeName, searchText: dt.typeName.toLowerCase() }))}
                            values={deviceTypeIds}
                            onChange={setDeviceTypeIds}
                            placeholder="Tất cả loại"
                        />
                    </div>

                    <label className="block">
                        <span className={labelClassName}>Chi nhánh</span>
                        <SearchableSelect
                            options={branches.map((b) => ({ value: b.id, label: b.branchName, searchText: b.branchName.toLowerCase() }))}
                            value={branchId === "" ? "" : Number(branchId)}
                            onChange={(v) => setBranchId(v === "" ? "" : String(v))}
                            placeholder="Toàn công ty"
                        />
                    </label>

                    <div className="block">
                        <span className={labelClassName}>Trạng thái thiết bị</span>
                        <StyledSelect
                            value={status}
                            onChange={setStatus}
                            options={[
                                { value: "", label: "Tất cả trạng thái" },
                                { value: "0", label: "Chưa sử dụng", dotClassName: "bg-[#94a3b8]" },
                                { value: "1", label: "Đang sử dụng", dotClassName: "bg-[#16a34a]" },
                            ]}
                        />
                    </div>

                    <label className="block">
                        <span className={labelClassName}>Bộ phận</span>
                        <SearchableSelect
                            options={departments.map((d) => ({ value: d.id, label: d.departmentName, searchText: d.departmentName.toLowerCase() }))}
                            value={departmentId === "" ? "" : Number(departmentId)}
                            onChange={(v) => {
                                // A group belongs to one department, so changing the department clears the picked group.
                                setDepartmentId(v === "" ? "" : String(v));
                                setGroupId("");
                            }}
                            placeholder="Tất cả bộ phận"
                        />
                    </label>

                    <label className="block">
                        <span className={labelClassName}>Nhóm</span>
                        <SearchableSelect
                            options={groups.map((g) => ({ value: g.id, label: g.groupName, searchText: g.groupName.toLowerCase() }))}
                            value={groupId === "" ? "" : Number(groupId)}
                            onChange={(v) => setGroupId(v === "" ? "" : String(v))}
                            placeholder="Tất cả nhóm"
                        />
                    </label>
                </div>

                <div className="flex flex-wrap items-center gap-3 border-t border-[#e0e3e5] px-6 py-4">
                    <div className="min-w-0 flex-1 text-sm text-[#5e3f3a]">
                        {visibleRows !== null ? (
                            <>
                                Tìm thấy <strong className="text-[#191c1e]">{visibleRows.length}</strong> thiết bị khớp điều kiện lọc.
                            </>
                        ) : (
                            "Bấm “Xem số lượng dữ liệu” để kiểm tra trước khi xuất."
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={fetchReport}
                        disabled={isLoading}
                        className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isLoading ? "Đang tải..." : "Xem số lượng dữ liệu"}
                    </button>
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
                        disabled={!visibleRows || visibleRows.length === 0}
                        className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Download className="h-4 w-4" /> Xuất PDF
                    </button>
                </div>
            </div>
        </div>
    );
}
