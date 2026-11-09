"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import {
    Building2,
    Calendar,
    CheckCircle2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Circle,
    ClipboardCheck,
    ClipboardList,
    FileDown,
    FileSpreadsheet,
    Loader2,
    PackageSearch,
    RefreshCw,
    Search,
    Users,
    X,
    XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { InventoryApi } from "@/modules/pc-management/api/inventory.api";
import { BranchApi } from "@/modules/pc-management/api/branch.api";
import type { BranchDto } from "@/modules/pc-management/types/branch.dto";
import type { InventorySessionDto, InventorySessionItemDto } from "@/modules/pc-management/types/inventory.dto";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";
import { getApiErrorMessage } from "@/lib/apiError";
import { ROBOTO_REGULAR_BASE64, ROBOTO_BOLD_BASE64 } from "@/modules/pc-management/lib/pdf-fonts";
import { Link } from "@/navigation";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

type StatusFilter = "all" | "found" | "pending" | "missing";

const formatDateTime = (value: string | null) =>
    value === null ? "—" : new Date(value).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const location = (item: InventorySessionItemDto) => [item.groupName, item.departmentName].filter(Boolean).join(" / ");

// jsPDF's default Helvetica lacks Vietnamese glyphs, so Roboto is embedded via VFS (same file as other PDF exports).
function registerVietnameseFont(doc: jsPDF) {
    doc.addFileToVFS("Roboto-Regular.ttf", ROBOTO_REGULAR_BASE64);
    doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
    doc.addFileToVFS("Roboto-Bold.ttf", ROBOTO_BOLD_BASE64);
    doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
    doc.setFont("Roboto", "normal");
}

function buildReportPdf(session: InventorySessionDto, items: InventorySessionItemDto[]) {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    registerVietnameseFont(doc);

    doc.setFont("Roboto", "bold");
    doc.setFontSize(14);
    doc.text(`BÁO CÁO KIỂM KÊ THIẾT BỊ - ${session.branchName ?? ""}`, 14, 15);
    doc.setFont("Roboto", "normal");
    doc.setFontSize(10);
    doc.text(
        `Bắt đầu: ${formatDateTime(session.startedAt)}${session.endedAt ? ` - Kết thúc: ${formatDateTime(session.endedAt)}` : ""} - ${session.statusText}`,
        14,
        21
    );
    doc.text(`Tổng: ${session.totalCount} - Đã kiểm: ${session.foundCount} - Thiếu: ${session.missingCount}`, 14, 26);

    autoTable(doc, {
        startY: 30,
        theme: "grid",
        styles: { font: "Roboto", fontStyle: "normal", fontSize: 7.5, cellPadding: 1.5 },
        headStyles: { font: "Roboto", fontStyle: "bold", fillColor: [227, 0, 15], textColor: [255, 255, 255] },
        head: [["STT", "Mã máy", "Tên thiết bị", "Loại", "Người quản lý", "Vị trí", "Serial", "Trạng thái", "Người kiểm", "Thời điểm kiểm", "Ghi chú"]],
        body: items.map((item, index) => [
            index + 1,
            item.deviceCode,
            item.deviceName,
            item.deviceTypeName ?? "",
            item.manager ?? "",
            location(item),
            item.serialNumber ?? "",
            item.statusText,
            item.scannedBy ?? "",
            item.scannedAt ? formatDateTime(item.scannedAt) : "",
            item.note ?? "",
        ]),
    });

    doc.save(`KiemKeThietBi_${(session.branchName ?? "").replace(/\s+/g, "")}_${session.startedAt.slice(0, 10).replace(/-/g, "")}.pdf`);
}

// BE statusText is too long for the narrow badge; use the same short labels as the status filter above.
function StatusBadge({ item, label }: { item: InventorySessionItemDto; label: string }) {
    const style =
        item.status === 1
            ? { icon: <CheckCircle2 className="h-3.5 w-3.5" />, className: "bg-[#e6f4ea] text-[#1a7f37]" }
            : item.status === 2
                ? { icon: <XCircle className="h-3.5 w-3.5" />, className: "bg-[#fff4f2] text-[#930006]" }
                : { icon: <Circle className="h-3.5 w-3.5" />, className: "bg-[#f2f4f6] text-[#5e3f3a]" };
    return (
        <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.className}`}>
            {style.icon} {label}
        </span>
    );
}

export default function InventoryReportPage() {
    const t = useTranslations("Asset.Inventory");
    const tCommon = useTranslations("Common");

    const [branches, setBranches] = useState<BranchDto[]>([]);
    const [branchId, setBranchId] = useState<number | null>(null);
    const [sessionId, setSessionId] = useState<number | null>(null);
    const [session, setSession] = useState<InventorySessionDto | null>(null);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [keyword, setKeyword] = useState("");
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

    // Auto-picks the latest session on branch filter change; SessionPickerField picks a specific one.
    useFetchEffect(
        () => InventoryApi.getPageNation({ pageIndex: 1, pageSize: 1, branchId: branchId ?? undefined }),
        [branchId],
        (result) => setSessionId(result.data[0]?.id ?? null),
        t("loadReportError"),
        (message) => toast.error(message)
    );

    const { isLoading: isLoadingItems, refetch: refetchSession } = useFetchEffect(
        () => (sessionId === null ? Promise.resolve(null) : InventoryApi.getById(sessionId)),
        [sessionId],
        (result) => setSession(result),
        t("loadReportError"),
        (message) => toast.error(message)
    );

    // Optimistic: show the summary from the picked row while GET /{id} loads the items.
    const handleSelectSession = (picked: InventorySessionDto) => {
        setSession(picked);
        setSessionId(picked.id);
    };

    const normalizedKeyword = keyword.trim().toLowerCase();
    const visibleItems = (sessionId === null ? [] : session?.items ?? []).filter((item) => {
        if (statusFilter === "found" && item.status !== 1) return false;
        if (statusFilter === "pending" && item.status !== 0) return false;
        if (statusFilter === "missing" && item.status !== 2) return false;
        if (!normalizedKeyword) return true;
        return `${item.deviceCode} ${item.deviceName} ${item.manager ?? ""} ${item.serialNumber ?? ""}`.toLowerCase().includes(normalizedKeyword);
    });

    const handleExportExcel = async () => {
        if (session === null) return;
        setIsExportingExcel(true);
        try {
            const { blob, fileName } = await InventoryApi.exportSession(session.id);
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName ?? `KiemKeThietBi_${session.id}.xlsx`;
            link.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            toast.error(getApiErrorMessage(err, t("exportExcelError")));
        } finally {
            setIsExportingExcel(false);
        }
    };

    const handleExportPdf = () => {
        if (session === null || visibleItems.length === 0) {
            toast.error(t("noReportData"));
            return;
        }
        buildReportPdf(session, visibleItems);
    };

    const summary: { label: string; value: number; icon: LucideIcon; iconClassName: string; valueClassName: string }[] = session
        ? [
            { label: t("summaryTotal"), value: session.totalCount, icon: ClipboardList, iconClassName: "bg-[#f2f4f6] text-[#5e3f3a]", valueClassName: "text-[#191c1e]" },
            { label: t("summaryFound"), value: session.foundCount, icon: CheckCircle2, iconClassName: "bg-[#e6f4ea] text-[#1a7f37]", valueClassName: "text-[#1a7f37]" },
            { label: t("summaryPending"), value: session.items.filter((i) => i.status === 0).length, icon: Circle, iconClassName: "bg-[#f2f4f6] text-[#5e3f3a]", valueClassName: "text-[#5e3f3a]" },
            { label: t("summaryMissing"), value: session.missingCount, icon: XCircle, iconClassName: "bg-[#fff4f2] text-[#930006]", valueClassName: "text-[#930006]" },
        ]
        : [];

    return (
        <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#fff4f2] text-[#e3000f]">
                        <ClipboardList className="h-4.5 w-4.5" />
                    </div>
                    <h1 className="text-lg font-semibold text-[#191c1e]">{t("reportTitle")}</h1>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {canScan && (
                        <Link
                            href="/pc/inventory/scan"
                            className="flex h-9 items-center gap-1.5 rounded-md border border-[#e0e3e5] bg-white px-3.5 text-sm! font-semibold! text-[#191c1e] transition hover:bg-[#f2f4f6]"
                        >
                            <ClipboardCheck className="h-3.5 w-3.5" /> {t("startButton")}
                        </Link>
                    )}
                    {canAssign && (
                        <Link
                            href="/pc/inventory/assignments"
                            className="flex h-9 items-center gap-1.5 rounded-md border border-[#e0e3e5] bg-white px-3.5 text-sm! font-semibold! text-[#191c1e] transition hover:bg-[#f2f4f6]"
                        >
                            <Users className="h-3.5 w-3.5" /> {t("assignmentsButton")}
                        </Link>
                    )}
                </div>
            </div>

            <section className="rounded-lg border border-[#e0e3e5] bg-white p-2.5 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="w-full sm:w-52">
                        <IconSelect
                            icon={Building2}
                            options={branches.map((b) => ({ value: b.id, label: b.branchName, searchText: b.branchName.toLowerCase() }))}
                            value={branchId === null ? "" : String(branchId)}
                            onChange={(value) => setBranchId(value === "" ? null : Number(value))}
                            placeholder={t("allBranchesOption")}
                        />
                    </div>
                    <div className="w-full sm:w-96">
                        <SessionPickerField
                            branchId={branchId}
                            value={session}
                            onSelect={handleSelectSession}
                            placeholder={t("sessionSelectLabel")}
                            noSessionsLabel={t("noSessions")}
                        />
                    </div>
                    <button
                        onClick={() => refetchSession()}
                        disabled={sessionId === null || isLoadingItems}
                        title={tCommon("refresh")}
                        aria-label={tCommon("refresh")}
                        className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-[#e0e3e5] bg-white text-[#5e3f3a] transition hover:bg-[#f2f4f6] disabled:opacity-50"
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoadingItems ? "animate-spin" : ""}`} />
                    </button>
                    <div className="ml-auto flex flex-wrap items-center gap-2">
                        <button
                            onClick={handleExportExcel}
                            disabled={isExportingExcel || session === null}
                            className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-[#e0e3e5] bg-white px-3.5 text-sm! font-semibold! text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isExportingExcel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
                            {t("exportExcelButton")}
                        </button>
                        <button
                            onClick={handleExportPdf}
                            disabled={session === null}
                            className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md bg-[#e3000f] px-3.5 text-sm! font-semibold! text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <FileDown className="h-3.5 w-3.5" /> {t("exportPdfButton")}
                        </button>
                    </div>
                </div>
            </section>

            {session && (
                <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
                    {summary.map((card) => (
                        <div key={card.label} className="flex items-center gap-3 rounded-lg border border-[#e0e3e5] bg-white px-3.5 py-3 shadow-sm">
                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${card.iconClassName}`}>
                                <card.icon className="h-4.5 w-4.5" />
                            </div>
                            <div className="min-w-0">
                                <div className="truncate text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5e3f3a]">{card.label}</div>
                                <div className={`text-xl font-semibold ${card.valueClassName}`}>{card.value}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <section className="overflow-hidden rounded-lg border border-[#e0e3e5] bg-white shadow-sm">
                <div className="flex flex-wrap items-center gap-2 border-b border-[#e0e3e5] bg-[#f8fafc] p-2.5">
                    <div className="w-full sm:w-48">
                        <StatusFilterSelect
                            value={statusFilter}
                            onChange={setStatusFilter}
                            options={[
                                { value: "all", label: t("statusAll") },
                                { value: "found", label: t("statusFound") },
                                { value: "pending", label: t("statusPending") },
                                { value: "missing", label: t("statusMissing") },
                            ]}
                        />
                    </div>
                    <div className="w-full sm:w-64">
                        <IconInput icon={Search} value={keyword} onChange={setKeyword} placeholder={t("searchPlaceholder")} />
                    </div>
                    {session && (
                        <span className="ml-auto rounded-full border border-[#e0e3e5] bg-white px-3 py-1 text-xs text-[#5e3f3a]">
                            {t("sessionInfo", { started: formatDateTime(session.startedAt), ended: formatDateTime(session.endedAt), status: session.statusText })}
                        </span>
                    )}
                </div>
                <div className="min-h-[280px] overflow-auto md:max-h-[calc(100vh-420px)]">
                    <table className="w-full text-left text-sm">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.06em] text-[#5e3f3a]">
                                <th className="border-b border-[#e0e3e5] px-4 py-2.5">{t("colDeviceCode")}</th>
                                <th className="hidden border-b border-[#e0e3e5] px-4 py-2.5 sm:table-cell">{t("colDeviceName")}</th>
                                <th className="hidden lg:table-cell border-b border-[#e0e3e5] px-4 py-2.5">{t("colDeviceType")}</th>
                                <th className="hidden lg:table-cell border-b border-[#e0e3e5] px-4 py-2.5">{t("colManager")}</th>
                                <th className="hidden lg:table-cell border-b border-[#e0e3e5] px-4 py-2.5">{t("colLocation")}</th>
                                <th className="hidden lg:table-cell border-b border-[#e0e3e5] px-4 py-2.5">{t("colSerial")}</th>
                                <th className="border-b border-[#e0e3e5] px-4 py-2.5">{t("colStatus")}</th>
                                <th className="hidden lg:table-cell border-b border-[#e0e3e5] px-4 py-2.5">{t("colCheckedBy")}</th>
                                <th className="hidden lg:table-cell border-b border-[#e0e3e5] px-4 py-2.5">{t("colCheckedAt")}</th>
                                <th className="hidden lg:table-cell border-b border-[#e0e3e5] px-4 py-2.5">{t("colNote")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoadingItems && (
                                <tr>
                                    <td colSpan={10} className="px-4 py-10 text-center">
                                        <Loader2 className="mx-auto h-5 w-5 animate-spin text-[#5e3f3a]" />
                                    </td>
                                </tr>
                            )}
                            {!isLoadingItems && visibleItems.length === 0 && (
                                <tr>
                                    <td colSpan={10} className="px-4 py-10 text-center">
                                        <div className="flex flex-col items-center gap-1.5 text-[#8a8f94]">
                                            <PackageSearch className="h-6 w-6" />
                                            <span className="text-sm text-[#5e3f3a]">{t("noReportData")}</span>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {visibleItems.map((item) => (
                                <tr key={item.id} className="border-b border-[#f1f5f9] last:border-0 bg-white even:bg-[#f2f4f7] hover:bg-[#e8ecf1]">
                                    <td className="whitespace-nowrap px-4 py-2.5 font-semibold text-[#191c1e]">
                                        {item.deviceCode}
                                        <div className="whitespace-normal text-xs font-normal text-[#5e3f3a] sm:hidden">{item.deviceName}</div>
                                    </td>
                                    <td className="hidden px-4 py-2.5 text-[#191c1e] sm:table-cell">{item.deviceName}</td>
                                    <td className="hidden lg:table-cell px-4 py-2.5 text-[#5e3f3a]">{item.deviceTypeName ?? "—"}</td>
                                    <td className="hidden lg:table-cell px-4 py-2.5 text-[#5e3f3a]">{item.manager ?? "—"}</td>
                                    <td className="hidden lg:table-cell px-4 py-2.5 text-[#5e3f3a]">{location(item) || "—"}</td>
                                    <td className="hidden lg:table-cell px-4 py-2.5 text-[#5e3f3a]">{item.serialNumber ?? "—"}</td>
                                    <td className="whitespace-nowrap px-4 py-2.5">
                                        <StatusBadge item={item} label={item.status === 1 ? t("statusFound") : item.status === 2 ? t("statusMissing") : t("statusPending")} />
                                    </td>
                                    <td className="hidden lg:table-cell px-4 py-2.5 text-[#5e3f3a]">{item.scannedBy ?? "—"}</td>
                                    <td className="hidden lg:table-cell px-4 py-2.5 text-[#5e3f3a]">{formatDateTime(item.scannedAt)}</td>
                                    <td className="hidden lg:table-cell px-4 py-2.5 text-[#5e3f3a]">{item.note ?? "—"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}

// Completed must stand out clearly from In progress: solid green with an icon.
function SessionStatusBadge({ status, statusText }: { status: number; statusText: string }) {
    if (status === 1) {
        return (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#1a7f37] px-2 py-0.5 text-[11px] font-semibold text-white">
                <CheckCircle2 className="h-3 w-3" /> {statusText}
            </span>
        );
    }
    return (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#fff8e6] px-2 py-0.5 text-[11px] font-semibold text-[#8a6d00]">
            <Circle className="h-3 w-3" /> {statusText}
        </span>
    );
}

// Paged, date-filtered picker because sessions keep accumulating; reuses InventoryApi.getPageNation
// on open and on page/date change.
function SessionPickerField({
    branchId,
    value,
    onSelect,
    placeholder,
    noSessionsLabel,
}: {
    branchId: number | null;
    value: InventorySessionDto | null;
    onSelect: (session: InventorySessionDto) => void;
    placeholder: string;
    noSessionsLabel: string;
}) {
    const t = useTranslations("Asset.Inventory");
    const tCommon = useTranslations("Common");
    const [isOpen, setIsOpen] = useState(false);
    const [pageIndex, setPageIndex] = useState(1);
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [rows, setRows] = useState<InventorySessionDto[]>([]);
    const [totalPages, setTotalPages] = useState(1);
    const containerRef = useRef<HTMLDivElement>(null);
    const pageSize = 8;

    useEffect(() => {
        function handleOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleOutside);
        return () => document.removeEventListener("mousedown", handleOutside);
    }, []);

    const { isLoading, refetch } = useFetchEffect(
        () =>
            isOpen
                ? InventoryApi.getPageNation({ pageIndex, pageSize, branchId: branchId ?? undefined, fromDate: fromDate || undefined, toDate: toDate || undefined })
                : Promise.resolve(null),
        [isOpen, pageIndex, branchId, fromDate, toDate],
        (result) => {
            if (result === null) return;
            setRows(result.data);
            setTotalPages(result.totalPages);
        },
        t("loadReportError")
    );

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => {
                    if (!isOpen) setPageIndex(1);
                    setIsOpen((current) => !current);
                }}
                className={`${fieldClassName} relative flex cursor-pointer items-center gap-2 pl-8 pr-8 text-left`}
            >
                <ClipboardList className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a8f94]" />
                {value ? (
                    <>
                        <span className="min-w-0 flex-1 truncate">
                            <span className="font-semibold text-[#191c1e]">{value.branchName ?? ""}</span>
                            <span className="text-[#8a8f94]"> · {formatDateTime(value.startedAt)}</span>
                        </span>
                        <SessionStatusBadge status={value.status} statusText={value.statusText} />
                    </>
                ) : (
                    <span className="flex-1 truncate text-[#8a8f94]">{placeholder}</span>
                )}
                <ChevronDown className={`pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a8f94] transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-1 w-full min-w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-lg border border-[#e0e3e5] bg-white shadow-lg">
                    <div className="flex flex-wrap items-center gap-1.5 border-b border-[#f1f5f9] p-2">
                        <div className="relative flex-1">
                            <Calendar className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a8f94]" />
                            <input
                                type="date"
                                value={fromDate}
                                onChange={(event) => {
                                    setFromDate(event.target.value);
                                    setPageIndex(1);
                                }}
                                aria-label="Từ ngày"
                                className="h-8 w-full rounded-md border border-[#e0e3e5] bg-white pl-7 pr-2 text-xs! text-[#191c1e] outline-none transition focus:border-[#e3000f]"
                            />
                        </div>
                        <span className="text-xs text-[#8a8f94]">{tCommon("to")}</span>
                        <div className="relative flex-1">
                            <Calendar className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a8f94]" />
                            <input
                                type="date"
                                value={toDate}
                                onChange={(event) => {
                                    setToDate(event.target.value);
                                    setPageIndex(1);
                                }}
                                aria-label="Đến ngày"
                                className="h-8 w-full rounded-md border border-[#e0e3e5] bg-white pl-7 pr-2 text-xs! text-[#191c1e] outline-none transition focus:border-[#e3000f]"
                            />
                        </div>
                        {(fromDate || toDate) && (
                            <button
                                type="button"
                                onClick={() => {
                                    setFromDate("");
                                    setToDate("");
                                    setPageIndex(1);
                                }}
                                title="Xóa lọc ngày"
                                aria-label="Xóa lọc ngày"
                                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-[#8a8f94] transition hover:bg-[#f2f4f6]"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => refetch()}
                            title={tCommon("refresh")}
                            aria-label={tCommon("refresh")}
                            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-[#8a8f94] transition hover:bg-[#f2f4f6]"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                        </button>
                    </div>

                    <div className="max-h-64 overflow-y-auto">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-4 w-4 animate-spin text-[#5e3f3a]" />
                            </div>
                        ) : rows.length === 0 ? (
                            <p className="px-3 py-6 text-center text-xs text-[#8a8f94]">{noSessionsLabel}</p>
                        ) : (
                            rows.map((row) => (
                                <button
                                    key={row.id}
                                    type="button"
                                    onMouseDown={() => {
                                        onSelect(row);
                                        setIsOpen(false);
                                    }}
                                    className={`flex w-full flex-col gap-0.5 border-b border-[#f8fafc] px-3 py-2 text-left transition last:border-0 hover:bg-[#fff4f2] ${
                                        value?.id === row.id ? "bg-[#fff4f2]" : ""
                                    }`}
                                >
                                    <span className="flex items-center justify-between gap-2">
                                        <span className="truncate text-sm font-semibold text-[#191c1e]">{row.branchName ?? ""}</span>
                                        <SessionStatusBadge status={row.status} statusText={row.statusText} />
                                    </span>
                                    <span className="text-xs text-[#5e3f3a]">
                                        {formatDateTime(row.startedAt)} · {t("summaryTotal")} {row.totalCount} · {t("summaryFound")} {row.foundCount} · {t("summaryMissing")} {row.missingCount}
                                    </span>
                                </button>
                            ))
                        )}
                    </div>

                    <div className="flex items-center justify-between border-t border-[#f1f5f9] px-2.5 py-1.5">
                        <button
                            type="button"
                            onClick={() => setPageIndex((current) => Math.max(1, current - 1))}
                            disabled={pageIndex <= 1}
                            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-[#5e3f3a] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <span className="text-xs text-[#5e3f3a]">{tCommon("pageOf", { current: pageIndex, total: Math.max(1, totalPages) })}</span>
                        <button
                            type="button"
                            onClick={() => setPageIndex((current) => Math.min(totalPages, current + 1))}
                            disabled={pageIndex >= totalPages}
                            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-[#5e3f3a] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// Small presentational helpers so the toolbar/table filters share the same height, font and icon
// treatment as the rest of the Asset module (see DeviceFilterBar.tsx for the original pattern).

const fieldClassName =
    "h-9 w-full rounded-md border border-[#e0e3e5] bg-white px-2.5 text-sm! text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]";

function IconInput({
    icon: Icon,
    value,
    onChange,
    placeholder,
}: {
    icon: LucideIcon;
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
}) {
    return (
        <div className="relative">
            <Icon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a8f94]" />
            <input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                title={placeholder}
                className={`${fieldClassName} pl-8`}
            />
        </div>
    );
}

function IconSelect({
    icon: Icon,
    options,
    value,
    onChange,
    placeholder,
}: {
    icon: LucideIcon;
    options: { value: number; label: string; searchText: string }[];
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
}) {
    return (
        <div className="relative">
            <Icon className="pointer-events-none absolute left-2.5 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-[#8a8f94]" />
            <SearchableSelect
                options={options}
                value={value === "" ? "" : Number(value)}
                onChange={(v) => onChange(v === "" ? "" : String(v))}
                placeholder={placeholder}
                triggerClassName={`${fieldClassName} pl-8`}
            />
        </div>
    );
}

// Dots match StatusBadge colors; custom-built because native <option> elements can't be styled.
const statusFilterDotClassName: Record<StatusFilter, string> = {
    all: "bg-[#8a8f94]",
    found: "bg-[#1a7f37]",
    pending: "bg-[#8a8f94]",
    missing: "bg-[#930006]",
};

function StatusFilterSelect({
    value,
    onChange,
    options,
}: {
    value: StatusFilter;
    onChange: (value: StatusFilter) => void;
    options: { value: StatusFilter; label: string }[];
}) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleOutside);
        return () => document.removeEventListener("mousedown", handleOutside);
    }, []);

    const selected = options.find((option) => option.value === value);

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => setIsOpen((current) => !current)}
                className={`${fieldClassName} flex cursor-pointer items-center gap-2 pr-8 text-left`}
            >
                <span className={`h-2 w-2 shrink-0 rounded-full ${statusFilterDotClassName[value]}`} />
                <span className="flex-1 truncate">{selected?.label}</span>
                <ChevronDown className={`pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a8f94] transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-[#e0e3e5] bg-white shadow-lg">
                    {options.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onMouseDown={() => {
                                onChange(option.value);
                                setIsOpen(false);
                            }}
                            className={`flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm! transition hover:bg-[#fff4f2] ${
                                option.value === value ? "bg-[#fff4f2] font-semibold! text-[#e3000f]" : "text-[#191c1e]"
                            }`}
                        >
                            <span className={`h-2 w-2 shrink-0 rounded-full ${statusFilterDotClassName[option.value]}`} />
                            {option.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
