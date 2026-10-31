"use client";

import { Fragment, useState } from "react";
import { FilterX, RefreshCw, Search } from "lucide-react";
import { toast } from "react-toastify";

import { UsbLogApi } from "@/modules/pc-management/api/usb-log.api";
import type { UsbSessionDto } from "@/modules/pc-management/types/usb-log.dto";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import UsbSessionFiles from "./UsbSessionFiles";
import { formatBytes, formatDateTime } from "./usb-log-format";

const PAGE_SIZE = 20;

const fieldLabelClassName = "mb-1 block text-xs font-semibold text-[#5e3f3a]";
const fieldClassName =
    "h-9 w-full rounded-md border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]";

const emptyFilters = { keyword: "", fromDate: "", toDate: "", unpermittedOnly: false };

interface UsbLogListProps {
    // With deviceId or machineName, only that machine's sessions are shown and the filter bar is hidden.
    deviceId?: number;
    machineName?: string;
}

// USB plug-in sessions reported by the PC agent.
export default function UsbLogList({ deviceId, machineName }: UsbLogListProps) {
    const [rows, setRows] = useState<UsbSessionDto[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const [draft, setDraft] = useState(emptyFilters);
    const [applied, setApplied] = useState(emptyFilters);

    const [pageIndex, setPageIndex] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    const showMachine = deviceId === undefined && machineName === undefined;
    const columnCount = showMachine ? 7 : 6;

    const { isLoading, error, refetch } = useFetchEffect(
        () =>
            UsbLogApi.getSessions({
                pageIndex,
                pageSize: PAGE_SIZE,
                deviceId,
                machineName,
                keyword: applied.keyword || undefined,
                fromDate: applied.fromDate || undefined,
                toDate: applied.toDate || undefined,
                unpermittedOnly: applied.unpermittedOnly,
            }),
        [pageIndex, applied, deviceId, machineName],
        (result) => {
            setRows(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
        },
        "Không thể tải nhật ký USB.",
        (message) => toast.error(message),
        showMachine ? "usb-log" : undefined
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

    return (
        <div className="space-y-4">
            {showMachine && (
                <>
                    <div className="flex items-center justify-between gap-3">
                        <h1 className="text-lg font-semibold text-[#191c1e]">Nhật ký USB</h1>
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
                        <div className="flex flex-wrap items-end gap-x-2 gap-y-2 [&>label]:w-full sm:[&>label]:w-40">
                            <label className="block sm:w-64!">
                                <span className={fieldLabelClassName}>Tìm kiếm</span>
                                <input
                                    value={draft.keyword}
                                    onChange={(event) => setDraft({ ...draft, keyword: event.target.value })}
                                    onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                                    placeholder="Mã máy, user, tên/serial USB"
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
                                    checked={draft.unpermittedOnly}
                                    onChange={(event) => setDraft({ ...draft, unpermittedOnly: event.target.checked })}
                                    className="h-4 w-4 accent-[#e3000f]"
                                />
                                Chưa cấp phép
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
                </>
            )}

            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                <div className="border-b border-[#e0e3e5] bg-[#f8fafc] px-4 py-3 text-sm text-[#5e3f3a]">
                    {isLoading ? "Đang tải dữ liệu..." : `Hiển thị ${rows.length} / ${totalCount} phiên`}
                </div>

                {error && <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>}

                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">
                                <th className="px-3 py-2">Cắm lúc</th>
                                <th className="px-3 py-2">Rút lúc</th>
                                {showMachine && <th className="px-3 py-2">Máy</th>}
                                <th className="px-3 py-2">Người dùng</th>
                                <th className="px-3 py-2">USB</th>
                                <th className="px-3 py-2">File</th>
                                <th className="px-3 py-2 text-right">Chi tiết</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && rows.length === 0 && (
                                <tr>
                                    <td colSpan={columnCount} className="px-6 py-8 text-center text-sm text-[#5e3f3a]">
                                        Không có dữ liệu.
                                    </td>
                                </tr>
                            )}
                            {rows.map((row) => (
                                <Fragment key={row.id}>
                                    <tr className="border-b border-[#f1f5f9] align-top">
                                        <td className="whitespace-nowrap px-3 py-2 text-sm text-[#191c1e]">{formatDateTime(row.connectedAt)}</td>
                                        <td className="whitespace-nowrap px-3 py-2 text-sm text-[#5e3f3a]">
                                            {row.disconnectedAt ? formatDateTime(row.disconnectedAt) : "Đang cắm"}
                                        </td>
                                        {showMachine && (
                                            <td className="px-3 py-2 text-sm text-[#191c1e]">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold">{row.deviceCode ?? row.machineName}</span>
                                                    {row.wasPermitted === false && (
                                                        <span className="shrink-0 rounded-full border border-[#e9bcb6] bg-[#fff4f2] px-2 py-0.5 text-[10px] font-semibold text-[#930006]">
                                                            Chưa cấp phép
                                                        </span>
                                                    )}
                                                </div>
                                                {row.deviceCode && <div className="text-xs text-[#5e3f3a]">{row.machineName}</div>}
                                            </td>
                                        )}
                                        <td className="px-3 py-2 text-sm text-[#5e3f3a]">{row.windowsUser || "-"}</td>
                                        <td className="px-3 py-2 text-sm text-[#191c1e]">
                                            <div>{row.friendlyName || `${row.vendorId}:${row.productId}`}</div>
                                            <div className="text-xs text-[#5e3f3a]">
                                                {[row.driveLetter, row.serialNumber, formatBytes(row.capacityBytes)].filter((v) => v && v !== "-").join(" · ")}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-sm text-[#5e3f3a]">{row.fileEventCount}</td>
                                        <td className="px-3 py-2 text-right">
                                            <button
                                                onClick={() => setExpandedId((current) => (current === row.id ? null : row.id))}
                                                disabled={row.fileEventCount === 0}
                                                className="cursor-pointer font-semibold text-[#5e3f3a] transition hover:text-[#191c1e] disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                                {expandedId === row.id ? "Ẩn" : "Xem"}
                                            </button>
                                        </td>
                                    </tr>
                                    {expandedId === row.id && (
                                        <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                                            <td colSpan={columnCount} className="px-3 py-2">
                                                <UsbSessionFiles sessionId={row.id} />
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex items-center justify-between border-t border-[#e0e3e5] p-4">
                    <button
                        className="cursor-pointer text-sm text-[#5e3f3a] disabled:opacity-50"
                        disabled={pageIndex <= 1 || isLoading}
                        onClick={() => setPageIndex((current) => Math.max(1, current - 1))}
                    >
                        Trang trước
                    </button>
                    <div className="flex h-8 items-center px-3 text-sm font-semibold text-[#191c1e]">
                        Trang {pageIndex} / {totalPages}
                    </div>
                    <button
                        className="cursor-pointer text-sm text-[#5e3f3a] disabled:opacity-50"
                        disabled={pageIndex >= totalPages || isLoading}
                        onClick={() => setPageIndex((current) => current + 1)}
                    >
                        Trang sau
                    </button>
                </div>
            </section>
        </div>
    );
}
