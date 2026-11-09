"use client";

import { Pagination } from "@/components/ui/Pagination";
import { useState } from "react";
import { FilterX, RefreshCw, Search } from "lucide-react";
import { toast } from "react-toastify";

import { useRouter } from "@/navigation";
import { UsbLogApi } from "@/modules/pc-management/api/usb-log.api";
import type { UsbMachineDto } from "@/modules/pc-management/types/usb-log.dto";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { formatDateTime } from "./usb-log-format";

const PAGE_SIZE = 20;

const fieldLabelClassName = "mb-1 block text-xs font-semibold text-[#5e3f3a]";
const fieldClassName =
    "h-9 w-full rounded-md border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]";

const emptyFilters = { keyword: "", fromDate: "", toDate: "", connectedNowOnly: false };

// PCs with USB activity.
export default function UsbMachineList() {
    const router = useRouter();
    const [rows, setRows] = useState<UsbMachineDto[]>([]);

    const [draft, setDraft] = useState(emptyFilters);
    const [applied, setApplied] = useState(emptyFilters);

    const [pageIndex, setPageIndex] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    const { isLoading, error, refetch } = useFetchEffect(
        () =>
            UsbLogApi.getMachines({
                pageIndex,
                pageSize: PAGE_SIZE,
                keyword: applied.keyword || undefined,
                fromDate: applied.fromDate || undefined,
                toDate: applied.toDate || undefined,
                connectedNowOnly: applied.connectedNowOnly,
            }),
        [pageIndex, applied],
        (result) => {
            setRows(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
        },
        "Không thể tải danh sách máy dùng USB.",
        (message) => toast.error(message),
        "usb-machines"
    );

    const handleSearch = () => {
        setPageIndex(1);
        setApplied({ ...draft, keyword: draft.keyword.trim() });
    };

    const handleReset = () => {
        setPageIndex(1);
        setDraft(emptyFilters);
        setApplied(emptyFilters);
    };

    const openMachine = (row: UsbMachineDto) =>
        router.push({
            pathname: "/pc/usb-log",
            query: row.deviceId ? { machine: row.machineName, deviceId: String(row.deviceId) } : { machine: row.machineName },
        });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <h1 className="text-lg font-semibold text-[#191c1e]">Quản lý USB</h1>
                <button
                    onClick={() => refetch()}
                    disabled={isLoading}
                    title="Làm mới"
                    aria-label="Làm mới"
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-[#e0e3e5] bg-white text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <RefreshCw className="h-3.5 w-3.5" />
                </button>
            </div>

            <section className="rounded-lg border border-[#e0e3e5] bg-white p-2.5 shadow-sm">
                <div className="flex flex-wrap items-end gap-x-2 gap-y-2 [&>label]:w-[calc(50%-0.25rem)] sm:[&>label]:w-40">
                    <label className="block max-sm:w-full! sm:w-64!">
                        <span className={fieldLabelClassName}>Tìm kiếm</span>
                        <input
                            value={draft.keyword}
                            onChange={(event) => setDraft({ ...draft, keyword: event.target.value })}
                            onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                            placeholder="Mã máy, tên máy, user"
                            className={fieldClassName}
                        />
                    </label>
                    <label className="block">
                        <span className={fieldLabelClassName}>Từ ngày</span>
                        <input
                            type="date"
                            value={draft.fromDate}
                            onChange={(event) => setDraft({ ...draft, fromDate: event.target.value })}
                            className={fieldClassName}
                        />
                    </label>
                    <label className="block">
                        <span className={fieldLabelClassName}>Đến ngày</span>
                        <input
                            type="date"
                            value={draft.toDate}
                            onChange={(event) => setDraft({ ...draft, toDate: event.target.value })}
                            className={fieldClassName}
                        />
                    </label>
                    <label className="flex h-9 w-auto! cursor-pointer items-center gap-2 text-sm text-[#191c1e]">
                        <input
                            type="checkbox"
                            checked={draft.connectedNowOnly}
                            onChange={(event) => setDraft({ ...draft, connectedNowOnly: event.target.checked })}
                            className="h-4 w-4 accent-[#e3000f]"
                        />
                        Đang cắm
                    </label>

                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={handleSearch}
                            disabled={isLoading}
                            title="Tìm kiếm"
                            aria-label="Tìm kiếm"
                            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md bg-[#e3000f] text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Search className="h-4 w-4" />
                        </button>
                        <button
                            onClick={handleReset}
                            disabled={isLoading}
                            title="Xoá lọc"
                            aria-label="Xoá lọc"
                            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-[#e0e3e5] bg-white text-[#5e3f3a] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <FilterX className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">

                {error && <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>}

                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">
                                <th className="px-3 py-2">Máy</th>
                                <th className="hidden px-3 py-2 lg:table-cell">Người dùng gần nhất</th>
                                <th className="hidden lg:table-cell px-3 py-2 text-right">USB</th>
                                <th className="px-3 py-2 text-right">Lần cắm</th>
                                <th className="hidden lg:table-cell px-3 py-2 text-right">Thao tác file</th>
                                <th className="px-3 py-2">Lần cuối</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && rows.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-sm text-[#5e3f3a]">
                                        Chưa có máy nào dùng USB.
                                    </td>
                                </tr>
                            )}
                            {rows.map((row) => (
                                <tr
                                    key={row.machineName}
                                    onClick={() => openMachine(row)}
                                    className="cursor-pointer border-b border-[#f1f5f9] transition hover:bg-[#f8fafc]"
                                >
                                    <td className="px-3 py-2 text-sm text-[#191c1e]">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-semibold">{row.deviceCode ?? row.machineName}</span>
                                            {row.isConnectedNow && (
                                                <span className="shrink-0 rounded-full border border-[#bfe5c8] bg-[#eefaf1] px-2 py-0.5 text-[10px] font-semibold text-[#0f6b2a]">
                                                    Đang cắm
                                                </span>
                                            )}
                                            {row.unpermittedCount > 0 && (
                                                <span className="shrink-0 rounded-full border border-[#e9bcb6] bg-[#fff4f2] px-2 py-0.5 text-[10px] font-semibold text-[#930006]">
                                                    Chưa cấp phép
                                                </span>
                                            )}
                                        </div>
                                        {row.deviceCode && <div className="text-xs text-[#5e3f3a]">{row.machineName}</div>}
                                    </td>
                                    <td className="hidden px-3 py-2 text-sm text-[#5e3f3a] lg:table-cell">{row.lastWindowsUser || "-"}</td>
                                    <td className="hidden lg:table-cell px-3 py-2 text-right text-sm text-[#191c1e]">{row.usbDeviceCount}</td>
                                    <td className="px-3 py-2 text-right text-sm text-[#191c1e]">{row.sessionCount}</td>
                                    <td className="hidden lg:table-cell px-3 py-2 text-right text-sm text-[#191c1e]">{row.fileEventCount}</td>
                                    <td className="whitespace-nowrap px-3 py-2 text-sm text-[#5e3f3a]">{formatDateTime(row.lastConnectedAt)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <Pagination
                    pageIndex={pageIndex}
                    totalPages={totalPages}
                    onPageChange={setPageIndex}
                    disabled={isLoading}
                    summary={isLoading ? "Đang tải dữ liệu..." : `Hiển thị ${rows.length} / ${totalCount} máy`}
                    compactSummary={isLoading ? "Đang tải dữ liệu..." : `Hiển thị ${rows.length} / ${totalCount} máy`}
                />
            </section>
        </div>
    );
}
