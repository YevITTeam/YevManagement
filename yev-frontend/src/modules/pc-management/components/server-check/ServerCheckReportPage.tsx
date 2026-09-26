"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { CheckCircle2, FileSpreadsheet, Loader2, Minus, Printer, QrCode, Users, XCircle, Search, Eye } from "lucide-react";

import { ServerCheckApi } from "@/modules/pc-management/api/server-check.api";
import { BranchApi } from "@/modules/pc-management/api/branch.api";
import type { BranchDto } from "@/modules/pc-management/types/branch.dto";
import type { ServerCheckManualItemDto, ServerCheckReportRowDto } from "@/modules/pc-management/types/server-check.dto";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import ServerCheckSessionDetailDialog from "./ServerCheckSessionDetailDialog";
import ServerCheckReportPrintView from "./ServerCheckReportPrintView";
import { Link } from "@/navigation";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";
import { getApiErrorMessage } from "@/lib/apiError";

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);

const startOfThisMonth = () => {
    const now = new Date();
    return toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1));
};

const formatDate = (value: string) =>
    new Date(value).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

function StatusCell({ status, note }: { status: boolean | null; note: string | null }) {
    if (status === null) return <Minus className="mx-auto h-4 w-4 text-[#c9ced3]" />;
    if (status) return <CheckCircle2 className="mx-auto h-4 w-4 text-[#1a7f37]" />;
    return (
        <div className="flex flex-col items-center gap-1" title={note ?? undefined}>
            <XCircle className="h-4 w-4 shrink-0 text-[#930006]" />
            {note && (
                <span className="block max-w-[9rem] truncate text-[11px] leading-tight text-[#930006]">{note}</span>
            )}
        </div>
    );
}

export default function ServerCheckReportPage() {
    const t = useTranslations("Asset.ServerCheck");
    const tCommon = useTranslations("Common");

    const [fromDate, setFromDate] = useState(startOfThisMonth());
    const [toDate, setToDate] = useState(toIsoDate(new Date()));
    const [rows, setRows] = useState<ServerCheckReportRowDto[]>([]);
    const [manualColumns, setManualColumns] = useState<ServerCheckManualItemDto[]>([]);
    const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [branches, setBranches] = useState<BranchDto[]>([]);
    const [branchId, setBranchId] = useState<number | null>(null);
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
        (result) => setManualColumns([...result].sort((a, b) => a.displayOrder - b.displayOrder)),
        t("loadReportError"),
        (message) => toast.error(message)
    );

    const totalColumns = 1 /* Ngày */ + 4 /* category */ + manualColumns.length + 1 /* Người kiểm */ + 1 /* Thao tác */;

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
                <div>
                    <h1 className="text-2xl font-semibold text-[#191c1e]">{t("reportTitle")}</h1>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {canScan && (
                        <Link
                            href="/pc/server-check/scan"
                            className="flex h-9 items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-4 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                        >
                            <QrCode className="h-3.5 w-3.5" /> {t("startButton")}
                        </Link>
                    )}
                    {canAssign && (
                        <Link
                            href="/pc/server-check/assignments"
                            className="flex h-9 items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-4 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                        >
                            <Users className="h-3.5 w-3.5" /> {t("assignmentsButton")}
                        </Link>
                    )}
                    <select
                        value={branchId ?? ""}
                        onChange={(event) => setBranchId(event.target.value ? Number(event.target.value) : null)}
                        aria-label={t("branchFilterLabel")}
                        className="h-9 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                    >
                        {branches.map((branch) => (
                            <option key={branch.id} value={branch.id}>{branch.branchName}</option>
                        ))}
                    </select>
                    <input
                        type="date"
                        value={fromDate}
                        onChange={(event) => setFromDate(event.target.value)}
                        className="h-9 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                    />
                    <span className="text-sm text-[#5e3f3a]">{tCommon("to")}</span>
                    <input
                        type="date"
                        value={toDate}
                        onChange={(event) => setToDate(event.target.value)}
                        className="h-9 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
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
                        className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-4 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isExporting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <FileSpreadsheet className="h-3.5 w-3.5" />
                        )}
                        {t("exportExcelButton")}
                    </button>
                    <button
                        onClick={() => window.print()}
                        className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-[#e3000f] px-4 text-sm font-semibold text-white transition hover:bg-[#b40009]"
                    >
                        <Printer className="h-3.5 w-3.5" /> {t("printButton")}
                    </button>
                </div>
            </div>

            {error && <div className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>}

            {/* Bảng tương tác này chỉ để XEM trên màn hình (cột "Ngày" sticky, nút "Xem chi tiết"...) —
                khi in dùng hẳn ServerCheckReportPrintView bên dưới, khớp đúng layout tờ giấy gốc thay vì
                in nguyên bảng này (trước đây thiếu print:hidden nên vừa lộ cả Sidebar vừa in sai layout). */}
            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm print:hidden">
                <div className="overflow-x-auto">
                    <table className="w-full border-separate border-spacing-0 text-center text-sm">
                        <thead>
                            <tr className="bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.06em] text-[#5e3f3a]">
                                <th className="sticky left-0 z-10 min-w-[110px] border-b border-r border-[#e0e3e5] bg-[#f8fafc] px-4 py-3 text-left">
                                    {t("colDate")}
                                </th>
                                <th className="min-w-[90px] border-b border-[#e0e3e5] px-3 py-3">{t("categoryServer")}</th>
                                <th className="min-w-[90px] border-b border-[#e0e3e5] px-3 py-3">{t("categoryNetwork")}</th>
                                <th className="min-w-[90px] border-b border-[#e0e3e5] px-3 py-3">{t("categoryUps")}</th>
                                <th className="min-w-[90px] border-b border-[#e0e3e5] px-3 py-3">{t("categoryAirConditioner")}</th>
                                {manualColumns.map((col) => (
                                    <th
                                        key={col.id}
                                        className="min-w-[130px] whitespace-normal border-b border-[#e0e3e5] px-3 py-3 align-bottom leading-snug"
                                    >
                                        {col.name}
                                    </th>
                                ))}
                                <th className="min-w-[150px] border-b border-[#e0e3e5] px-3 py-3">{t("colCheckedBy")}</th>
                                <th className="min-w-[90px] border-b border-[#e0e3e5] px-3 py-3 print:hidden">{tCommon("actions")}</th>
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
                            {rows.map((row) => (
                                <tr key={row.sessionId} className="group">
                                    <td className="sticky left-0 z-10 border-b border-r border-[#f1f5f9] bg-white px-4 py-3 text-left font-semibold text-[#191c1e] group-hover:bg-[#f8fafc]">
                                        {formatDate(row.checkDate)}
                                    </td>
                                    <td className="border-b border-[#f1f5f9] px-3 py-3 group-hover:bg-[#f8fafc]">
                                        <StatusCell status={row.serverStatus} note={row.serverNote} />
                                    </td>
                                    <td className="border-b border-[#f1f5f9] px-3 py-3 group-hover:bg-[#f8fafc]">
                                        <StatusCell status={row.networkStatus} note={row.networkNote} />
                                    </td>
                                    <td className="border-b border-[#f1f5f9] px-3 py-3 group-hover:bg-[#f8fafc]">
                                        <StatusCell status={row.upsStatus} note={row.upsNote} />
                                    </td>
                                    <td className="border-b border-[#f1f5f9] px-3 py-3 group-hover:bg-[#f8fafc]">
                                        <StatusCell status={row.airConditionerStatus} note={row.airConditionerNote} />
                                    </td>
                                    {manualColumns.map((col) => {
                                        // Phiên cũ có thể chưa có dòng cho mục này (được seed thêm sau) — coi như
                                        // "chưa áp dụng lúc đó" (dấu gạch ngang), KHÔNG bỏ ô để tránh lệch cột.
                                        const match = row.manualResults.find((m) => m.manualItemId === col.id);
                                        return (
                                            <td key={col.id} className="border-b border-[#f1f5f9] px-3 py-3 group-hover:bg-[#f8fafc]">
                                                <StatusCell
                                                    status={row.sessionStatus === 1 && match ? match.status === 1 : null}
                                                    note={match?.note ?? null}
                                                />
                                            </td>
                                        );
                                    })}
                                    <td className="border-b border-[#f1f5f9] px-3 py-3 text-[#5e3f3a] group-hover:bg-[#f8fafc]">
                                        {row.checkedBy ?? "—"}
                                    </td>
                                    <td className="border-b border-[#f1f5f9] px-3 py-3 group-hover:bg-[#f8fafc] print:hidden">
                                        <button
                                            onClick={() => setSelectedSessionId(row.sessionId)}
                                            className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border transition disabled:cursor-not-allowed disabled:opacity-40 border-[#e0e3e5] text-[#5e3f3a] hover:bg-[#f2f4f6] hover:text-[#191c1e]"
                                            title={tCommon("viewDetail")}
                                            aria-label={tCommon("viewDetail")}
                                        >
                                            <Eye className="h-3.5 w-3.5" />
                                        </button>
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
            />

            <ServerCheckSessionDetailDialog sessionId={selectedSessionId} onClose={() => setSelectedSessionId(null)} />
        </div>
    );
}
