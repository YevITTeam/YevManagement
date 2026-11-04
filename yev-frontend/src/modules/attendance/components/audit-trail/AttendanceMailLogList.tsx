"use client";

import { useState, type ReactNode } from "react";
import { FilterX, RefreshCw, Search } from "lucide-react";
import { toast } from "react-toastify";

import { AttendanceAuditTrailApi } from "@/modules/attendance/api/attendance-audit-trail.api";
import type { AttendanceMailLogDto } from "@/modules/attendance/types/attendance-audit-trail.dto";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { StyledSelect } from "@/components/ui/StyledSelect";

const PAGE_SIZE = 20;

const fieldLabelClassName = "mb-1 block text-xs font-semibold text-[#5e3f3a]";
const fieldClassName =
    "h-9 w-full rounded-md border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]";

const statusLabels: Record<number, string> = { 0: "Đang chờ gửi", 1: "Đã gửi", 2: "Lỗi", 3: "Bỏ qua" };

const statusClasses: Record<number, string> = {
    0: "border border-[#cfe0fb] bg-[#eef4ff] text-[#1d4ed8]",
    1: "border border-emerald-200 bg-emerald-50 text-emerald-600",
    2: "border border-[#e9bcb6] bg-[#fff4f2] text-[#930006]",
    3: "border border-[#e0e3e5] bg-[#f8fafc] text-[#5e3f3a]",
};

function formatDateTime(value: string | null) {
    return value ? new Date(value).toLocaleString("vi-VN") : "-";
}

const emptyFilters = { keyword: "", status: "", fromDate: "", toDate: "" };

export default function AttendanceMailLogList({ header }: { header?: ReactNode }) {
    const [rows, setRows] = useState<AttendanceMailLogDto[]>([]);
    const [filters, setFilters] = useState(emptyFilters);
    const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
    const [pageIndex, setPageIndex] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [hasPreviousPage, setHasPreviousPage] = useState(false);

    const { isLoading, error, refetch } = useFetchEffect(
        () =>
            AttendanceAuditTrailApi.getMailLogPageNation({
                pageIndex,
                pageSize: PAGE_SIZE,
                keyword: appliedFilters.keyword || undefined,
                status: appliedFilters.status === "" ? undefined : Number(appliedFilters.status),
                fromDate: appliedFilters.fromDate || undefined,
                toDate: appliedFilters.toDate || undefined,
            }),
        [pageIndex, appliedFilters],
        (result) => {
            setRows(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
            setHasNextPage(result.hasNextPage);
            setHasPreviousPage(result.hasPreviousPage);
        },
        "Không thể tải nhật ký email.",
        (message) => toast.error(message),
        "attendance-mail-log"
    );

    const setFilter = (key: keyof typeof emptyFilters, value: string) => setFilters((current) => ({ ...current, [key]: value }));

    const handleSearch = () => {
        setPageIndex(1);
        setAppliedFilters({ ...filters, keyword: filters.keyword.trim() });
    };

    const handleReset = () => {
        setFilters(emptyFilters);
        setPageIndex(1);
        setAppliedFilters(emptyFilters);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                {header}
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
                    <label className="block sm:w-56!">
                        <span className={fieldLabelClassName}>Từ khoá</span>
                        <input
                            value={filters.keyword}
                            onChange={(event) => setFilter("keyword", event.target.value)}
                            onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                            placeholder="Người nhận, email, tiêu đề..."
                            className={fieldClassName}
                        />
                    </label>
                    <label className="block sm:w-36!">
                        <span className={fieldLabelClassName}>Trạng thái</span>
                        <StyledSelect
                            value={filters.status}
                            onChange={(value) => setFilter("status", value)}
                            triggerClassName={`${fieldClassName} pr-8`}
                            options={[{ value: "", label: "Tất cả" }, ...Object.entries(statusLabels).map(([value, label]) => ({ value, label }))]}
                        />
                    </label>
                    <label className="block">
                        <span className={fieldLabelClassName}>Từ ngày</span>
                        <input type="date" value={filters.fromDate} onChange={(event) => setFilter("fromDate", event.target.value)} className={fieldClassName} />
                    </label>
                    <label className="block">
                        <span className={fieldLabelClassName}>Đến ngày</span>
                        <input type="date" value={filters.toDate} onChange={(event) => setFilter("toDate", event.target.value)} className={fieldClassName} />
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
                <div className="border-b border-[#e0e3e5] bg-[#f8fafc] p-4 text-sm text-[#5e3f3a]">
                    {isLoading ? "Đang tải dữ liệu..." : `Hiển thị ${rows.length} / ${totalCount} email`}
                </div>

                {error && <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>}

                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">
                                <th className="px-3 py-2">Thời gian</th>
                                <th className="px-3 py-2">Người nhận</th>
                                <th className="px-3 py-2">Tiêu đề</th>
                                <th className="px-3 py-2">Trạng thái</th>
                                <th className="px-3 py-2">Gửi lúc</th>
                                <th className="px-3 py-2">Người thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && rows.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-sm text-[#5e3f3a]">
                                        Không có dữ liệu.
                                    </td>
                                </tr>
                            )}
                            {rows.map((row) => {
                                const retrying = row.status === 0 && row.lastError;
                                return (
                                    <tr key={row.id} className="border-b border-[#f1f5f9] align-top">
                                        <td className="whitespace-nowrap px-3 py-2 text-sm text-[#5e3f3a]">{formatDateTime(row.createdAt)}</td>
                                        <td className="px-3 py-2 text-sm text-[#191c1e]">
                                            <div className="font-semibold">{row.recipientUserName ?? "-"}</div>
                                            <div className="text-xs text-[#5e3f3a]">{row.toEmail ?? "-"}</div>
                                        </td>
                                        <td className="px-3 py-2 text-sm text-[#191c1e]">{row.subject}</td>
                                        <td className="px-3 py-2">
                                            <span className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[row.status]}`}>
                                                {retrying ? `Đang thử lại (${row.attempts})` : statusLabels[row.status]}
                                            </span>
                                            {row.lastError && <div className="mt-1 max-w-xs text-xs text-[#930006]">{row.lastError}</div>}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-2 text-sm text-[#5e3f3a]">{formatDateTime(row.sentAt)}</td>
                                        <td className="px-3 py-2 text-sm text-[#5e3f3a]">{row.requestedBy}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="flex items-center justify-between border-t border-[#e0e3e5] p-4">
                    <button
                        className="cursor-pointer text-sm text-[#5e3f3a] disabled:opacity-50"
                        disabled={!hasPreviousPage || isLoading}
                        onClick={() => setPageIndex((current) => Math.max(1, current - 1))}
                    >
                        Trang trước
                    </button>
                    <div className="flex h-8 items-center px-3 text-sm font-semibold text-[#191c1e]">
                        Trang {pageIndex} / {totalPages}
                    </div>
                    <button
                        className="cursor-pointer text-sm text-[#5e3f3a] disabled:opacity-50"
                        disabled={!hasNextPage || isLoading}
                        onClick={() => setPageIndex((current) => current + 1)}
                    >
                        Trang sau
                    </button>
                </div>
            </section>
        </div>
    );
}
