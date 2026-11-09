"use client";
import { Pagination } from "@/components/ui/Pagination";
import { useState } from "react";
import dynamic from "next/dynamic";
import { Link } from "@/navigation";
import { toast } from "react-toastify";
import { Computer, Monitor, HardDrive, Clock, RefreshCw, Download, ArrowLeft } from "lucide-react";

import { ReportApi } from "@/modules/pc-management/api/report.api";
import type { DeviceReportSummaryDto } from "@/modules/pc-management/types/report.dto";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

// jsPDF is a few hundred KB and only needed for PDF export, so it is code-split out of the report bundle.
const DeviceListReportPrintDialog = dynamic(() => import("./DeviceListReportPrintDialog"), { ssr: false });

// Must match ReportExpiryWindowDays in Asset DeviceService.cs; BE already filters, FE only displays.
const EXPIRY_WINDOW_DAYS = 90;

// summary.expiringDevices can hold thousands of rows (no paged endpoint), so paging happens at render time only.
const EXPIRING_PAGE_SIZE = 20;

// Stats cover only unused/in-use devices (BE-filtered); liquidation states are no longer operational.
const statusMeta = [
    { key: "inUseCount" as const, label: "Đang sử dụng", color: "#10b981" },
    { key: "pendingUseCount" as const, label: "Chưa sử dụng", color: "#94a3b8" },
];

function formatDate(value: string | null) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("vi-VN");
}

interface DistributionRow {
    label: string;
    count: number;
}

function DistributionCard({
    title,
    caption,
    rows,
    total,
    emptyText,
}: {
    title: string;
    caption: string;
    rows: DistributionRow[];
    total: number;
    emptyText: string;
}) {
    const maxCount = rows.reduce((max, row) => Math.max(max, row.count), 0);

    return (
        <div className="rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
            <div className="mb-5">
                <h3 className="text-base font-semibold text-[#191c1e]">{title}</h3>
                <p className="mt-1 text-xs text-[#5e3f3a]">{caption}</p>
            </div>

            {rows.length === 0 ? (
                <p className="py-6 text-center text-sm text-[#5e3f3a]">{emptyText}</p>
            ) : (
                <div className="space-y-4">
                    {rows.map((row) => {
                        const percentOfTotal = total ? Math.round((row.count / total) * 100) : 0;
                        const width = maxCount ? Math.max(4, Math.round((row.count / maxCount) * 100)) : 0;
                        return (
                            <div key={row.label}>
                                <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                                    <span className="truncate text-[#191c1e]" title={row.label}>
                                        {row.label}
                                    </span>
                                    <span className="shrink-0 text-[#5e3f3a]">
                                        {row.count} · {percentOfTotal}%
                                    </span>
                                </div>
                                <div className="h-2 w-full rounded-full bg-[#f1f5f9]">
                                    <div className="h-2 rounded-full bg-[#e3000f]" style={{ width: `${width}%` }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

interface StatusDonutRow {
    label: string;
    count: number;
    color: string;
}

// Hand-drawn SVG donut: two slices don't justify a chart library.
// Legend sits below the chart because the card is ~1/3 screen wide and side-by-side labels would wrap.
function StatusDonutChart({ rows, total }: { rows: StatusDonutRow[]; total: number }) {
    const size = 168;
    const strokeWidth = 26;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    let cumulativeFraction = 0;

    return (
        <div className="flex flex-col items-center gap-5 py-2">
            <div className="relative shrink-0" style={{ width: size, height: size }}>
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
                    <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />
                    {total > 0 &&
                        rows
                            .filter((row) => row.count > 0)
                            .map((row) => {
                                const fraction = row.count / total;
                                const dashLength = fraction * circumference;
                                const dashOffset = -cumulativeFraction * circumference;
                                cumulativeFraction += fraction;
                                return (
                                    <circle
                                        key={row.label}
                                        cx={size / 2}
                                        cy={size / 2}
                                        r={radius}
                                        fill="none"
                                        stroke={row.color}
                                        strokeWidth={strokeWidth}
                                        strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                                        strokeDashoffset={dashOffset}
                                    />
                                );
                            })}
                </svg>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-semibold text-[#191c1e]">{total}</span>
                    <span className="text-[11px] text-[#5e3f3a]">thiết bị</span>
                </div>
            </div>

            <div className="w-full space-y-2.5">
                {rows.map((row) => (
                    <div key={row.label} className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex min-w-0 items-center gap-2">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                            <span className="truncate text-[#191c1e]">{row.label}</span>
                        </span>
                        <span className="shrink-0 whitespace-nowrap text-[#5e3f3a]">
                            {row.count} · {total ? Math.round((row.count / total) * 100) : 0}%
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

const emptySummary: DeviceReportSummaryDto = {
    totalCount: 0,
    inUseCount: 0,
    pendingUseCount: 0,
    expiringSoonCount: 0,
    branchDistribution: [],
    deviceTypeDistribution: [],
    expiringDevices: [],
};

export default function DeviceReport() {
    const [summary, setSummary] = useState<DeviceReportSummaryDto>(emptySummary);
    const [isPrintOpen, setIsPrintOpen] = useState(false);

    // BE aggregates in SQL instead of shipping the 5000+ row Device table to the client.
    const { isLoading, error, refetch: fetchSummary } = useFetchEffect(
        () => ReportApi.getDeviceReportSummary(),
        [],
        (result) => setSummary(result),
        "Không thể tải dữ liệu báo cáo thiết bị.",
        (message) => toast.error(message),
        "device-report-summary"
    );

    const statusRows: StatusDonutRow[] = statusMeta.map((status) => ({
        label: status.label,
        color: status.color,
        count: summary[status.key],
    }));

    // Reset to page 1 on new data; snapshot compared during render instead of an effect.
    const [expiringPageIndex, setExpiringPageIndex] = useState(1);
    const [prevExpiringDevices, setPrevExpiringDevices] = useState(summary.expiringDevices);
    if (prevExpiringDevices !== summary.expiringDevices) {
        setPrevExpiringDevices(summary.expiringDevices);
        setExpiringPageIndex(1);
    }
    const expiringTotalPages = Math.max(1, Math.ceil(summary.expiringDevices.length / EXPIRING_PAGE_SIZE));
    const pagedExpiringDevices = summary.expiringDevices.slice(
        (expiringPageIndex - 1) * EXPIRING_PAGE_SIZE,
        expiringPageIndex * EXPIRING_PAGE_SIZE
    );

    const kpis = [
        { label: "Tổng thiết bị", value: summary.totalCount, icon: Computer },
        { label: "Đang sử dụng", value: summary.inUseCount, icon: Monitor },
        { label: "Chưa sử dụng", value: summary.pendingUseCount, icon: HardDrive },
        { label: `Sắp hết hạn (≤${EXPIRY_WINDOW_DAYS} ngày)`, value: summary.expiringSoonCount, icon: Clock },
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-[#191c1e]">Báo cáo thiết bị</h1>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => fetchSummary()}
                        disabled={isLoading}
                        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50"
                    >
                        <RefreshCw className="h-3.5 w-3.5" /> Làm mới
                    </button>
                    <button
                        onClick={() => setIsPrintOpen(true)}
                        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                    >
                        <Download className="h-3.5 w-3.5" /> Xuất báo cáo
                    </button>
                    <Link
                        href="/pc"
                        // No prefetch: with static export + [locale], RSC payload URLs don't match the files in out/ and 404.
                        prefetch={false}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" /> Quay lại danh sách
                    </Link>
                </div>
            </div>

            {error && (
                <div className="rounded-xl border border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>
            )}

            <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
                {kpis.map((kpi) => (
                    <div key={kpi.label} className="rounded-xl border border-[#e0e3e5] bg-white p-3 shadow-sm md:p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-[#5e3f3a]">{kpi.label}</p>
                                <h2 className="mt-1 text-2xl font-semibold text-[#191c1e]">
                                    {isLoading ? "—" : kpi.value}
                                </h2>
                            </div>
                            <div className="hidden rounded-md bg-[#fff4f2] p-3 text-[#e3000f] sm:block">
                                <kpi.icon size={20} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
                    <div className="mb-2">
                        <h3 className="text-base font-semibold text-[#191c1e]">Phân bổ theo trạng thái</h3>
                        <p className="mt-1 text-xs text-[#5e3f3a]">Số lượng thiết bị theo từng trạng thái sử dụng.</p>
                    </div>
                    {summary.totalCount === 0 ? (
                        <p className="py-6 text-center text-sm text-[#5e3f3a]">Chưa có dữ liệu.</p>
                    ) : (
                        <StatusDonutChart rows={statusRows} total={summary.totalCount} />
                    )}
                </div>
                <DistributionCard
                    title="Theo chi nhánh"
                    caption="Top chi nhánh có nhiều thiết bị nhất."
                    rows={summary.branchDistribution}
                    total={summary.totalCount}
                    emptyText="Chưa có dữ liệu."
                />
                <DistributionCard
                    title="Theo loại thiết bị"
                    caption="Top loại thiết bị phổ biến nhất."
                    rows={summary.deviceTypeDistribution}
                    total={summary.totalCount}
                    emptyText="Chưa có dữ liệu."
                />
            </div>

            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-[#e0e3e5] bg-[#f8fafc] p-4">
                    <div>
                        <h3 className="text-base font-semibold text-[#191c1e]">Thiết bị sắp / đã hết hạn</h3>
                        <p className="mt-0.5 text-xs text-[#5e3f3a]">
                            Các thiết bị còn hạn sử dụng dưới {EXPIRY_WINDOW_DAYS} ngày hoặc đã quá hạn.
                        </p>
                    </div>
                    <span className="rounded-full border border-[#e0e3e5] bg-white px-3 py-1 text-xs font-medium text-[#5e3f3a]">
                        {summary.expiringDevices.length} thiết bị
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.06em] text-[#5e3f3a]">
                                <th className="whitespace-nowrap px-3 py-2">Thiết bị</th>
                                <th className="whitespace-nowrap px-3 py-2">Chi nhánh</th>
                                <th className="whitespace-nowrap px-3 py-2">Người quản lý</th>
                                <th className="whitespace-nowrap px-3 py-2">Ngày hết hạn</th>
                                <th className="whitespace-nowrap px-3 py-2 text-right">Còn lại</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && summary.expiringDevices.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-[#5e3f3a]">
                                        Không có thiết bị nào sắp hết hạn.
                                    </td>
                                </tr>
                            )}
                            {pagedExpiringDevices.map((device) => {
                                const days = device.daysRemaining;
                                const expired = days < 0;
                                const urgent = days >= 0 && days <= 30;
                                const badgeClass = expired || urgent
                                    ? "border border-[#e9bcb6] bg-[#fff4f2] text-[#930006]"
                                    : "border border-[#e0e3e5] bg-[#f8fafc] text-[#5e3f3a]";
                                const badgeText = expired ? `Quá hạn ${Math.abs(days)} ngày` : `Còn ${days} ngày`;
                                return (
                                    <tr key={device.id} className="border-b border-[#f1f5f9] bg-white transition-colors even:bg-[#f2f4f7] hover:bg-[#e8ecf1]">
                                        <td className="px-3 py-2">
                                            <div className="text-sm font-semibold text-[#191c1e]">{device.deviceCode}</div>
                                            <div className="max-w-[220px] truncate text-xs text-[#5e3f3a]" title={device.deviceName}>
                                                {device.deviceName}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-sm text-[#5e3f3a]">{device.branchName}</td>
                                        <td className="px-3 py-2 text-sm text-[#5e3f3a]">{device.manager}</td>
                                        <td className="whitespace-nowrap px-3 py-2 text-sm text-[#5e3f3a]">
                                            {formatDate(device.expirationDate)}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-2 text-right">
                                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClass}`}>
                                                {badgeText}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {expiringTotalPages > 1 && (
                    <Pagination
                        pageIndex={expiringPageIndex}
                        totalPages={expiringTotalPages}
                        onPageChange={setExpiringPageIndex}
                        summary={`${summary.expiringDevices.length} thiết bị`}
                        compactSummary={`${summary.expiringDevices.length} thiết bị`}
                    />
                )}
            </section>

            {isPrintOpen && <DeviceListReportPrintDialog isOpen={isPrintOpen} onClose={() => setIsPrintOpen(false)} />}
        </div>
    );
}
