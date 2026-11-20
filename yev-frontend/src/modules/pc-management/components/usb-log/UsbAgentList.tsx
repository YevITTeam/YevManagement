"use client";

import { useState } from "react";
import { FilterX, RefreshCw, Search } from "lucide-react";
import { toast } from "react-toastify";

import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { NO_SORT, SortableTh, type SortState } from "@/components/ui/SortableTh";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { UsbLogApi } from "@/modules/pc-management/api/usb-log.api";
import type { UsbAgentDto } from "@/modules/pc-management/types/usb-log.dto";
import { formatDateTime } from "./usb-log-format";

const PAGE_SIZE = 20;

const fieldLabelClassName = "mb-1 block text-xs font-semibold text-[#5e3f3a]";
const fieldClassName =
    "h-9 w-full rounded-md border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]";
const iconButtonClassName =
    "flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-[#e0e3e5] bg-white text-[#5e3f3a] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50";

const emptyFilters = { keyword: "", staleOnly: false };

// PCs running YevUsbAgent; stale = no sync for 24h (PC off, agent stopped or removed).
export default function UsbAgentList() {
    const [rows, setRows] = useState<UsbAgentDto[]>([]);
    const [draft, setDraft] = useState(emptyFilters);
    const [applied, setApplied] = useState(emptyFilters);
    const [pageIndex, setPageIndex] = useState(1);
    const [sort, setSort] = useState<SortState>(NO_SORT);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    const { isLoading, error, refetch } = useFetchEffect(
        () =>
            UsbLogApi.getAgents({
                pageIndex,
                pageSize: PAGE_SIZE,
                keyword: applied.keyword || undefined,
                staleOnly: applied.staleOnly,
                ...sort,
            }),
        [pageIndex, applied, sort],
        (result) => {
            setRows(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
        },
        "Không thể tải danh sách agent.",
        (message) => toast.error(message),
        "usb-agents"
    );

    const handleSort = (next: SortState) => {
        setPageIndex(1);
        setSort(next);
    };

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
            <section className="rounded-lg border border-[#e0e3e5] bg-white p-2.5 shadow-sm">
                <div className="flex flex-wrap items-end gap-x-2 gap-y-2">
                    <label className="block w-full sm:w-64">
                        <span className={fieldLabelClassName}>Tìm kiếm</span>
                        <input
                            value={draft.keyword}
                            onChange={(event) => setDraft({ ...draft, keyword: event.target.value })}
                            onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                            placeholder="Tên máy, user, phiên bản"
                            className={fieldClassName}
                        />
                    </label>
                    <label
                        className="flex h-9 cursor-pointer items-center gap-2 text-sm text-[#191c1e]"
                        title="Không báo về trong 24 giờ: máy tắt, agent bị dừng hoặc gỡ"
                    >
                        <input
                            type="checkbox"
                            checked={draft.staleOnly}
                            onChange={(event) => setDraft({ ...draft, staleOnly: event.target.checked })}
                            className="h-4 w-4 accent-[#e3000f]"
                        />
                        Mất liên lạc
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
                        <button onClick={handleReset} disabled={isLoading} title="Xoá lọc" aria-label="Xoá lọc" className={iconButtonClassName}>
                            <FilterX className="h-4 w-4" />
                        </button>
                        <button onClick={() => refetch()} disabled={isLoading} title="Làm mới" aria-label="Làm mới" className={iconButtonClassName}>
                            <RefreshCw className="h-4 w-4" />
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
                                <SortableTh label="Máy" sortKey="machineName" sort={sort} onSort={handleSort} className="px-3 py-2" />
                                <SortableTh label="Phiên bản" sortKey="agentVersion" sort={sort} onSort={handleSort} className="px-3 py-2" />
                                <SortableTh label="Người dùng" sortKey="windowsUser" sort={sort} onSort={handleSort} className="hidden px-3 py-2 lg:table-cell" />
                                <SortableTh label="Cài từ" sortKey="firstSeenAt" sort={sort} onSort={handleSort} className="hidden px-3 py-2 lg:table-cell" />
                                <SortableTh label="Báo về lần cuối" sortKey="lastSeenAt" sort={sort} onSort={handleSort} className="px-3 py-2" />
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && rows.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-[#5e3f3a]">
                                        Không có dữ liệu.
                                    </td>
                                </tr>
                            )}
                            {rows.map((row) => (
                                <tr key={row.id} className="border-b border-[#f1f5f9]">
                                    <td className="px-3 py-2 text-sm font-semibold text-[#191c1e]">{row.machineName}</td>
                                    <td className="px-3 py-2 text-sm text-[#5e3f3a]">{row.agentVersion || "-"}</td>
                                    <td className="hidden px-3 py-2 text-sm text-[#5e3f3a] lg:table-cell">{row.windowsUser || "-"}</td>
                                    <td className="hidden whitespace-nowrap px-3 py-2 text-sm text-[#5e3f3a] lg:table-cell">{formatDateTime(row.firstSeenAt)}</td>
                                    <td className="px-3 py-2 text-sm text-[#5e3f3a]">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="whitespace-nowrap">{formatDateTime(row.lastSeenAt)}</span>
                                            {row.isStale && <Badge variant="danger">Mất liên lạc</Badge>}
                                        </div>
                                    </td>
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
