"use client";

import { Fragment, useState } from "react";
import { toast } from "react-toastify";

import { AuditTrailApi } from "@/modules/pc-management/api/audit-trail.api";
import type { AuditTrailDto } from "@/modules/pc-management/types/audit-trail.dto";
import { auditActionClasses, auditActionLabels } from "./audit-trail-format";
import AuditTrailDiffView from "./AuditTrailDiffView";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

const PAGE_SIZE = 20;

const fieldLabelClassName = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]";
const fieldClassName =
    "h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]";

function formatDateTime(value: string) {
    if (!value) return "-";
    return new Date(value).toLocaleString("vi-VN");
}

// docs/asset-api-fe.md §7b — màn quản trị đọc lịch sử Create/Update/Delete/Restore ghi tự động ở BE
// cho toàn bộ entity Asset. Chỉ Admin (hoặc role được cấp Asset.AuditTrail.View) thấy màn này.
export default function AuditTrailList() {
    const [rows, setRows] = useState<AuditTrailDto[]>([]);
    const [expandedId, setExpandedId] = useState<number | null>(null);

    const [tableName, setTableName] = useState("");
    const [recordId, setRecordId] = useState("");
    const [action, setAction] = useState("");
    const [changedBy, setChangedBy] = useState("");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");

    const [appliedFilters, setAppliedFilters] = useState({
        tableName: "",
        recordId: "",
        action: "",
        changedBy: "",
        fromDate: "",
        toDate: "",
    });

    const [pageIndex, setPageIndex] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [hasPreviousPage, setHasPreviousPage] = useState(false);

    const { isLoading, error, refetch: fetchRows } = useFetchEffect(
        () =>
            AuditTrailApi.getAuditTrailPageNation({
                pageIndex,
                pageSize: PAGE_SIZE,
                tableName: appliedFilters.tableName || undefined,
                recordId: appliedFilters.recordId ? Number(appliedFilters.recordId) : undefined,
                action: appliedFilters.action || undefined,
                changedBy: appliedFilters.changedBy || undefined,
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
        "Không thể tải lịch sử thao tác.",
        (message) => toast.error(message)
    );

    const handleSearch = () => {
        setPageIndex(1);
        setAppliedFilters({
            tableName: tableName.trim(),
            recordId: recordId.trim(),
            action,
            changedBy: changedBy.trim(),
            fromDate,
            toDate,
        });
    };

    const handleReset = () => {
        setTableName("");
        setRecordId("");
        setAction("");
        setChangedBy("");
        setFromDate("");
        setToDate("");
        setPageIndex(1);
        setAppliedFilters({ tableName: "", recordId: "", action: "", changedBy: "", fromDate: "", toDate: "" });
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-[#191c1e]">Lịch sử thao tác</h1>
                    <p className="mt-1 text-[15px] text-[#5e3f3a]">
                        Nhật ký Tạo/Sửa/Xoá/Khôi phục tự động ghi lại cho toàn bộ dữ liệu quản lý thiết bị.
                    </p>
                </div>
                <button
                    onClick={() => fetchRows()}
                    disabled={isLoading}
                    className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50"
                >
                    ↻ Làm mới
                </button>
            </div>

            <section className="rounded-xl border border-[#e0e3e5] bg-white p-4 shadow-sm">
                <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                    <label className="block">
                        <span className={fieldLabelClassName}>Đối tượng (tableName)</span>
                        <input
                            value={tableName}
                            onChange={(event) => setTableName(event.target.value)}
                            onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                            placeholder="Device, Branch..."
                            className={fieldClassName}
                        />
                    </label>
                    <label className="block">
                        <span className={fieldLabelClassName}>Id bản ghi</span>
                        <input
                            value={recordId}
                            onChange={(event) => setRecordId(event.target.value.replace(/[^0-9]/g, ""))}
                            onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                            placeholder="VD 16925"
                            className={fieldClassName}
                        />
                    </label>
                    <label className="block">
                        <span className={fieldLabelClassName}>Hành động</span>
                        <select value={action} onChange={(event) => setAction(event.target.value)} className={fieldClassName}>
                            <option value="">Tất cả</option>
                            {Object.entries(auditActionLabels).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="block">
                        <span className={fieldLabelClassName}>Người thao tác</span>
                        <input
                            value={changedBy}
                            onChange={(event) => setChangedBy(event.target.value)}
                            onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                            placeholder="YEV\\..."
                            className={fieldClassName}
                        />
                    </label>
                    <label className="block">
                        <span className={fieldLabelClassName}>Từ ngày</span>
                        <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className={fieldClassName} />
                    </label>
                    <label className="block">
                        <span className={fieldLabelClassName}>Đến ngày</span>
                        <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className={fieldClassName} />
                    </label>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                    <button
                        onClick={handleReset}
                        disabled={isLoading}
                        className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50"
                    >
                        Xoá lọc
                    </button>
                    <button
                        onClick={handleSearch}
                        disabled={isLoading}
                        className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:opacity-50"
                    >
                        Tìm kiếm
                    </button>
                </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-[#e0e3e5] bg-[#f8fafc] p-4 text-sm text-[#5e3f3a]">
                    {isLoading ? "Đang tải dữ liệu..." : `Hiển thị ${rows.length} / ${totalCount} bản ghi`}
                </div>

                {error && <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>}

                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">
                                <th className="px-6 py-3">Đối tượng</th>
                                <th className="px-6 py-3">Id</th>
                                <th className="px-6 py-3">Hành động</th>
                                <th className="px-6 py-3">Người thao tác</th>
                                <th className="px-6 py-3">Thời gian</th>
                                <th className="px-6 py-3 text-right">Chi tiết</th>
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
                            {rows.map((row) => (
                                <Fragment key={row.id}>
                                    <tr className="border-b border-[#f1f5f9]">
                                        <td className="px-6 py-3 text-sm font-semibold text-[#191c1e]">{row.tableName}</td>
                                        <td className="px-6 py-3 text-sm text-[#191c1e]">{row.recordId}</td>
                                        <td className="px-6 py-3">
                                            <span
                                                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${auditActionClasses[row.action] ?? "border border-[#e0e3e5] bg-[#f8fafc] text-[#5e3f3a]"}`}
                                            >
                                                {auditActionLabels[row.action] ?? row.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-sm text-[#5e3f3a]">{row.changedBy}</td>
                                        <td className="px-6 py-3 text-sm text-[#5e3f3a]">{formatDateTime(row.changedAt)}</td>
                                        <td className="px-6 py-3 text-right">
                                            <button
                                                onClick={() => setExpandedId((current) => (current === row.id ? null : row.id))}
                                                className="cursor-pointer font-semibold text-[#5e3f3a] transition hover:text-[#191c1e]"
                                            >
                                                {expandedId === row.id ? "Ẩn" : "Xem"}
                                            </button>
                                        </td>
                                    </tr>
                                    {expandedId === row.id && (
                                        <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                                            <td colSpan={6} className="px-6 py-4">
                                                <AuditTrailDiffView oldValues={row.oldValues} newValues={row.newValues} />
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
