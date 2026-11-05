"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { Download, FileSpreadsheet, FileText, Loader2, Search } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { ROBOTO_REGULAR_BASE64, ROBOTO_BOLD_BASE64 } from "@/modules/pc-management/lib/pdf-fonts";
import { buildProductionTicketZip } from "@/modules/attendance/lib/productionTicketBatchPdf";
import { ProductionOtReportApi } from "@/modules/attendance/api/production-ot-report.api";
import { GeneralAffairsReportApi } from "@/modules/attendance/api/general-affairs-report.api";
import { DepartmentApi } from "@/modules/attendance/api/department.api";
import { WorkshopApi } from "@/modules/attendance/api/workshop.api";
import type { WorkshopDto } from "@/modules/attendance/types/workshop.dto";
import type { ProductionTicketReportDto, ProductionTicketReportRowDto } from "@/modules/attendance/types/production-ot-report.dto";
import type { DepartmentDto } from "@/modules/attendance/types/department.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import type { ListHandle, ListToolbarProps } from "../list-toolbar";
import { SearchableSelect, type SelectOption } from "@/components/ui/SearchableSelect";
import { MultiSelect } from "@/components/ui/MultiSelect";
import type { ProductionOptionDto } from "@/modules/attendance/types/production-employee.dto";
import { StyledSelect } from "@/components/ui/StyledSelect";
import ActionMenu from "@/components/ui/ActionMenu";
import InfoTooltip from "@/components/ui/InfoTooltip";

// Fixed shift order matching the 22-08.pdf template (A, B, C, H), not alphabetical.
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

// Pivot by shift/row like the top of 22-08.pdf, built from report.rows (no extra API call). Each row shows the
// StartTime of its first detail line, as the template does; per-Line times are in the detail table.
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

function lastDayOfMonth(month: string) {
    const [year, monthIndex] = month.split("-").map(Number);
    return `${month}-${String(new Date(year, monthIndex, 0).getDate()).padStart(2, "0")}`;
}

const labelClassName = "mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]";

function formatDateVn(iso: string) {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
}

// Default Helvetica lacks Vietnamese diacritics; embed Roboto via VFS (shared pdf-fonts.ts).
function registerVietnameseFont(doc: jsPDF) {
    doc.addFileToVFS("Roboto-Regular.ttf", ROBOTO_REGULAR_BASE64);
    doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
    doc.addFileToVFS("Roboto-Bold.ttf", ROBOTO_BOLD_BASE64);
    doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
    doc.setFont("Roboto", "normal");
}

// Colors replicate the legacy 22-08.pdf (including its green Main/Milk columns quirk), deliberately outside the brand
// palette since this print is compared against the old system.
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

    // Wide enough for both the title (long department names) and the summary table.
    const boxWidth = Math.max(100, doc.getTextWidth(titleText) + 12);

    // The first unlabeled row repeats the three totals, mirroring the template's numeric header row.
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
                // Main (3)/Milk (4) in green, label/time/secondary (0-2) in black, matching the template's quirk.
                data.cell.styles.textColor = data.column.index >= 3 ? LEAF_MAIN_MILK_TEXT_COLOR : LEAF_TEXT_COLOR;
                data.cell.styles.fillColor = LEAF_FILL_COLOR;
            }
        },
    });

    const pivotFinalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

    // Cyan frame around title + summary, as in the template.
    doc.setDrawColor(...PIVOT_BORDER_COLOR);
    doc.setLineWidth(0.4);
    doc.rect(boxX, boxTop, boxWidth, pivotFinalY - boxTop + 4);

    // The grand total label sits outside the frame, below it, as in the template.
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

    // Footer on every page (print time left, "Page X of Y" right); a single day can span hundreds of rows.
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

// Not a CRUD List but implements ListHandle for CategoryManagement's shared refresh button: openCreate() is a no-op,
// refresh() reruns the last search (nothing if none yet).
const ProductionOtReportPanel = forwardRef<ListHandle, ListToolbarProps>(function ProductionOtReportPanel(
    { onLoadingChange },
    ref
) {
    const t = useTranslations("Attendance.ProductionOtReport");
    const [scope, setScope] = useState<"office" | "production">("office");
    const [period, setPeriod] = useState<"day" | "month">("day");
    const [month, setMonth] = useState(() => todayIso().slice(0, 7));
    const [isExportingOffice, setIsExportingOffice] = useState(false);
    const [date, setDate] = useState(todayIso());
    const [departmentId, setDepartmentId] = useState<number | "">("");
    const [departments, setDepartments] = useState<DepartmentDto[]>([]);
    const [workshopId, setWorkshopId] = useState<number | "">("");
    const [workshops, setWorkshops] = useState<WorkshopDto[]>([]);
    const [productivityGroups, setProductivityGroups] = useState<ProductionOptionDto[]>([]);
    const [groupIds, setGroupIds] = useState<number[]>([]);
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

    // Production-line forms can belong to any department, not only manufacturing; list loads once on mount.
    useFetchEffect(
        () => DepartmentApi.getAllDepartments(),
        [],
        (result) => setDepartments(result),
        t("loadDepartmentsError")
    );
    useFetchEffect(
        () => WorkshopApi.getAllWorkshops(),
        [],
        (result) => setWorkshops(result),
        t("loadDepartmentsError")
    );
    useFetchEffect(
        () => ProductionOtReportApi.getOfficeProductivityGroups(workshopId === "" ? undefined : workshopId, departmentId === "" ? undefined : departmentId),
        [workshopId, departmentId],
        (result) => {
            setProductivityGroups(result);
            setGroupIds((prev) => prev.filter((id) => result.some((g) => g.id === id)));
        },
        t("loadDepartmentsError")
    );

    const handleSearch = async () => {
        setIsLoading(true);
        try {
            const result = await ProductionOtReportApi.getTicketReport(date, departmentId === "" ? undefined : departmentId, workshopId === "" ? undefined : workshopId);
            setReport(result);
        } catch (err) {
            toast.error(getApiErrorMessage(err, t("loadReportError")));
        } finally {
            setIsLoading(false);
        }
    };

    useImperativeHandle(ref, () => ({
        refresh: () => {
            if (scope === "production" && report) handleSearch();
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
                departmentId === "" ? undefined : departmentId, workshopId === "" ? undefined : workshopId
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
                departmentId === "" ? undefined : departmentId, workshopId === "" ? undefined : workshopId
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

    // Separate state/handlers from the exports above so each button's loading/error stays independent.
    const handleExportQry = async () => {
        setIsExportingQry(true);
        try {
            const { blob, fileName } = await ProductionOtReportApi.exportQryExportExcel(
                date,
                departmentId === "" ? undefined : departmentId, workshopId === "" ? undefined : workshopId
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
                departmentId === "" ? undefined : departmentId, workshopId === "" ? undefined : workshopId
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

    // Bulk YEV-22-024 zip per Line/group; Completed forms only (filtered in BE GetTicketBatchAsync).
    const handleExportTicketZip = async () => {
        setIsExportingTickets(true);
        setTicketExportProgress(null);
        try {
            const groups = await ProductionOtReportApi.getTicketBatch(date, departmentId === "" ? undefined : departmentId, workshopId === "" ? undefined : workshopId);
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

    // Both office files take the same range and filters: the General Affairs mail Excel, or Qry_EXPORT_EXCEL of the picked groups.
    const handleExportOffice = async (exporter: typeof GeneralAffairsReportApi.exportExcel) => {
        const [fromDate, toDate] = period === "month" ? [`${month}-01`, lastDayOfMonth(month)] : [date, date];
        setIsExportingOffice(true);
        try {
            const { blob, fileName } = await exporter(
                fromDate,
                toDate,
                workshopId === "" ? undefined : workshopId,
                departmentId === "" ? undefined : departmentId
            );
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName ?? `Du lieu tang ca ${period === "month" ? month : date}.xlsx`;
            link.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            toast.error(getApiErrorMessage(err, t("officeExportError")));
        } finally {
            setIsExportingOffice(false);
        }
    };

    const departmentOptions: SelectOption[] = departments.map((dept) => ({
        value: dept.id,
        label: dept.departmentNameVn,
        searchText: `${dept.departmentNameVn} ${dept.departmentCode}`.toLowerCase(),
    }));

    const isAnyExporting = isExportingExcel || isExportingTimes || isExportingQry || isExportingSum || isExportingTickets;
    const exportMenuLabel = isExportingTickets
        ? ticketExportProgress
            ? t("exportTicketZipProgress", { done: ticketExportProgress.done, total: ticketExportProgress.total })
            : t("exportTicketZipPreparing")
        : isAnyExporting
          ? t("exporting")
          : t("exportMenuLabel");
    const excelIcon = <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />;
    const exportItems = [
        { label: t("exportHoursButton"), onClick: handleExportExcel, icon: excelIcon },
        { label: t("exportTimesButton"), onClick: handleExportTimes, icon: excelIcon },
        { label: t("exportDetailButton"), onClick: handleExportQry, icon: excelIcon },
        { label: t("exportSummaryButton"), onClick: handleExportSum, icon: excelIcon },
        { label: t("exportTicketZipButton"), onClick: handleExportTicketZip, icon: <FileText className="h-3.5 w-3.5 shrink-0" /> },
    ];

    return (
        <div className="space-y-4">
            <div className="rounded-xl border border-[#e0e3e5] bg-white p-4 shadow-sm">
                {/* Top-aligned because the group picker grows with its chips; action buttons offset by one label height. */}
                <div className="flex flex-wrap items-start gap-3">
                    <label className="block w-36">
                        <span className={labelClassName}>{t("scopeLabel")}</span>
                        <StyledSelect
                            value={scope}
                            onChange={(value) => setScope(value as "office" | "production")}
                            triggerClassName={`${fieldClassName} w-full pr-8`}
                            options={[
                                { value: "office", label: t("scopeOffice") },
                                { value: "production", label: t("scopeProduction") },
                            ]}
                        />
                    </label>
                    <div>
                        <span className={labelClassName}>
                            {t("fieldDateLabel")}
                            <InfoTooltip text={scope === "office" ? t("officeExportHint") : t("searchHint")} />
                        </span>
                        <div className="flex gap-2">
                            {scope === "office" && (
                                <StyledSelect
                                    value={period}
                                    onChange={(value) => setPeriod(value as "day" | "month")}
                                    triggerClassName={`${fieldClassName} w-32 pr-8`}
                                    options={[
                                        { value: "day", label: t("periodDay") },
                                        { value: "month", label: t("periodMonth") },
                                    ]}
                                />
                            )}
                            {scope === "office" && period === "month" ? (
                                <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} aria-label={t("periodMonth")} className={`${fieldClassName} w-40`} />
                            ) : (
                                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label={t("fieldDateLabel")} className={`${fieldClassName} w-40`} />
                            )}
                        </div>
                    </div>
                    <label className="block w-44">
                        <span className={labelClassName}>{t("fieldWorkshopLabel")}</span>
                        <SearchableSelect
                            options={workshops.map((w) => ({ value: w.id, label: w.workshopNameVn, searchText: w.workshopNameVn.toLowerCase() }))}
                            value={workshopId}
                            onChange={setWorkshopId}
                            placeholder={t("filterAllWorkshop")}
                        />
                    </label>
                    <label className="block w-56">
                        <span className={labelClassName}>
                            {scope === "office" ? t("fieldOfficeDepartmentLabel") : t("fieldDepartmentLabel")}
                        </span>
                        <SearchableSelect
                            options={departmentOptions}
                            value={departmentId}
                            onChange={setDepartmentId}
                            placeholder={t("filterAllDepartment")}
                        />
                    </label>
                    {scope === "office" && (
                        <div className="w-64">
                            <span className={labelClassName}>
                                {t("fieldProductivityGroupLabel")}
                                <InfoTooltip text={t("productivityGroupHint")} />
                            </span>
                            <MultiSelect
                                options={productivityGroups.map((g) => ({ value: g.id, label: g.nameVn ?? g.code, searchText: `${g.nameVn ?? ""} ${g.code}`.toLowerCase() }))}
                                values={groupIds}
                                onChange={setGroupIds}
                                placeholder={t("filterAllDepartment")}
                            />
                        </div>
                    )}
                    {scope === "office" ? (
                        <div className="mt-[22px]">
                        <ActionMenu
                            label={isExportingOffice ? t("exporting") : t("exportMenuLabel")}
                            icon={isExportingOffice ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                            items={[
                                { label: t("officeExportGeneralAffairs"), onClick: () => handleExportOffice(GeneralAffairsReportApi.exportExcel), icon: excelIcon },
                                {
                                    label: t("officeExportProductivity"),
                                    onClick: () => handleExportOffice((from, to, ws, dept) => ProductionOtReportApi.exportOfficeQryExportExcel(from, to, ws, dept, groupIds)),
                                    icon: excelIcon,
                                },
                            ]}
                            disabled={isExportingOffice || !(period === "month" ? month : date)}
                        />
                        </div>
                    ) : (
                    <div className="mt-[22px] flex gap-2">
                        <button
                            type="button"
                            onClick={handleSearch}
                            disabled={isLoading || !date}
                            className="flex h-10 cursor-pointer items-center gap-1.5 rounded-lg bg-[#e3000f] px-4 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Search className="h-3.5 w-3.5" /> {isLoading ? t("searching") : t("searchButton")}
                        </button>
                        <ActionMenu
                            label={exportMenuLabel}
                            icon={isAnyExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                            items={exportItems}
                            disabled={isAnyExporting || !date}
                        />
                    </div>
                    )}
                </div>
            </div>

            {scope === "production" && report && (
                <div className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e0e3e5] bg-[#f8fafc] p-3">
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
                                    <th className="whitespace-nowrap px-3 py-2">{t("colDepartment")}</th>
                                    <th className="whitespace-nowrap px-3 py-2">{t("colCa")}</th>
                                    <th className="whitespace-nowrap px-3 py-2">{t("colTeam")}</th>
                                    <th className="whitespace-nowrap px-3 py-2">{t("colLine")}</th>
                                    <th className="whitespace-nowrap px-3 py-2 text-right">{t("colSecondary")}</th>
                                    <th className="whitespace-nowrap px-3 py-2 text-right">{t("colMain")}</th>
                                    <th className="whitespace-nowrap px-3 py-2 text-right">{t("colMilk")}</th>
                                    <th className="whitespace-nowrap px-3 py-2 text-right">{t("colHours")}</th>
                                    <th className="whitespace-nowrap px-3 py-2">{t("colStartTime")}</th>
                                    <th className="whitespace-nowrap px-3 py-2">{t("colEndTime")}</th>
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
                                        className="border-b border-[#f1f5f9] bg-white transition-colors even:bg-[#f2f4f7] hover:bg-[#e8ecf1]"
                                    >
                                        <td className="px-3 py-2 text-sm text-[#191c1e]">{row.congDoan}</td>
                                        <td className="px-3 py-2 text-sm text-[#191c1e]">{row.ca}</td>
                                        <td className="px-3 py-2 text-sm text-[#191c1e]">{row.team}</td>
                                        <td className="px-3 py-2 text-sm text-[#191c1e]">{row.lineCa}</td>
                                        <td className="px-3 py-2 text-right text-sm text-[#5e3f3a]">{row.secondaryTicketCount}</td>
                                        <td className="px-3 py-2 text-right text-sm text-[#5e3f3a]">{row.mainTicketCount}</td>
                                        <td className="px-3 py-2 text-right text-sm text-[#5e3f3a]">{row.milkCount}</td>
                                        <td className="px-3 py-2 text-right text-sm text-[#5e3f3a]">{row.totalHour}</td>
                                        <td className="px-3 py-2 text-sm text-[#5e3f3a]">{row.startTime.slice(0, 5)}</td>
                                        <td className="px-3 py-2 text-sm text-[#5e3f3a]">{row.endTime.slice(0, 5)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
});

export default ProductionOtReportPanel;
