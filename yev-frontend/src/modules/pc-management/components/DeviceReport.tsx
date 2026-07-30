"use client";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Link } from "@/navigation";
import { toast } from "react-toastify";
import { Computer, Monitor, HardDrive, Clock, RefreshCw, Download, ArrowLeft } from "lucide-react";

import { DeviceApi } from "@/modules/pc-management/api/device.api";
import type { DeviceDto } from "@/modules/pc-management/types/device.dto";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

// jsPDF/jspdf-autotable (~vài trăm KB) chỉ cần cho hành động "Xuất PDF" — code-split riêng để không
// nằm trong bundle chính của trang báo cáo, chỉ tải khi user thực sự mở dialog này.
const DeviceListReportPrintDialog = dynamic(() => import("./DeviceListReportPrintDialog"), { ssr: false });

const PAGE_SIZE = 1000;
const DAY_MS = 86_400_000;
const EXPIRY_WINDOW_DAYS = 90;

// Báo cáo thống kê chỉ tính thiết bị "chờ sử dụng"/"đang sử dụng" — thiết bị chờ thanh lý/đã
// thanh lý không còn vận hành nên không đưa vào làm dữ liệu thống kê.
const statusMeta = [
    { value: 1, label: "Đang sử dụng", bar: "bg-emerald-500" },
    { value: 0, label: "Chưa sử dụng", bar: "bg-[#94a3b8]" },
];
const REPORTABLE_STATUSES = new Set(statusMeta.map((status) => status.value));

function formatDate(value: string | null) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("vi-VN");
}

interface DistributionRow {
    label: string;
    count: number;
    bar?: string;
}

function DistributionCard({
    title,
    caption,
    rows,
    total,
    scaleByMax = false,
    emptyText,
}: {
    title: string;
    caption: string;
    rows: DistributionRow[];
    total: number;
    scaleByMax?: boolean;
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
                        const width = scaleByMax
                            ? maxCount
                                ? Math.max(4, Math.round((row.count / maxCount) * 100))
                                : 0
                            : percentOfTotal;
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
                                    <div
                                        className={`h-2 rounded-full ${row.bar ?? "bg-[#e3000f]"}`}
                                        style={{ width: `${width}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default function DeviceReport() {
    const [devices, setDevices] = useState<DeviceDto[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [now, setNow] = useState(0);
    const [isPrintOpen, setIsPrintOpen] = useState(false);

    const { isLoading, error, refetch: fetchDevices } = useFetchEffect(
        async () => {
            const firstPage = await DeviceApi.getDevicePageNation({ pageIndex: 1, pageSize: PAGE_SIZE });
            let allDevices = firstPage.data;
            const totalPages = firstPage.totalPages ?? 1;

            if (totalPages > 1) {
                const restPages = await Promise.all(
                    Array.from({ length: totalPages - 1 }, (_, index) =>
                        DeviceApi.getDevicePageNation({ pageIndex: index + 2, pageSize: PAGE_SIZE })
                    )
                );
                allDevices = restPages.reduce((acc, page) => acc.concat(page.data), allDevices);
            }

            return { allDevices, totalCount: firstPage.totalCount };
        },
        [],
        (result) => {
            setDevices(result.allDevices);
            setTotalCount(result.totalCount);
            setNow(Date.now());
        },
        "Không thể tải dữ liệu báo cáo thiết bị.",
        (message) => toast.error(message)
    );

    const stats = useMemo(() => {
        const reportableDevices = devices.filter((device) => REPORTABLE_STATUSES.has(device.status));
        const total = reportableDevices.length;

        const statusRows: DistributionRow[] = statusMeta.map((status) => ({
            label: status.label,
            bar: status.bar,
            count: reportableDevices.filter((device) => device.status === status.value).length,
        }));

        const countBy = (selector: (device: DeviceDto) => string) => {
            const map = new Map<string, number>();
            reportableDevices.forEach((device) => {
                const key = selector(device) || "Không xác định";
                map.set(key, (map.get(key) ?? 0) + 1);
            });
            return Array.from(map.entries())
                .map(([label, count]) => ({ label, count }))
                .sort((a, b) => b.count - a.count);
        };

        const branchRows = countBy((device) => device.branchName).slice(0, 6);
        const typeRows = countBy((device) => device.deviceTypeName).slice(0, 6);

        const expiring = now
            ? reportableDevices
                  .filter((device) => device.expirationDate)
                  .map((device) => ({
                      device,
                      days: Math.ceil((new Date(device.expirationDate as string).getTime() - now) / DAY_MS),
                  }))
                  .filter((entry) => entry.days <= EXPIRY_WINDOW_DAYS)
                  .sort((a, b) => a.days - b.days)
            : [];

        const inUse = statusRows.find((row) => row.label === "Đang sử dụng")?.count ?? 0;
        const idle = statusRows.find((row) => row.label === "Chưa sử dụng")?.count ?? 0;
        const expiringSoon = expiring.filter((entry) => entry.days >= 0).length;

        return { total, statusRows, branchRows, typeRows, expiring, inUse, idle, expiringSoon };
    }, [devices, now]);

    const kpis = [
        { label: "Tổng thiết bị", value: stats.total, icon: Computer },
        { label: "Đang sử dụng", value: stats.inUse, icon: Monitor },
        { label: "Chưa sử dụng", value: stats.idle, icon: HardDrive },
        { label: `Sắp hết hạn (≤${EXPIRY_WINDOW_DAYS} ngày)`, value: stats.expiringSoon, icon: Clock },
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-[#191c1e]">Báo cáo thiết bị</h1>
                    <p className="mt-1 text-[15px] text-[#5e3f3a]">
                        Tổng hợp tình trạng thiết bị theo trạng thái, chi nhánh, loại và hạn sử dụng.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => fetchDevices()}
                        disabled={isLoading}
                        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50"
                    >
                        <RefreshCw className="h-3.5 w-3.5" /> Làm mới
                    </button>
                    <button
                        onClick={() => setIsPrintOpen(true)}
                        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                    >
                        <Download className="h-3.5 w-3.5" /> Xuất PDF
                    </button>
                    <Link
                        href="/pc"
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

            {totalCount > devices.length && (
                <div className="rounded-xl border border-[#e0e3e5] bg-[#f8fafc] px-4 py-3 text-xs text-[#5e3f3a]">
                    Thống kê dựa trên {devices.length} / {totalCount} thiết bị mới nhất.
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {kpis.map((kpi) => (
                    <div key={kpi.label} className="rounded-xl border border-[#e0e3e5] bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-[#5e3f3a]">{kpi.label}</p>
                                <h2 className="mt-1 text-2xl font-semibold text-[#191c1e]">
                                    {isLoading ? "—" : kpi.value}
                                </h2>
                            </div>
                            <div className="rounded-md bg-[#fff4f2] p-3 text-[#e3000f]">
                                <kpi.icon size={20} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <DistributionCard
                    title="Phân bổ theo trạng thái"
                    caption="Số lượng thiết bị theo từng trạng thái sử dụng."
                    rows={stats.statusRows}
                    total={stats.total}
                    emptyText="Chưa có dữ liệu."
                />
                <DistributionCard
                    title="Theo chi nhánh"
                    caption="Top chi nhánh có nhiều thiết bị nhất."
                    rows={stats.branchRows}
                    total={stats.total}
                    scaleByMax
                    emptyText="Chưa có dữ liệu."
                />
                <DistributionCard
                    title="Theo loại thiết bị"
                    caption="Top loại thiết bị phổ biến nhất."
                    rows={stats.typeRows}
                    total={stats.total}
                    scaleByMax
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
                        {stats.expiring.length} thiết bị
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                <th className="whitespace-nowrap px-6 py-3">Thiết bị</th>
                                <th className="whitespace-nowrap px-6 py-3">Chi nhánh</th>
                                <th className="whitespace-nowrap px-6 py-3">Người quản lý</th>
                                <th className="whitespace-nowrap px-6 py-3">Ngày hết hạn</th>
                                <th className="whitespace-nowrap px-6 py-3 text-right">Còn lại</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && stats.expiring.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-[#5e3f3a]">
                                        Không có thiết bị nào sắp hết hạn.
                                    </td>
                                </tr>
                            )}
                            {stats.expiring.map(({ device, days }) => {
                                const expired = days < 0;
                                const urgent = days >= 0 && days <= 30;
                                const badgeClass = expired || urgent
                                    ? "border border-[#e9bcb6] bg-[#fff4f2] text-[#930006]"
                                    : "border border-[#e0e3e5] bg-[#f8fafc] text-[#5e3f3a]";
                                const badgeText = expired ? `Quá hạn ${Math.abs(days)} ngày` : `Còn ${days} ngày`;
                                return (
                                    <tr key={device.id} className="border-b border-[#f1f5f9] transition-colors hover:bg-[#f8fafc]">
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-semibold text-[#191c1e]">{device.deviceCode}</div>
                                            <div className="max-w-[220px] truncate text-xs text-[#5e3f3a]" title={device.deviceName}>
                                                {device.deviceName}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-[#5e3f3a]">{device.branchName}</td>
                                        <td className="px-6 py-4 text-sm text-[#5e3f3a]">{device.manager}</td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-[#5e3f3a]">
                                            {formatDate(device.expirationDate)}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-right">
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
            </section>

            {isPrintOpen && <DeviceListReportPrintDialog isOpen={isPrintOpen} onClose={() => setIsPrintOpen(false)} />}
        </div>
    );
}
