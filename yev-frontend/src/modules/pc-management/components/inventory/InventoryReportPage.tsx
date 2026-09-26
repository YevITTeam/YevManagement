"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { ClipboardCheck, FileDown, FileSpreadsheet, Loader2, Users, Search, Eye } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { InventoryApi } from "@/modules/pc-management/api/inventory.api";
import { BranchApi } from "@/modules/pc-management/api/branch.api";
import type { BranchDto } from "@/modules/pc-management/types/branch.dto";
import type { InventoryReportRowDto } from "@/modules/pc-management/types/inventory.dto";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";
import { getApiErrorMessage } from "@/lib/apiError";
import { ROBOTO_REGULAR_BASE64, ROBOTO_BOLD_BASE64 } from "@/modules/pc-management/lib/pdf-fonts";
import { Link } from "@/navigation";
import InventorySessionDetailDialog from "./InventorySessionDetailDialog";

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);

const startOfThisMonth = () => {
    const now = new Date();
    return toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1));
};

const formatDateTime = (value: string | null) =>
    value === null ? "—" : new Date(value).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

// Font mặc định của jsPDF (Helvetica) không có dấu tiếng Việt — nhúng font Roboto qua VFS, dùng chung
// file với ProductionOtReportPanel.tsx/DeviceListReportPrintDialog.tsx (CLAUDE.md §4.8: PDF mới phải
// vẽ thẳng bằng jspdf, không chụp DOM).
function registerVietnameseFont(doc: jsPDF) {
    doc.addFileToVFS("Roboto-Regular.ttf", ROBOTO_REGULAR_BASE64);
    doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
    doc.addFileToVFS("Roboto-Bold.ttf", ROBOTO_BOLD_BASE64);
    doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
    doc.setFont("Roboto", "normal");
}

function buildReportPdf(rows: InventoryReportRowDto[], fromDate: string, toDate: string) {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    registerVietnameseFont(doc);

    doc.setFont("Roboto", "bold");
    doc.setFontSize(14);
    doc.text("BÁO CÁO KIỂM KÊ THIẾT BỊ", 14, 15);
    doc.setFont("Roboto", "normal");
    doc.setFontSize(10);
    doc.text(`Từ ${fromDate.split("-").reverse().join("/")} đến ${toDate.split("-").reverse().join("/")}`, 14, 21);

    autoTable(doc, {
        startY: 26,
        theme: "grid",
        styles: { font: "Roboto", fontStyle: "normal", fontSize: 8.5, cellPadding: 1.8 },
        headStyles: { font: "Roboto", fontStyle: "bold", fillColor: [227, 0, 15], textColor: [255, 255, 255] },
        head: [["Xưởng", "Bắt đầu", "Kết thúc", "Trạng thái", "Tổng số", "Đã kiểm kê", "Thiếu", "Người kết thúc", "Thiết bị thiếu"]],
        body: rows.map((row) => [
            row.branchName ?? "",
            formatDateTime(row.startedAt),
            formatDateTime(row.endedAt),
            row.statusText,
            row.totalCount,
            row.foundCount,
            row.missingCount,
            row.checkedBy ?? "",
            row.missingItems.map((m) => (m.note ? `${m.deviceCode} - ${m.deviceName}: ${m.note}` : `${m.deviceCode} - ${m.deviceName}`)).join("; "),
        ]),
    });

    doc.save(`KiemKeThietBi_${fromDate.replace(/-/g, "")}-${toDate.replace(/-/g, "")}.pdf`);
}

export default function InventoryReportPage() {
    const t = useTranslations("Asset.Inventory");
    const tCommon = useTranslations("Common");

    const [fromDate, setFromDate] = useState(startOfThisMonth());
    const [toDate, setToDate] = useState(toIsoDate(new Date()));
    const [rows, setRows] = useState<InventoryReportRowDto[]>([]);
    const [branches, setBranches] = useState<BranchDto[]>([]);
    const [branchId, setBranchId] = useState<number | null>(null);
    const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
    const [isExportingExcel, setIsExportingExcel] = useState(false);
    const { user } = useAuth();
    const canScan = hasPermission(user, "Asset.Inventory.Scan");
    const canAssign = hasPermission(user, "Asset.Inventory.Assign");

    useFetchEffect(
        () => BranchApi.getAllBranches(),
        [],
        (result) => setBranches(result),
        t("loadReportError"),
        (message) => toast.error(message)
    );

    const { isLoading, error, refetch } = useFetchEffect(
        () => InventoryApi.getReport(fromDate, toDate, branchId ?? undefined),
        [fromDate, toDate, branchId],
        (result) => setRows(result),
        t("loadReportError"),
        (message) => toast.error(message)
    );

    const handleExportExcel = async () => {
        setIsExportingExcel(true);
        try {
            const { blob, fileName } = await InventoryApi.exportReport(fromDate, toDate, branchId ?? undefined);
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName ?? `KiemKeThietBi_${fromDate}_${toDate}.xlsx`;
            link.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            toast.error(getApiErrorMessage(err, t("exportExcelError")));
        } finally {
            setIsExportingExcel(false);
        }
    };

    const handleExportPdf = () => {
        if (rows.length === 0) {
            toast.error(t("noReportData"));
            return;
        }
        buildReportPdf(rows, fromDate, toDate);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-[#191c1e]">{t("reportTitle")}</h1>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {canScan && (
                        <Link
                            href="/pc/inventory/scan"
                            className="flex h-9 items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-4 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                        >
                            <ClipboardCheck className="h-3.5 w-3.5" /> {t("startButton")}
                        </Link>
                    )}
                    {canAssign && (
                        <Link
                            href="/pc/inventory/assignments"
                            className="flex h-9 items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-4 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                        >
                            <Users className="h-3.5 w-3.5" /> {t("assignmentsButton")}
                        </Link>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#e0e3e5] bg-white p-4 shadow-sm">
                <select
                    value={branchId ?? ""}
                    onChange={(event) => setBranchId(event.target.value ? Number(event.target.value) : null)}
                    aria-label={t("branchFilterLabel")}
                    className="h-9 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                >
                    <option value="">{t("allBranchesOption")}</option>
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
                <div className="ml-auto flex flex-wrap items-center gap-2">
                    <button
                        onClick={handleExportExcel}
                        disabled={isExportingExcel}
                        className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-4 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isExportingExcel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
                        {t("exportExcelButton")}
                    </button>
                    <button
                        onClick={handleExportPdf}
                        className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-[#e3000f] px-4 text-sm font-semibold text-white transition hover:bg-[#b40009]"
                    >
                        <FileDown className="h-3.5 w-3.5" /> {t("exportPdfButton")}
                    </button>
                </div>
            </div>

            {error && <div className="rounded-lg border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>}

            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.06em] text-[#5e3f3a]">
                                <th className="border-b border-[#e0e3e5] px-4 py-3">{t("colBranch")}</th>
                                <th className="border-b border-[#e0e3e5] px-4 py-3">{t("colStarted")}</th>
                                <th className="border-b border-[#e0e3e5] px-4 py-3">{t("colEnded")}</th>
                                <th className="border-b border-[#e0e3e5] px-4 py-3">{t("colStatus")}</th>
                                <th className="border-b border-[#e0e3e5] px-4 py-3 text-right">{t("colTotal")}</th>
                                <th className="border-b border-[#e0e3e5] px-4 py-3 text-right">{t("colFound")}</th>
                                <th className="border-b border-[#e0e3e5] px-4 py-3 text-right">{t("colMissing")}</th>
                                <th className="border-b border-[#e0e3e5] px-4 py-3">{t("colCheckedBy")}</th>
                                <th className="border-b border-[#e0e3e5] px-4 py-3">{tCommon("actions")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading && (
                                <tr>
                                    <td colSpan={9} className="px-4 py-8 text-center text-sm text-[#5e3f3a]">
                                        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                                    </td>
                                </tr>
                            )}
                            {!isLoading && rows.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="px-4 py-8 text-center text-sm text-[#5e3f3a]">{t("noReportData")}</td>
                                </tr>
                            )}
                            {rows.map((row) => (
                                <tr key={row.sessionId} className="border-b border-[#f1f5f9] last:border-0 bg-white even:bg-[#f2f4f7] hover:bg-[#e8ecf1]">
                                    <td className="px-4 py-3 font-semibold text-[#191c1e]">{row.branchName}</td>
                                    <td className="px-4 py-3 text-[#5e3f3a]">{formatDateTime(row.startedAt)}</td>
                                    <td className="px-4 py-3 text-[#5e3f3a]">{formatDateTime(row.endedAt)}</td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${row.status === 1 ? "bg-[#e6f4ea] text-[#1a7f37]" : "bg-[#fff4f2] text-[#e3000f]"
                                                }`}
                                        >
                                            {row.statusText}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-[#191c1e]">{row.totalCount}</td>
                                    <td className="px-4 py-3 text-right text-[#1a7f37]">{row.foundCount}</td>
                                    <td className="px-4 py-3 text-right text-[#930006]">{row.missingCount}</td>
                                    <td className="px-4 py-3 text-[#5e3f3a]">{row.checkedBy ?? "—"}</td>
                                    <td className="px-4 py-3">
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

            <InventorySessionDetailDialog sessionId={selectedSessionId} onClose={() => setSelectedSessionId(null)} />
        </div>
    );
}
