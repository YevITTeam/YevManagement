"use client";

import { Fragment, useState, type ReactNode } from "react";
import { FilterX, RefreshCw, Search } from "lucide-react";
import { toast } from "react-toastify";

import { AuditTrailApi, type GetAuditTrailPageNationParams } from "@/modules/pc-management/api/audit-trail.api";
import type { AuditTrailDto } from "@/modules/pc-management/types/audit-trail.dto";
import { auditActionClasses, auditActionLabels } from "./audit-trail-format";
import AuditTrailDiffView from "./AuditTrailDiffView";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { StyledSelect } from "@/components/ui/StyledSelect";
import type { ApiResponseWithPageNation } from "@/types/api";

const PAGE_SIZE = 20;

const fieldLabelClassName = "mb-1 block text-xs font-semibold text-[#5e3f3a]";
const fieldClassName =
    "h-9 w-full rounded-md border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]";

function formatDateTime(value: string) {
    if (!value) return "-";
    return new Date(value).toLocaleString("vi-VN");
}

interface AuditTrailListProps {
    // Attendance has its own audit table with the same row shape; defaults to Asset's.
    fetchPage?: (params: GetAuditTrailPageNationParams) => Promise<ApiResponseWithPageNation<AuditTrailDto>["data"]>;
    cacheKey?: string;
    // Replaces the page title, e.g. with a tab bar.
    header?: ReactNode;
    tablePlaceholder?: string;
    recordPlaceholder?: string;
}

// BE-recorded Create/Update/Delete/Restore history; needs Asset.AuditTrail.View (or Attendance.AuditTrail.View via fetchPage).
export default function AuditTrailList({
    fetchPage = AuditTrailApi.getAuditTrailPageNation,
    cacheKey = "audit-trail",
    header,
    tablePlaceholder = "Device, Branch...",
    recordPlaceholder = "Mã máy, IP...",
}: AuditTrailListProps = {}) {
    const [rows, setRows] = useState<AuditTrailDto[]>([]);
    const [expandedId, setExpandedId] = useState<number | null>(null);

    const [tableName, setTableName] = useState("");
    const [recordId, setRecordId] = useState("");
    const [recordName, setRecordName] = useState("");
    const [action, setAction] = useState("");
    const [changedBy, setChangedBy] = useState("");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");

    const [appliedFilters, setAppliedFilters] = useState({
        tableName: "",
        recordId: "",
        recordName: "",
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
            fetchPage({
                pageIndex,
                pageSize: PAGE_SIZE,
                tableName: appliedFilters.tableName || undefined,
                recordId: appliedFilters.recordId ? Number(appliedFilters.recordId) : undefined,
                recordName: appliedFilters.recordName || undefined,
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
        (message) => toast.error(message),
        cacheKey
    );

    const handleSearch = () => {
        setPageIndex(1);
        setAppliedFilters({
            tableName: tableName.trim(),
            recordId: recordId.trim(),
            recordName: recordName.trim(),
            action,
            changedBy: changedBy.trim(),
            fromDate,
            toDate,
        });
    };

    const handleReset = () => {
        setTableName("");
        setRecordId("");
        setRecordName("");
        setAction("");
        setChangedBy("");
        setFromDate("");
        setToDate("");
        setPageIndex(1);
        setAppliedFilters({ tableName: "", recordId: "", recordName: "", action: "", changedBy: "", fromDate: "", toDate: "" });
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                {header ?? <h1 className="text-lg font-semibold text-[#191c1e]">Lịch sử thao tác</h1>}
                <button
                    onClick={() => fetchRows()}
                    disabled={isLoading}
                    title="Làm mới"
                    aria-label="Làm mới"
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-[#e0e3e5] bg-white text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <RefreshCw className="h-3.5 w-3.5" />
                </button>
            </div>

            <section className="rounded-lg border border-[#e0e3e5] bg-white p-2.5 shadow-sm">
                <div className="flex flex-wrap items-end gap-x-2 gap-y-2 [&>label]:w-full sm:[&>label]:w-36">
                    <label className="block">
                        <span className={fieldLabelClassName}>Bảng dữ liệu</span>
                        <input
                            value={tableName}
                            onChange={(event) => setTableName(event.target.value)}
                            onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                            placeholder={tablePlaceholder}
                            className={fieldClassName}
                        />
                    </label>
                    <label className="block">
                        <span className={fieldLabelClassName}>Đối tượng</span>
                        <input
                            value={recordName}
                            onChange={(event) => setRecordName(event.target.value)}
                            onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                            placeholder={recordPlaceholder}
                            className={fieldClassName}
                        />
                    </label>
                    <label className="block sm:w-28!">
                        <span className={fieldLabelClassName}>Id bản ghi</span>
                        <input
                            value={recordId}
                            onChange={(event) => setRecordId(event.target.value.replace(/[^0-9]/g, ""))}
                            onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                            placeholder="VD 16925"
                            className={fieldClassName}
                        />
                    </label>
                    <label className="block sm:w-32!">
                        <span className={fieldLabelClassName}>Hành động</span>
                        <StyledSelect
                            value={action}
                            onChange={setAction}
                            triggerClassName={`${fieldClassName} pr-8`}
                            options={[{ value: "", label: "Tất cả" }, ...Object.entries(auditActionLabels).map(([value, label]) => ({ value, label }))]}
                        />
                    </label>
                    <label className="block">
                        <span className={fieldLabelClassName}>Người thao tác</span>
                        <input
                            value={changedBy}
                            onChange={(event) => setChangedBy(event.target.value)}
                            onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                            placeholder="YEV\..."
                            className={fieldClassName}
                        />
                    </label>
                    <label className="block sm:w-40!">
                        <span className={fieldLabelClassName}>Từ ngày</span>
                        <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className={fieldClassName} />
                    </label>
                    <label className="block sm:w-40!">
                        <span className={fieldLabelClassName}>Đến ngày</span>
                        <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className={fieldClassName} />
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
                <div className="flex items-center justify-between border-b border-[#e0e3e5] bg-[#f8fafc] p-4 text-sm text-[#5e3f3a]">
                    {isLoading ? "Đang tải dữ liệu..." : `Hiển thị ${rows.length} / ${totalCount} bản ghi`}
                </div>

                {error && <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>}

                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">
                                <th className="px-3 py-2">Bảng</th>
                                <th className="px-3 py-2">Đối tượng</th>
                                <th className="px-3 py-2">Hành động</th>
                                <th className="px-3 py-2">Người thao tác</th>
                                <th className="px-3 py-2">Thời gian</th>
                                <th className="px-3 py-2 text-right">Chi tiết</th>
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
                                        <td className="px-3 py-2 text-sm font-semibold text-[#191c1e]">{row.tableName}</td>
                                        <td className="px-3 py-2 text-sm text-[#191c1e]">
                                            <div className="flex items-center gap-2">
                                                <span>{row.recordName || "-"}</span>
                                                {row.affectedCount > 1 && (
                                                    <span className="shrink-0 rounded-full border border-[#cfe0fb] bg-[#eef4ff] px-2 py-0.5 text-[10px] font-semibold text-[#1d4ed8]">
                                                        ×{row.affectedCount}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-[#5e3f3a]">#{row.recordId}</div>
                                        </td>
                                        <td className="px-3 py-2">
                                            <span
                                                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${auditActionClasses[row.action] ?? "border border-[#e0e3e5] bg-[#f8fafc] text-[#5e3f3a]"}`}
                                            >
                                                {auditActionLabels[row.action] ?? row.action}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-sm text-[#5e3f3a]">{row.changedBy}</td>
                                        <td className="px-3 py-2 text-sm text-[#5e3f3a]">{formatDateTime(row.changedAt)}</td>
                                        <td className="px-3 py-2 text-right">
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
                                            <td colSpan={6} className="px-3 py-2">
                                                <AuditTrailDiffView
                                                    oldValues={row.oldValues}
                                                    newValues={row.newValues}
                                                    affectedCount={row.affectedCount}
                                                />
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
