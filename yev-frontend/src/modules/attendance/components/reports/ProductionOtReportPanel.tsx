"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { Download, FileSpreadsheet, FileText, Search } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { ROBOTO_REGULAR_BASE64, ROBOTO_BOLD_BASE64 } from "@/modules/pc-management/lib/pdf-fonts";
import { buildProductionTicketZip } from "@/modules/attendance/lib/productionTicketBatchPdf";
import { ProductionOtReportApi } from "@/modules/attendance/api/production-ot-report.api";
import { DepartmentApi } from "@/modules/attendance/api/department.api";
import type { ProductionTicketReportDto, ProductionTicketReportRowDto } from "@/modules/attendance/types/production-ot-report.dto";
import type { DepartmentDto } from "@/modules/attendance/types/department.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import type { ListHandle, ListToolbarProps } from "../list-toolbar";
import { SearchableSelect, type SelectOption } from "@/components/ui/SearchableSelect";

// Thứ tự CA cố định khớp file mẫu 22-08.pdf (A → B → C → H), không phải alphabet mặc định.
const CA_ORDER = ["A", "B", "C", "H"];

interface PivotRow {
    label: string;
    isCaGroup: boolean;
    time: string;
    secondary: number;
    main: number;
    milk: number;
}

interface PivotResult {
    rows: PivotRow[];
    totalSecondary: number;
    totalMain: number;
    totalMilk: number;
}

// Bảng tổng hợp theo CA/Dãy ở đầu trang — mirror khối pivot đầu file mẫu 22-08.pdf (nhóm CA → nhóm
// CA_Dãy bên trong, có dòng tổng mỗi CA rồi TỔNG cuối cùng, dòng nào cũng kèm 1 giờ đại diện). Gộp
// NGAY TRÊN dữ liệu report.rows đã có (vốn chi tiết hơn, còn tách theo Line) — không cần gọi thêm
// API. Cột giờ ở mỗi dòng CA_Dãy lấy StartTime của dòng chi tiết ĐẦU TIÊN trong nhóm đó (nếu 1 CA_Dãy
// gồm nhiều Line khác giờ nhau do về sớm/vào trễ thì chỉ đại diện 1 giờ, giống đúng cách file mẫu thể
// hiện — xem đủ giờ từng Line ở bảng chi tiết bên dưới).
function buildPivotRows(rows: ProductionTicketReportRowDto[]): PivotResult {
    const byCa = new Map<string, ProductionTicketReportRowDto[]>();
    for (const row of rows) {
        if (!byCa.has(row.ca)) byCa.set(row.ca, []);
        byCa.get(row.ca)!.push(row);
    }
    const orderedCaKeys = [...byCa.keys()].sort((a, b) => {
        const ia = CA_ORDER.indexOf(a);
        const ib = CA_ORDER.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

    const sum = (list: ProductionTicketReportRowDto[], key: "secondaryTicketCount" | "mainTicketCount" | "milkCount") =>
        list.reduce((total, item) => total + item[key], 0);

    const pivot: PivotRow[] = [];
    for (const ca of orderedCaKeys) {
        const caRows = byCa.get(ca)!;
        pivot.push({
            label: ca,
            isCaGroup: true,
            time: "",
            secondary: sum(caRows, "secondaryTicketCount"),
            main: sum(caRows, "mainTicketCount"),
            milk: sum(caRows, "milkCount"),
        });

        const byTeam = new Map<string, ProductionTicketReportRowDto[]>();
        for (const row of caRows) {
            if (!byTeam.has(row.team)) byTeam.set(row.team, []);
            byTeam.get(row.team)!.push(row);
        }
        for (const [team, teamRows] of [...byTeam.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
            pivot.push({
                label: `${ca}_${team}`,
                isCaGroup: false,
                time: teamRows[0].startTime.slice(0, 5),
                secondary: sum(teamRows, "secondaryTicketCount"),
                main: sum(teamRows, "mainTicketCount"),
                milk: sum(teamRows, "milkCount"),
            });
        }
    }

    return {
        rows: pivot,
        totalSecondary: sum(rows, "secondaryTicketCount"),
        totalMain: sum(rows, "mainTicketCount"),
        totalMilk: sum(rows, "milkCount"),
    };
}

function todayIso() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatDateVn(iso: string) {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
}

// Font mặc định của jsPDF (Helvetica) không có dấu tiếng Việt — nhúng font Roboto qua VFS (cùng file
// dùng chung với DeviceListReportPrintDialog.tsx, xem modules/pc-management/lib/pdf-fonts.ts).
function registerVietnameseFont(doc: jsPDF) {
    doc.addFileToVFS("Roboto-Regular.ttf", ROBOTO_REGULAR_BASE64);
    doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
    doc.addFileToVFS("Roboto-Bold.ttf", ROBOTO_BOLD_BASE64);
    doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
    doc.setFont("Roboto", "normal");
}

// Màu mô phỏng ĐÚNG file PDF gốc docs/Data/Reports/22-08.pdf (2026-08-29, đọc trực tiếp file gốc chứ
// không phải ảnh chụp) — dòng nhóm CA chữ TÍM đậm; dòng CA_Dãy con: cột nhãn/giờ/Phiếu Phụ chữ ĐEN
// trên nền XÁM nhạt, riêng 2 cột Chính/Sữa chữ XANH LÁ (quirk của file mẫu, giữ nguyên); tiêu đề +
// header bảng chi tiết chữ XANH LAM đậm. Không có trong bảng màu thương hiệu CLAUDE.md vì đây là bản
// in đối chiếu với hệ cũ, cố tình khác giao diện web của hệ thống.
const PIVOT_BORDER_COLOR: [number, number, number] = [77, 208, 225];
const TITLE_COLOR: [number, number, number] = [26, 115, 140];
const CA_GROUP_TEXT_COLOR: [number, number, number] = [106, 61, 154];
const LEAF_TEXT_COLOR: [number, number, number] = [0, 0, 0];
const LEAF_MAIN_MILK_TEXT_COLOR: [number, number, number] = [46, 125, 50];
const LEAF_FILL_COLOR: [number, number, number] = [242, 242, 242];
const TOTAL_TEXT_COLOR: [number, number, number] = [211, 47, 47];

function formatPrintTimestamp(d: Date) {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const seconds = String(d.getSeconds()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${dd}/${mm}/${yyyy} ${String(hours).padStart(2, "0")}:${minutes}:${seconds} ${ampm}`;
}

function buildTicketReportPdf(report: ProductionTicketReportDto) {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    registerVietnameseFont(doc);

    const boxX = 12;
    const boxTop = 8;
    const titleY = 16;
    const titleText = `BÁO PHIẾU TĂNG CA NGÀY: ${formatDateVn(report.date)}`;

    doc.setFont("Roboto", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...TITLE_COLOR);
    doc.text(titleText, boxX + 4, titleY);
    doc.setTextColor(0, 0, 0);

    // Khung phải đủ rộng cho tiêu đề (VD tên Bộ phận dài) lẫn bảng tổng hợp — lấy max của cả 2.
    const boxWidth = Math.max(100, doc.getTextWidth(titleText) + 12);

    // Bảng tổng hợp theo CA/Dãy — cùng khối pivot đầu file mẫu 22-08.pdf (xem buildPivotRows). Dòng
    // đầu tiên (không nhãn) lặp lại 3 tổng cộng giống hệt hàng "tiêu đề số" của file mẫu (thay vì chữ
    // "Phiếu Phụ/Chính/Sữa" — giữ đúng quirk hiển thị gốc). Nhóm CA tô tím đậm, dòng CA_Dãy tô xanh lá
    // + nền xám nhạt, khớp đúng phối màu ảnh chụp người dùng gửi.
    const pivot = buildPivotRows(report.rows);
    const pivotBody: (string | number)[][] = [
        ["", "", pivot.totalSecondary, pivot.totalMain, pivot.totalMilk],
        ...pivot.rows.map((row) => [row.label, row.time, row.secondary, row.main, row.milk]),
    ];
    autoTable(doc, {
        startY: titleY + 6,
        tableWidth: 92,
        margin: { left: boxX + 4 },
        theme: "grid",
        styles: {
            font: "Roboto",
            fontStyle: "normal",
            fontSize: 8.5,
            cellPadding: 1.8,
            lineColor: PIVOT_BORDER_COLOR,
            lineWidth: 0.25,
            halign: "center",
        },
        columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
        body: pivotBody,
        didParseCell: (data) => {
            if (data.row.index === 0) {
                data.cell.styles.textColor = TOTAL_TEXT_COLOR;
                data.cell.styles.fontStyle = "bold";
                return;
            }
            const row = pivot.rows[data.row.index - 1];
            if (!row) return;
            if (row.isCaGroup) {
                data.cell.styles.textColor = CA_GROUP_TEXT_COLOR;
                data.cell.styles.fontStyle = "bold";
            } else {
                // Cột Chính (index 3)/Sữa (index 4) chữ xanh lá, cột nhãn/giờ/Phiếu Phụ (0-2) chữ đen
                // — đúng quirk màu của file mẫu gốc (không phải lỗi đọc nhầm ảnh mờ trước đó).
                data.cell.styles.textColor = data.column.index >= 3 ? LEAF_MAIN_MILK_TEXT_COLOR : LEAF_TEXT_COLOR;
                data.cell.styles.fillColor = LEAF_FILL_COLOR;
            }
        },
    });

    const pivotFinalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

    // Khung viền cyan quanh tiêu đề + bảng tổng hợp — khớp khối box của file mẫu.
    doc.setDrawColor(...PIVOT_BORDER_COLOR);
    doc.setLineWidth(0.4);
    doc.rect(boxX, boxTop, boxWidth, pivotFinalY - boxTop + 4);

    // "TỔNG :" nằm NGOÀI khung, ngay dưới — đúng vị trí file mẫu (không phải dòng cuối trong bảng).
    const totalLineY = pivotFinalY + 12;
    doc.setFont("Roboto", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...TOTAL_TEXT_COLOR);
    doc.text(
        `TỔNG :   ${pivot.totalSecondary}      ${pivot.totalMain}      ${pivot.totalMilk}`,
        boxX + 40,
        totalLineY
    );
    doc.setTextColor(0, 0, 0);

    autoTable(doc, {
        startY: totalLineY + 6,
        theme: "grid",
        styles: {
            font: "Roboto",
            fontStyle: "normal",
            fontSize: 8,
            cellPadding: 1.5,
            lineColor: PIVOT_BORDER_COLOR,
            lineWidth: 0.2,
            halign: "center",
            textColor: [0, 0, 0],
        },
        headStyles: { font: "Roboto", fontStyle: "bold", textColor: TITLE_COLOR, fillColor: [255, 255, 255], lineWidth: 0.3 },
        head: [["BOPHAN", "CA", "DÃY", "Line_ca", "Phiếu Phụ", "Chính", "Sữa", "SO_GIO", "Gio_BD", "Gio_KT"]],
        body: report.rows.map((row) => [
            row.congDoan,
            row.ca,
            row.team,
            row.lineCa,
            row.secondaryTicketCount,
            row.mainTicketCount,
            row.milkCount,
            row.totalHour,
            row.startTime.slice(0, 5),
            row.endTime.slice(0, 5),
        ]),
    });

    // Chân trang lặp lại mỗi trang — ngày giờ in bên trái, "Page X of Y" bên phải, khớp bản in nhiều
    // trang của file mẫu (đơn dưới chuyền 1 ngày có thể ra hàng trăm dòng chi tiết, tự ngắt trang).
    const pageCount = doc.getNumberOfPages();
    const printedAt = formatPrintTimestamp(new Date());
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFont("Roboto", "normal");
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.text(printedAt, boxX, pageHeight - 8);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - boxX, pageHeight - 8, { align: "right" });
    }

    return doc;
}

// Tab "Báo cáo" trong Danh mục (2026-08-28, theo yêu cầu người dùng — trước đó là mục riêng ở
// sidebar). Không theo khuôn List CRUD (không có bảng/"Thêm mới") nhưng vẫn implement ListHandle để
// CategoryManagement.tsx dùng chung nút "Làm mới" ở header — openCreate() là no-op, refresh() chạy
// lại đúng lượt tìm gần nhất (không làm gì nếu chưa từng bấm "Xem báo cáo phiếu").
const ProductionOtReportPanel = forwardRef<ListHandle, ListToolbarProps>(function ProductionOtReportPanel(
    { onLoadingChange },
    ref
) {
    const t = useTranslations("Attendance.ProductionOtReport");
    const [date, setDate] = useState(todayIso());
    const [departmentId, setDepartmentId] = useState<number | "">("");
    const [departments, setDepartments] = useState<DepartmentDto[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isExportingExcel, setIsExportingExcel] = useState(false);
    const [isExportingTimes, setIsExportingTimes] = useState(false);
    const [isExportingQry, setIsExportingQry] = useState(false);
    const [isExportingSum, setIsExportingSum] = useState(false);
    const [isExportingTickets, setIsExportingTickets] = useState(false);
    const [ticketExportProgress, setTicketExportProgress] = useState<{ done: number; total: number } | null>(null);
    const [report, setReport] = useState<ProductionTicketReportDto | null>(null);

    useEffect(() => {
        onLoadingChange?.(isLoading);
    }, [isLoading, onLoadingChange]);

    // Chọn Phòng ban để lọc báo cáo (2026-08-29, theo yêu cầu người dùng — đơn "dưới chuyền" có thể
    // tạo dưới bất kỳ Phòng ban nào, không chỉ riêng "Chế tạo"). Danh sách chỉ tải 1 lần khi mount.
    useFetchEffect(
        () => DepartmentApi.getAllDepartments(),
        [],
        (result) => setDepartments(result),
        t("loadDepartmentsError")
    );

    const handleSearch = async () => {
        setIsLoading(true);
        try {
            const result = await ProductionOtReportApi.getTicketReport(date, departmentId === "" ? undefined : departmentId);
            setReport(result);
        } catch (err) {
            toast.error(getApiErrorMessage(err, t("loadReportError")));
        } finally {
            setIsLoading(false);
        }
    };

    useImperativeHandle(ref, () => ({
        refresh: () => {
            if (report) handleSearch();
        },
        openCreate: () => {},
    }));

    const handleExportPdf = () => {
        if (!report || report.rows.length === 0) {
            toast.error(t("exportPdfNoDataError"));
            return;
        }
        try {
            const doc = buildTicketReportPdf(report);
            doc.save(`BaoCaoPhieuTangCa_${date.replace(/-/g, "")}.pdf`);
        } catch (err) {
            console.error("Export PDF failed:", err);
            toast.error(t("exportPdfFailedError"));
        }
    };

    const handleExportExcel = async () => {
        setIsExportingExcel(true);
        try {
            const { blob, fileName } = await ProductionOtReportApi.exportHoursReportExcel(
                date,
                departmentId === "" ? undefined : departmentId
            );
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName ?? `TongGioTangCa_${date.replace(/-/g, "")}.xlsx`;
            link.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            toast.error(getApiErrorMessage(err, t("exportHoursError")));
        } finally {
            setIsExportingExcel(false);
        }
    };

    const handleExportTimes = async () => {
        setIsExportingTimes(true);
        try {
            const { blob, fileName } = await ProductionOtReportApi.exportTimesReportExcel(
                date,
                departmentId === "" ? undefined : departmentId
            );
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName ?? `SoLuotTangCa_${date.replace(/-/g, "")}.xlsx`;
            link.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            toast.error(getApiErrorMessage(err, t("exportTimesError")));
        } finally {
            setIsExportingTimes(false);
        }
    };

    // 2 export mới (2026-09-03c) — độc lập với 2 export ở trên, KHÔNG dùng chung state/handler dù cùng
    // pattern tải blob, để lỗi/loading của từng nút tách biệt nhau.
    const handleExportQry = async () => {
        setIsExportingQry(true);
        try {
            const { blob, fileName } = await ProductionOtReportApi.exportQryExportExcel(
                date,
                departmentId === "" ? undefined : departmentId
            );
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName ?? `Qry_EXPORT_EXCEL_${date.replace(/-/g, "")}.xlsx`;
            link.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            toast.error(getApiErrorMessage(err, t("exportDetailError")));
        } finally {
            setIsExportingQry(false);
        }
    };

    const handleExportSum = async () => {
        setIsExportingSum(true);
        try {
            const { blob, fileName } = await ProductionOtReportApi.exportSumExportData(
                date,
                departmentId === "" ? undefined : departmentId
            );
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName ?? `SUM_EXPORT_DATA_${date.replace(/-/g, "")}.xlsx`;
            link.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            toast.error(getApiErrorMessage(err, t("exportSummaryError")));
        } finally {
            setIsExportingSum(false);
        }
    };

    // Xuất hàng loạt phiếu YEV-22-024 theo Line/Nhóm, đóng gói zip (2026-09-03c) — chỉ tính đơn Hoàn
    // tất (đã tự lọc sẵn ở BE GetTicketBatchAsync, cùng bộ lọc Status=Completed với mọi báo cáo khác
    // trong màn này, theo đúng xác nhận người dùng "chỉ những đơn đã hoàn tất").
    const handleExportTicketZip = async () => {
        setIsExportingTickets(true);
        setTicketExportProgress(null);
        try {
            const groups = await ProductionOtReportApi.getTicketBatch(date, departmentId === "" ? undefined : departmentId);
            if (groups.length === 0) {
                toast.error(t("exportTicketZipNoDataError"));
                return;
            }
            const result = await buildProductionTicketZip(groups, date, (done, total) => setTicketExportProgress({ done, total }));
            if (!result) return;
            const url = URL.createObjectURL(result.blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = result.fileName;
            link.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            toast.error(getApiErrorMessage(err, t("exportTicketZipError")));
        } finally {
            setIsExportingTickets(false);
            setTicketExportProgress(null);
        }
    };

    const departmentOptions: SelectOption[] = departments.map((dept) => ({
        value: dept.id,
        label: dept.departmentNameVn,
        searchText: `${dept.departmentNameVn} ${dept.departmentCode}`.toLowerCase(),
    }));

    return (
        <div className="space-y-6">
            <div className="rounded-xl border border-[#e0e3e5] bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-end gap-3">
                    <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                            {t("fieldDateLabel")}
                        </span>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="h-10 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                        />
                    </label>
                    <label className="block w-56">
                        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                            {t("fieldDepartmentLabel")}
                        </span>
                        <SearchableSelect
                            options={departmentOptions}
                            value={departmentId}
                            onChange={setDepartmentId}
                            placeholder={t("filterAllDepartment")}
                        />
                    </label>
                    <button
                        type="button"
                        onClick={handleSearch}
                        disabled={isLoading || !date}
                        className="flex h-10 cursor-pointer items-center gap-1.5 rounded-lg bg-[#e3000f] px-4 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Search className="h-3.5 w-3.5" /> {isLoading ? t("searching") : t("searchButton")}
                    </button>
                </div>
                <p className="mt-2 text-xs text-[#8a8f94]">{t("searchHint")}</p>

                <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[#f1f5f9] pt-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">{t("exportExcelGroupLabel")}</span>
                    <button
                        type="button"
                        onClick={handleExportExcel}
                        disabled={isExportingExcel || !date}
                        title={t("exportHoursTitle")}
                        className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                        {isExportingExcel ? t("exporting") : t("exportHoursButton")}
                    </button>
                    <button
                        type="button"
                        onClick={handleExportTimes}
                        disabled={isExportingTimes || !date}
                        title={t("exportTimesTitle")}
                        className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                        {isExportingTimes ? t("exporting") : t("exportTimesButton")}
                    </button>
                    <button
                        type="button"
                        onClick={handleExportQry}
                        disabled={isExportingQry || !date}
                        title={t("exportDetailTitle")}
                        className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                        {isExportingQry ? t("exporting") : t("exportDetailButton")}
                    </button>
                    <button
                        type="button"
                        onClick={handleExportSum}
                        disabled={isExportingSum || !date}
                        title={t("exportSummaryTitle")}
                        className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                        {isExportingSum ? t("exporting") : t("exportSummaryButton")}
                    </button>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[#f1f5f9] pt-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">{t("exportTicketGroupLabel")}</span>
                    <button
                        type="button"
                        onClick={handleExportTicketZip}
                        disabled={isExportingTickets || !date}
                        title={t("exportTicketZipTitle")}
                        className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <FileText className="h-3.5 w-3.5" />
                        {isExportingTickets
                            ? ticketExportProgress
                                ? t("exportTicketZipProgress", { done: ticketExportProgress.done, total: ticketExportProgress.total })
                                : t("exportTicketZipPreparing")
                            : t("exportTicketZipButton")}
                    </button>
                </div>
            </div>

            {report && (
                <div className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e0e3e5] bg-[#f8fafc] p-4">
                        <div className="flex flex-wrap gap-6 text-sm text-[#5e3f3a]">
                            <span>
                                {t("summarySecondaryLabel")} <strong className="text-[#191c1e]">{report.totalSecondaryTicketCount}</strong>
                            </span>
                            <span>
                                {t("summaryMainLabel")} <strong className="text-[#191c1e]">{report.totalMainTicketCount}</strong>
                            </span>
                            <span>
                                {t("summaryMilkLabel")} <strong className="text-[#191c1e]">{report.totalMilkCount}</strong>
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={handleExportPdf}
                            disabled={report.rows.length === 0}
                            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Download className="h-3.5 w-3.5" /> {t("exportPdfButton")}
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse text-left">
                            <thead>
                                <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                    <th className="whitespace-nowrap px-4 py-3">{t("colDepartment")}</th>
                                    <th className="whitespace-nowrap px-4 py-3">{t("colCa")}</th>
                                    <th className="whitespace-nowrap px-4 py-3">{t("colTeam")}</th>
                                    <th className="whitespace-nowrap px-4 py-3">{t("colLine")}</th>
                                    <th className="whitespace-nowrap px-4 py-3 text-right">{t("colSecondary")}</th>
                                    <th className="whitespace-nowrap px-4 py-3 text-right">{t("colMain")}</th>
                                    <th className="whitespace-nowrap px-4 py-3 text-right">{t("colMilk")}</th>
                                    <th className="whitespace-nowrap px-4 py-3 text-right">{t("colHours")}</th>
                                    <th className="whitespace-nowrap px-4 py-3">{t("colStartTime")}</th>
                                    <th className="whitespace-nowrap px-4 py-3">{t("colEndTime")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {report.rows.length === 0 && (
                                    <tr>
                                        <td colSpan={10} className="px-4 py-8 text-center text-sm text-[#5e3f3a]">
                                            {t("noData")}
                                        </td>
                                    </tr>
                                )}
                                {report.rows.map((row, index) => (
                                    <tr
                                        key={`${row.congDoan}-${row.ca}-${row.team}-${row.lineCa}-${row.startTime}-${index}`}
                                        className="border-b border-[#f1f5f9] transition-colors hover:bg-[#f8fafc]"
                                    >
                                        <td className="px-4 py-3 text-sm text-[#191c1e]">{row.congDoan}</td>
                                        <td className="px-4 py-3 text-sm text-[#191c1e]">{row.ca}</td>
                                        <td className="px-4 py-3 text-sm text-[#191c1e]">{row.team}</td>
                                        <td className="px-4 py-3 text-sm text-[#191c1e]">{row.lineCa}</td>
                                        <td className="px-4 py-3 text-right text-sm text-[#5e3f3a]">{row.secondaryTicketCount}</td>
                                        <td className="px-4 py-3 text-right text-sm text-[#5e3f3a]">{row.mainTicketCount}</td>
                                        <td className="px-4 py-3 text-right text-sm text-[#5e3f3a]">{row.milkCount}</td>
                                        <td className="px-4 py-3 text-right text-sm text-[#5e3f3a]">{row.totalHour}</td>
                                        <td className="px-4 py-3 text-sm text-[#5e3f3a]">{row.startTime.slice(0, 5)}</td>
                                        <td className="px-4 py-3 text-sm text-[#5e3f3a]">{row.endTime.slice(0, 5)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {!report && (
                <div className="flex items-center gap-2 rounded-xl border border-dashed border-[#e0e3e5] bg-white p-8 text-sm text-[#5e3f3a]">
                    <FileText className="h-4 w-4" /> {t("emptyStateHint")}
                </div>
            )}
        </div>
    );
});

export default ProductionOtReportPanel;
