"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { toast } from "react-toastify";
import { useLocale, useTranslations } from "next-intl";
import { Download, FileSpreadsheet, FileText, Loader2, Search } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { ROBOTO_REGULAR_BASE64, ROBOTO_BOLD_BASE64 } from "@/modules/pc-management/lib/pdf-fonts";
import { buildProductionTicketZip } from "@/modules/attendance/lib/productionTicketBatchPdf";
import { ProductionOtReportApi, type ReportFilter } from "@/modules/attendance/api/production-ot-report.api";
import type { BlobDownloadResult } from "@/lib/client";
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
import ActionMenu from "@/components/ui/ActionMenu";
import InfoTooltip from "@/components/ui/InfoTooltip";
import { IconButton, TableStatusRows, fieldClassName, theadRowClassName } from "@/components/ui/ListToolbar";

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
    const locale = useLocale();
    const [period, setPeriod] = useState<"day" | "month">("day");
    const [month, setMonth] = useState(() => todayIso().slice(0, 7));
    const [date, setDate] = useState(todayIso());
    const [departmentId, setDepartmentId] = useState<number | "">("");
    const [departments, setDepartments] = useState<DepartmentDto[]>([]);
    const [workshopId, setWorkshopId] = useState<number | "">("");
    const [workshops, setWorkshops] = useState<WorkshopDto[]>([]);
    const [groups, setGroups] = useState<ProductionOptionDto[]>([]);
    const [groupIds, setGroupIds] = useState<number[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [ticketExportProgress, setTicketExportProgress] = useState<{ done: number; total: number } | null>(null);
    const [isExportingTickets, setIsExportingTickets] = useState(false);
    const [report, setReport] = useState<ProductionTicketReportDto | null>(null);

    useEffect(() => {
        onLoadingChange?.(isLoading);
    }, [isLoading, onLoadingChange]);

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
        () => ProductionOtReportApi.getGroups(workshopId === "" ? undefined : workshopId, departmentId === "" ? undefined : departmentId),
        [workshopId, departmentId],
        (result) => {
            setGroups(result);
            setGroupIds((prev) => prev.filter((id) => result.some((g) => g.id === id)));
        },
        t("loadDepartmentsError")
    );

    const isDay = period === "day";
    const filter: ReportFilter = {
        fromDate: isDay ? date : `${month}-01`,
        toDate: isDay ? date : lastDayOfMonth(month),
        workshopId: workshopId === "" ? undefined : workshopId,
        departmentId: departmentId === "" ? undefined : departmentId,
        groupIds,
    };
    const hasPeriod = Boolean(isDay ? date : month);

    const handleSearch = async () => {
        setIsLoading(true);
        try {
            setReport(await ProductionOtReportApi.getTicketReport(filter));
        } catch (err) {
            toast.error(getApiErrorMessage(err, t("loadReportError")));
        } finally {
            setIsLoading(false);
        }
    };

    useImperativeHandle(ref, () => ({
        refresh: () => {
            if (report && isDay) handleSearch();
        },
        openCreate: () => {},
    }));

    const handleExportPdf = () => {
        if (!report || report.rows.length === 0) {
            toast.error(t("exportPdfNoDataError"));
            return;
        }
        try {
            buildTicketReportPdf(report).save(`BaoCaoPhieuTangCa_${date.replace(/-/g, "")}.pdf`);
        } catch (err) {
            console.error("Export PDF failed:", err);
            toast.error(t("exportPdfFailedError"));
        }
    };

    const download = (blob: Blob, fileName: string) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
    };

    // Every Excel export takes the same filter; the fallback name only applies when the server sends none.
    const exportExcel = async (exporter: (f: ReportFilter) => Promise<BlobDownloadResult>, fallbackName: string, errorKey: string) => {
        setIsExporting(true);
        try {
            const { blob, fileName } = await exporter(filter);
            download(blob, fileName ?? `${fallbackName}_${filter.fromDate}.xlsx`);
        } catch (err) {
            toast.error(getApiErrorMessage(err, t(errorKey)));
        } finally {
            setIsExporting(false);
        }
    };

    // Bulk YEV-22-024 zip per Line/group; Completed forms only (filtered in BE GetTicketBatchAsync).
    const handleExportTicketZip = async () => {
        setIsExportingTickets(true);
        setTicketExportProgress(null);
        try {
            const batch = await ProductionOtReportApi.getTicketBatch(filter);
            if (batch.length === 0) {
                toast.error(t("exportTicketZipNoDataError"));
                return;
            }
            const result = await buildProductionTicketZip(batch, date, (done, total) => setTicketExportProgress({ done, total }));
            if (result) download(result.blob, result.fileName);
        } catch (err) {
            toast.error(getApiErrorMessage(err, t("exportTicketZipError")));
        } finally {
            setIsExportingTickets(false);
            setTicketExportProgress(null);
        }
    };

    const localName = (vn: string, jp: string | null) => (locale === "ja" ? jp || vn : vn);
    const departmentOptions: SelectOption[] = departments.map((dept) => ({
        value: dept.id,
        label: localName(dept.departmentNameVn, dept.departmentNameJp),
        searchText: `${dept.departmentNameVn} ${dept.departmentNameJp ?? ""} ${dept.departmentCode}`.toLowerCase(),
    }));

    const isBusy = isExporting || isExportingTickets;
    const exportProgress = isExportingTickets
        ? ticketExportProgress
            ? t("exportTicketZipProgress", { done: ticketExportProgress.done, total: ticketExportProgress.total })
            : t("exportTicketZipPreparing")
        : isExporting
          ? t("exporting")
          : null;
    const excelIcon = <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />;
    const pdfIcon = <FileText className="h-3.5 w-3.5 shrink-0" />;
    const dayOnlyTitle = isDay ? undefined : t("dayOnlySuffix");
    // The General Affairs file has its own fixed layout and ignores the group filter.
    const exportItems = [
        {
            label: t("officeExportGeneralAffairs"),
            onClick: () => exportExcel((f) => GeneralAffairsReportApi.exportExcel(f.fromDate, f.toDate, f.workshopId, f.departmentId), "Du lieu tang ca", "officeExportError"),
            icon: excelIcon,
        },
        { label: t("exportHoursButton"), onClick: () => exportExcel(ProductionOtReportApi.exportHoursReportExcel, "TongGioTangCa", "exportHoursError"), icon: excelIcon },
        { label: t("exportTimesButton"), onClick: () => exportExcel(ProductionOtReportApi.exportTimesReportExcel, "SoLuotTangCa", "exportTimesError"), icon: excelIcon },
        { label: t("exportDetailButton"), onClick: () => exportExcel(ProductionOtReportApi.exportQryExportExcel, "Qry_EXPORT_EXCEL", "exportDetailError"), icon: excelIcon },
        { label: t("exportSummaryButton"), onClick: () => exportExcel(ProductionOtReportApi.exportSumExportData, "SUM_EXPORT_DATA", "exportSummaryError"), icon: excelIcon },
        { label: t("exportTicketZipButton"), onClick: handleExportTicketZip, icon: pdfIcon, disabled: !isDay, title: dayOnlyTitle },
        // Drawn from the report on screen, so it needs a day search first.
        { label: t("exportPdfButton"), onClick: handleExportPdf, icon: pdfIcon, disabled: !isDay || !report?.rows.length, title: dayOnlyTitle },
    ];

    // Old rows are hidden while a new search runs so the skeleton shows instead of stale data.
    const rows = isLoading ? [] : (report?.rows ?? []);
    const cellClassName = "px-3 py-1.5";
    const numberCellClassName = `${cellClassName} text-right tabular-nums text-[#5e3f3a]`;

    return (
        <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
            {/* Top-aligned because the group picker grows with its chips. */}
            <div className="flex flex-wrap items-start gap-2 border-b border-[#e0e3e5] px-3 py-2.5">
                <div role="radiogroup" aria-label={t("fieldDateLabel")} className="inline-flex h-9 shrink-0 rounded-lg border border-[#e0e3e5] bg-[#f2f4f6] p-0.5">
                    {(["day", "month"] as const).map((value) => (
                        <button
                            key={value}
                            type="button"
                            role="radio"
                            aria-checked={period === value}
                            onClick={() => {
                                setPeriod(value);
                                setReport(null);
                            }}
                            className={`cursor-pointer whitespace-nowrap rounded-md px-3 text-sm font-semibold transition ${
                                period === value ? "bg-white text-[#e3000f] shadow-sm" : "text-[#5e3f3a] hover:text-[#191c1e]"
                            }`}
                        >
                            {value === "day" ? t("periodDay") : t("periodMonth")}
                        </button>
                    ))}
                </div>
                <div className="flex h-9 items-center gap-1">
                    {isDay ? (
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label={t("fieldDateLabel")} className={`${fieldClassName} w-36`} />
                    ) : (
                        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} aria-label={t("periodMonth")} className={`${fieldClassName} w-36`} />
                    )}
                    <InfoTooltip text={t("searchHint")} />
                </div>
                <div className="w-44">
                    <SearchableSelect
                        options={workshops.map((w) => ({
                            value: w.id,
                            label: localName(w.workshopNameVn, w.workshopNameJp),
                            searchText: `${w.workshopNameVn} ${w.workshopNameJp ?? ""}`.toLowerCase(),
                        }))}
                        value={workshopId}
                        onChange={setWorkshopId}
                        placeholder={t("filterAllWorkshop")}
                        ariaLabel={t("fieldWorkshopLabel")}
                        triggerClassName={`${fieldClassName} w-full pr-8`}
                    />
                </div>
                <div className="w-56">
                    <SearchableSelect
                        options={departmentOptions}
                        value={departmentId}
                        onChange={setDepartmentId}
                        placeholder={t("filterAllDepartment")}
                        ariaLabel={t("fieldDepartmentLabel")}
                        triggerClassName={`${fieldClassName} w-full pr-8`}
                    />
                </div>
                <div className="w-64">
                    <MultiSelect
                        options={groups.map((g) => ({ value: g.id, label: g.nameVn ?? g.code, searchText: `${g.nameVn ?? ""} ${g.code}`.toLowerCase() }))}
                        values={groupIds}
                        onChange={setGroupIds}
                        placeholder={t("filterAllGroup")}
                        ariaLabel={t("fieldGroupLabel")}
                    />
                </div>
                <div className="flex items-center gap-1.5 sm:ml-auto">
                    {exportProgress && <span className="whitespace-nowrap text-xs text-[#5e3f3a]">{exportProgress}</span>}
                    {isDay && <IconButton icon={isLoading ? Loader2 : Search} label={t("searchButton")} onClick={handleSearch} disabled={isLoading || !date} variant="primary" />}
                    <ActionMenu
                        iconOnly
                        label={t("exportMenuLabel")}
                        icon={isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        items={exportItems}
                        disabled={isBusy || !hasPeriod}
                    />
                </div>
            </div>

            {isDay && (report || isLoading) && (
                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left text-sm">
                        <thead>
                            <tr className={theadRowClassName}>
                                <th className={cellClassName}>{t("colDepartment")}</th>
                                <th className={cellClassName}>{t("colCa")}</th>
                                <th className={cellClassName}>{t("colTeam")}</th>
                                <th className={cellClassName}>{t("colLine")}</th>
                                <th className={`${cellClassName} text-right`}>{t("colSecondary")}</th>
                                <th className={`${cellClassName} text-right`}>{t("colMain")}</th>
                                <th className={`${cellClassName} text-right`}>{t("colMilk")}</th>
                                <th className={`${cellClassName} text-right`}>{t("colHours")}</th>
                                <th className={cellClassName}>{t("colTime")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <TableStatusRows loading={isLoading} empty={rows.length === 0} columns={9} emptyText={t("noData")} />
                            {rows.map((row, index) => (
                                <tr
                                    key={`${row.congDoan}-${row.ca}-${row.team}-${row.lineCa}-${row.startTime}-${index}`}
                                    className="border-b border-[#f1f5f9] bg-white transition-colors even:bg-[#f2f4f7] hover:bg-[#e8ecf1]"
                                >
                                    <td className={`${cellClassName} text-[#191c1e]`}>{row.congDoan}</td>
                                    <td className={`${cellClassName} text-[#191c1e]`}>{row.ca}</td>
                                    <td className={`${cellClassName} text-[#191c1e]`}>{row.team}</td>
                                    <td className={`${cellClassName} text-[#191c1e]`}>{row.lineCa}</td>
                                    <td className={numberCellClassName}>{row.secondaryTicketCount}</td>
                                    <td className={numberCellClassName}>{row.mainTicketCount}</td>
                                    <td className={numberCellClassName}>{row.milkCount}</td>
                                    <td className={numberCellClassName}>{row.totalHour}</td>
                                    <td className={`${cellClassName} whitespace-nowrap tabular-nums text-[#5e3f3a]`}>
                                        {row.startTime.slice(0, 5)}–{row.endTime.slice(0, 5)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        {report && rows.length > 0 && (
                            <tfoot>
                                <tr className="border-t border-[#e0e3e5] bg-[#f8fafc] font-semibold text-[#191c1e]">
                                    <td colSpan={4} className={cellClassName}>
                                        {t("totalRow")}
                                    </td>
                                    <td className={`${cellClassName} text-right tabular-nums`}>{report.totalSecondaryTicketCount}</td>
                                    <td className={`${cellClassName} text-right tabular-nums`}>{report.totalMainTicketCount}</td>
                                    <td className={`${cellClassName} text-right tabular-nums`}>{report.totalMilkCount}</td>
                                    <td colSpan={2} />
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            )}
        </section>
    );
});

export default ProductionOtReportPanel;
