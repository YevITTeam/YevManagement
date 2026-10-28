"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { CheckCircle2, FileSpreadsheet, Loader2, Minus, Printer, QrCode, Users, XCircle, Search, Eye } from "lucide-react";

import { ServerCheckApi } from "@/modules/pc-management/api/server-check.api";
import { BranchApi } from "@/modules/pc-management/api/branch.api";
import type { BranchDto } from "@/modules/pc-management/types/branch.dto";
import type { ServerCheckManualItemDto, ServerCheckReportRowDto } from "@/modules/pc-management/types/server-check.dto";
import { WorkCalendarApi } from "@/modules/attendance/api/work-calendar.api";
import type { WorkCalendarDayDto } from "@/modules/attendance/types/work-calendar.dto";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { useDragScroll } from "@/modules/common/hooks/useDragScroll";
import ServerCheckSessionDetailDialog from "./ServerCheckSessionDetailDialog";
import ServerCheckReportPrintView, { buildDayRows, buildNote } from "./ServerCheckReportPrintView";
import { Link } from "@/navigation";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";
import { getApiErrorMessage } from "@/lib/apiError";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { StyledSelect } from "@/components/ui/StyledSelect";

const pad2 = (value: number) => String(value).padStart(2, "0");

// First and last day of the given month (month is 1-12) as yyyy-MM-dd, built without Date#toISOString to avoid UTC shifts.
const monthRange = (year: number, month: number) => {
    const lastDay = new Date(year, month, 0).getDate();
    return { from: `${year}-${pad2(month)}-01`, to: `${year}-${pad2(month)}-${pad2(lastDay)}` };
};

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);
const selectClassName =
    "h-9 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]";

const formatDate = (value: string) =>
    new Date(value).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

// NG reasons go to the "Ghi chú" column (as in the Excel sheet); the cell only keeps the icon.
function StatusCell({ status, note }: { status: boolean | null; note: string | null }) {
    if (status === null) return <Minus className="mx-auto h-4 w-4 text-[#c9ced3]" />;
    if (status) return <CheckCircle2 className="mx-auto h-4 w-4 text-[#1a7f37]" />;
    return <XCircle className="mx-auto h-4 w-4 text-[#930006]" aria-label={note ?? undefined} />;
}

// Marks the warning-light columns (Server/Network/UPS) checked by QR scan; manual items are ticked by hand.
function QrMark({ label }: { label: string }) {
    return <QrCode className="mx-auto mt-1 h-3.5 w-3.5 text-[#5e3f3a]" aria-label={label} />;
}

const cell = "border-b border-[#f1f5f9] px-3 py-2.5 group-hover:bg-[#f8fafc]";
const headCell ="border-b border-r border-[#e0e3e5] px-3 py-2 align-middle";

export default function ServerCheckReportPage() {
    const t = useTranslations("Asset.ServerCheck");
    const tCommon = useTranslations("Common");

    const [now] = useState(() => new Date());
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const { from: fromDate, to: toDate } = monthRange(year, month);
    const years = Array.from({ length: 6 }, (_, index) => now.getFullYear() - index);
    const [rows, setRows] = useState<ServerCheckReportRowDto[]>([]);
    const [manualColumns, setManualColumns] = useState<ServerCheckManualItemDto[]>([]);
    const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [branches, setBranches] = useState<BranchDto[]>([]);
    const [branchId, setBranchId] = useState<number | null>(null);
    const [tableScrollRef, onTableScrollMouseDown] = useDragScroll<HTMLDivElement>();
    const { user } = useAuth();
    const canScan = hasPermission(user, "Asset.ServerCheck.Scan");
    const canAssign = hasPermission(user, "Asset.ServerCheck.Assign");

    // Mỗi xưởng có phiên + tờ check sheet riêng (asset-module.md §1.21) nên báo cáo luôn lọc theo ĐÚNG
    // 1 xưởng — mặc định xưởng đầu tiên trong danh sách, không có lựa chọn "tất cả" (sẽ trộn nhiều xưởng
    // cùng ngày vào 1 tờ).
    useFetchEffect(
        () => BranchApi.getAllBranches(),
        [],
        (result) => {
            setBranches(result);
            setBranchId((current) => current ?? result[0]?.id ?? null);
        },
        t("loadReportError"),
        (message) => toast.error(message)
    );

    const { isLoading, error, refetch } = useFetchEffect(
        () => (branchId === null ? Promise.resolve(null) : ServerCheckApi.getReport(fromDate, toDate, branchId)),
        [fromDate, toDate, branchId],
        (result) => setRows(result ?? []),
        t("loadReportError"),
        (message) => toast.error(message)
    );

    // Danh sách mục thủ công CỐ ĐỊNH lấy từ /manual-items (luôn là danh sách đang active mới nhất) —
    // KHÔNG được dựng cột từ rows[0].manualResults như trước: mỗi phiên chỉ lưu đúng số mục đang active
    // lúc phiên đó "Kết thúc" (BE chỉ ghi ServerCheckManualResult cho activeManualItemIds tại thời điểm
    // End), nên phiên cũ (trước khi thêm 3 mục Backup) có 4 cột còn phiên mới có 7 cột — dùng rows[0] làm
    // chuẩn khiến các dòng khác số cột bị lệch hẳn so với header (đúng lỗi giao diện đã gặp thực tế).
    useFetchEffect(
        () => ServerCheckApi.getManualItems(),
        [],
        // "Máy lạnh" đã có cột riêng (airConditionerStatus) nên không lặp lại trong cột mục thủ công.
        (result) => setManualColumns(result.filter((m) => !m.isAirConditioner).sort((a, b) => a.displayOrder - b.displayOrder)),
        t("loadReportError"),
        (message) => toast.error(message)
    );

    // A year with no calendar rows imported falls back to Sundays only, same rule as the attendance module.
    const [calendarDays, setCalendarDays] = useState<WorkCalendarDayDto[]>([]);
    useFetchEffect(
        () => WorkCalendarApi.getByYear(year),
        [year],
        setCalendarDays,
        t("loadReportError"),
        (message) => toast.error(message)
    );
    const isOffDay = (day: string) =>
        calendarDays.length > 0 ? calendarDays.some((d) => d.date.slice(0, 10) === day) : new Date(`${day}T00:00:00Z`).getUTCDay() === 0;

    // First manual item (ambient sound/smell/temperature) sits under "Phòng Server", the rest under "Các kiểm tra khác" — same split as the print sheet.
    const [ambientColumn, ...otherColumns] = manualColumns;
    const dayRows = rows.length > 0 ? buildDayRows(rows, fromDate, toDate) : [];
    const totalColumns = 1 /* Ngày */ + 4 /* category */ + manualColumns.length + 3 /* Người kiểm, Ghi chú, Thao tác */;

    const handleExportExcel = async () => {
        setIsExporting(true);
        try {
            const { blob, fileName } = await ServerCheckApi.exportReport(fromDate, toDate, branchId ?? undefined);
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName ?? `CheckSheet_KiemTraServer_${fromDate}_${toDate}.xlsx`;
            link.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            toast.error(getApiErrorMessage(err, t("exportExcelError")));
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 print:hidden md:flex-row md:items-center md:justify-between">
                <h1 className="whitespace-nowrap text-xl font-semibold text-[#191c1e]">{t("reportTitle")}</h1>
                {/* Below 2xl the three text buttons collapse to icons so the toolbar stays on one row. */}
                <div className="flex flex-wrap items-center gap-2 md:flex-nowrap">
                    {canScan && (
                        <Link
                            href="/pc/server-check/scan"
                            title={t("startButton")}
                            className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-2.5 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] 2xl:px-4"
                        >
                            <QrCode className="h-3.5 w-3.5" /> <span className="hidden 2xl:inline">{t("startButton")}</span>
                        </Link>
                    )}
                    {canAssign && (
                        <Link
                            href="/pc/server-check/assignments"
                            title={t("assignmentsButton")}
                            className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-2.5 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] 2xl:px-4"
                        >
                            <Users className="h-3.5 w-3.5" /> <span className="hidden 2xl:inline">{t("assignmentsButton")}</span>
                        </Link>
                    )}
                    <SearchableSelect
                        value={branchId ?? ""}
                        onChange={(v) => setBranchId(v === "" ? null : v)}
                        placeholder={t("branchFilterLabel")}
                        triggerClassName="h-9 w-32 rounded-lg border border-[#e0e3e5] bg-white px-3 pr-9 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                        options={branches.map((branch) => ({ value: branch.id, label: branch.branchName, searchText: branch.branchName.toLowerCase() }))}
                    />
                    <StyledSelect
                        value={month}
                        onChange={setMonth}
                        ariaLabel={t("monthFilterLabel")}
                        triggerClassName={`${selectClassName} pr-9`}
                        options={MONTHS.map((m) => ({ value: m, label: t("monthOption", { month: m }) }))}
                    />
                    <StyledSelect
                        value={year}
                        onChange={setYear}
                        ariaLabel={t("yearFilterLabel")}
                        triggerClassName={`${selectClassName} pr-9`}
                        options={years.map((y) => ({ value: y, label: String(y) }))}
                    />
                    <button
                        onClick={() => refetch()}
                        disabled={isLoading}
                        title={tCommon("search")}
                        aria-label={tCommon("search")}
                        className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50 inline-flex h-9 w-9 shrink-0 items-center justify-center"
                    >
                        <Search className="h-4 w-4" />
                    </button>
                    <button
                        onClick={handleExportExcel}
                        disabled={isExporting}
                        title={t("exportExcelButton")}
                        className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-2.5 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50 2xl:px-4"
                    >
                        {isExporting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <FileSpreadsheet className="h-3.5 w-3.5" />
                        )}
                        <span className="hidden 2xl:inline">{t("exportExcelButton")}</span>
                    </button>
                    <button
                        onClick={() => window.print()}
                        title={t("printButton")}
                        className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-[#e3000f] px-2.5 text-sm font-semibold text-white transition hover:bg-[#b40009] 2xl:px-4"
                    >
                        <Printer className="h-3.5 w-3.5" /> <span className="hidden 2xl:inline">{t("printButton")}</span>
                    </button>
                </div>
            </div>

            {error && <div className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>}

            {/* Bảng tương tác này chỉ để XEM trên màn hình (cột "Ngày" sticky, nút "Xem chi tiết"...) —
                khi in dùng hẳn ServerCheckReportPrintView bên dưới, khớp đúng layout tờ giấy gốc thay vì
                in nguyên bảng này (trước đây thiếu print:hidden nên vừa lộ cả Sidebar vừa in sai layout). */}
            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm print:hidden">
                <div ref={tableScrollRef} onMouseDown={onTableScrollMouseDown} className="cursor-grab overflow-x-auto">
                    <table className="w-full border-separate border-spacing-0 text-center text-sm">
                        <thead className="bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.06em] text-[#5e3f3a]">
                            <tr>
                                <th rowSpan={3} className={`sticky left-0 z-10 min-w-[110px] bg-[#f8fafc] text-left ${headCell}`}>
                                    {t("colDate")}
                                </th>
                                <th colSpan={4 + (ambientColumn ? 1 : 0)} className={headCell}>{t("groupServerRoom")}</th>
                                {otherColumns.length > 0 && <th colSpan={otherColumns.length} className={headCell}>{t("groupOtherChecks")}</th>}
                                <th rowSpan={3} className={`min-w-[140px] ${headCell}`}>{t("colCheckedBy")}</th>
                                <th rowSpan={3} className={`min-w-[200px] ${headCell}`}>{t("colNote")}</th>
                                <th rowSpan={3} className={`min-w-[70px] border-r-0 ${headCell}`}>{tCommon("actions")}</th>
                            </tr>
                            <tr>
                                <th colSpan={3} className={headCell}>{t("groupWarningLights")}</th>
                                <th rowSpan={2} className={`min-w-[80px] ${headCell}`}>{t("categoryAirConditioner")}</th>
                                {ambientColumn && (
                                    <th rowSpan={2} className={`min-w-[130px] whitespace-normal leading-snug ${headCell}`}>{ambientColumn.name}</th>
                                )}
                                {otherColumns.map((col) => (
                                    <th key={col.id} rowSpan={2} className={`min-w-[110px] whitespace-normal leading-snug ${headCell}`}>
                                        {col.name}
                                    </th>
                                ))}
                            </tr>
                            <tr>
                                <th className={`min-w-[80px] ${headCell}`}>
                                    {t("categoryServer")}
                                    <QrMark label={t("scanQrHint")} />
                                </th>
                                <th className={`min-w-[80px] ${headCell}`}>
                                    {t("categoryNetwork")}
                                    <QrMark label={t("scanQrHint")} />
                                </th>
                                <th className={`min-w-[80px] ${headCell}`}>
                                    {t("categoryUps")}
                                    <QrMark label={t("scanQrHint")} />
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading && (
                                <tr>
                                    <td colSpan={totalColumns} className="px-4 py-8 text-center text-sm text-[#5e3f3a]">
                                        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                                    </td>
                                </tr>
                            )}
                            {!isLoading && rows.length === 0 && (
                                <tr>
                                    <td colSpan={totalColumns} className="px-4 py-8 text-center text-sm text-[#5e3f3a]">
                                        {t("noReportData")}
                                    </td>
                                </tr>
                            )}
                            {dayRows.map(({ key, day, row }) => (
                                <tr key={key} className="group">
                                    <td className="sticky left-0 z-10 border-b border-r border-[#f1f5f9] bg-white px-4 py-2.5 text-left font-semibold text-[#191c1e] group-hover:bg-[#f8fafc]">
                                        {formatDate(day)}
                                    </td>
                                    {row ? (
                                        <>
                                            <td className={cell}><StatusCell status={row.serverStatus} note={row.serverNote} /></td>
                                            <td className={cell}><StatusCell status={row.networkStatus} note={row.networkNote} /></td>
                                            <td className={cell}><StatusCell status={row.upsStatus} note={row.upsNote} /></td>
                                            <td className={cell}><StatusCell status={row.airConditionerStatus} note={row.airConditionerNote} /></td>
                                            {manualColumns.map((col) => {
                                                // Old sessions may lack a row for items seeded later; show a dash instead of dropping the cell.
                                                const match = row.manualResults.find((m) => m.manualItemId === col.id);
                                                return (
                                                    <td key={col.id} className={cell}>
                                                        <StatusCell
                                                            status={row.sessionStatus === 1 && match ? match.status === 1 : null}
                                                            note={match?.note ?? null}
                                                        />
                                                    </td>
                                                );
                                            })}
                                        </>
                                    ) : (
                                        <td colSpan={4 + manualColumns.length} className={cell} />
                                    )}
                                    <td className={`${cell} text-[#5e3f3a]`}>{row?.checkedBy ?? ""}</td>
                                    <td className={`${cell} text-left text-xs text-[#930006]`}>{row ? buildNote(row) : ""}</td>
                                    <td className={cell}>
                                        {row && (
                                            <button
                                                onClick={() => setSelectedSessionId(row.sessionId)}
                                                className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border transition border-[#e0e3e5] text-[#5e3f3a] hover:bg-[#f2f4f6] hover:text-[#191c1e]"
                                                title={tCommon("viewDetail")}
                                                aria-label={tCommon("viewDetail")}
                                            >
                                                <Eye className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <ServerCheckReportPrintView
                rows={rows}
                manualColumns={manualColumns}
                fromDate={fromDate}
                toDate={toDate}
                branchName={branches.find((b) => b.id === branchId)?.branchName ?? null}
                isOffDay={isOffDay}
            />

            <ServerCheckSessionDetailDialog sessionId={selectedSessionId} onClose={() => setSelectedSessionId(null)} />
        </div>
    );
}
