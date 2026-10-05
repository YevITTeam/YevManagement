"use client";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { X, Pencil } from "lucide-react";
import { toast } from "react-toastify";

import { IpApi } from "@/modules/pc-management/api/ip-api";
import type { IpAddressDto, IpAddressSkippedDto } from "@/modules/pc-management/types/ip.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import IpForm, { type IpFormValues } from "./IpForm";
import IpBulkStatusForm, { type IpBulkStatusFormValues } from "./IpBulkStatusForm";
import { ipStatusClasses, ipStatusDotClasses, ipStatusLabels, ipStatusOptions } from "./ip-status";
import type { ListHandle, ListToolbarProps } from "../list-toolbar";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { StyledSelect } from "@/components/ui/StyledSelect";

// Lấy hẳn 254 địa chỉ IP (đúng số IP tối đa của 1 dải mạng /24, đã bỏ .0/.255) mỗi lần gọi API
// để giảm số lần bấm "Trang sau" khi xem hết 1 prefix; UI chỉ hiển thị ~10 dòng
// cùng lúc và cho cuộn bên trong bảng (xem div bọc <table> có overflow-y-auto).
const PAGE_SIZE = 254;
const VISIBLE_ROWS = 10;
const ROW_HEIGHT_PX = 53;

// docs/asset-api-fe.md §4.2 (2026-07-11) — IpAddress không còn tạo/xoá thủ công,
// chỉ sinh hàng loạt qua IpPrefix (POST) và dọn qua IpPrefix (DELETE cascade).
// Danh sách này chỉ hỗ trợ xem + sửa status/note của từng IP.
const IpAddressList = forwardRef<ListHandle, ListToolbarProps>(function IpAddressList({ onLoadingChange }, ref) {
    const [ipAddresses, setIpAddresses] = useState<IpAddressDto[]>([]);

    const [keyword, setKeyword] = useState("");
    const [appliedKeyword, setAppliedKeyword] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("");

    const [pageIndex, setPageIndex] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [hasPreviousPage, setHasPreviousPage] = useState(false);

    const [formOpen, setFormOpen] = useState(false);
    const [editingIp, setEditingIp] = useState<IpAddressDto | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [bulkFormOpen, setBulkFormOpen] = useState(false);
    const [isBulkSaving, setIsBulkSaving] = useState(false);
    const [skippedResult, setSkippedResult] = useState<IpAddressSkippedDto[] | null>(null);

    const { isLoading, error, refetch: fetchIpAddresses } = useFetchEffect(
        () =>
            IpApi.getIpAddressPageNation({
                pageIndex,
                pageSize: PAGE_SIZE,
                keyword: appliedKeyword || undefined,
                status: statusFilter !== "" ? Number(statusFilter) : undefined,
            }),
        [pageIndex, appliedKeyword, statusFilter],
        (result) => {
            setIpAddresses(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
            setHasNextPage(result.hasNextPage);
            setHasPreviousPage(result.hasPreviousPage);
        },
        "Không thể tải danh sách địa chỉ IP.",
        (message) => toast.error(message),
        "ip-addresses"
    );

    useEffect(() => {
        onLoadingChange?.(isLoading);
    }, [isLoading, onLoadingChange]);

    useImperativeHandle(ref, () => ({
        refresh: fetchIpAddresses,
        // Không còn "tạo mới" thủ công cho IpAddress — no-op để khớp ListHandle.
        openCreate: () => {},
    }));

    // Đổi trạng thái hàng loạt chỉ nhận status 0/1 (docs/asset-api-fe.md §4.2) — IP "Đã sử dụng"
    // (status=2, đang gắn thiết bị) sẽ luôn bị server bỏ qua, nên chỉ cho chọn khi filter đang
    // khoanh đúng 1 trạng thái 0 hoặc 1 (không cho chọn khi "Tất cả trạng thái" hoặc "Đã sử dụng").
    const canBulkSelect = statusFilter === "0" || statusFilter === "1";

    // Đổi trang/lọc → bỏ chọn hết (dữ liệu hiển thị đã khác), theo pattern "adjusting state
    // when a prop changes" ở AGENTS.md thay vì dùng effect.
    const filtersKey = `${pageIndex}|${appliedKeyword}|${statusFilter}`;
    const [prevFiltersKey, setPrevFiltersKey] = useState(filtersKey);
    if (prevFiltersKey !== filtersKey) {
        setPrevFiltersKey(filtersKey);
        setSelectedIds(new Set());
    }

    const toggleSelected = (id: number) => {
        setSelectedIds((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const allOnPageSelected = ipAddresses.length > 0 && ipAddresses.every((ip) => selectedIds.has(ip.id));

    const toggleSelectAllOnPage = () => {
        setSelectedIds((current) => {
            const next = new Set(current);
            if (allOnPageSelected) {
                ipAddresses.forEach((ip) => next.delete(ip.id));
            } else {
                ipAddresses.forEach((ip) => next.add(ip.id));
            }
            return next;
        });
    };

    const handleSearch = () => {
        setPageIndex(1);
        setAppliedKeyword(keyword.trim());
    };

    const openEditForm = (ip: IpAddressDto) => {
        setEditingIp(ip);
        setFormOpen(true);
    };

    const closeForm = () => {
        if (isSaving) return;
        setFormOpen(false);
        setEditingIp(null);
    };

    const handleSubmitForm = async (values: IpFormValues) => {
        if (!editingIp) return;
        setIsSaving(true);
        try {
            await IpApi.updateIpAddress(editingIp.id, {
                status: Number(values.status),
                note: values.note.trim() || null,
            });
            toast.success("Cập nhật địa chỉ IP thành công");
            setFormOpen(false);
            setEditingIp(null);
            await fetchIpAddresses();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, "Cập nhật địa chỉ IP thất bại"));
        } finally {
            setIsSaving(false);
        }
    };

    const closeBulkForm = () => {
        if (isBulkSaving) return;
        setBulkFormOpen(false);
    };

    const handleSubmitBulkForm = async (values: IpBulkStatusFormValues) => {
        setIsBulkSaving(true);
        try {
            const response = await IpApi.updateIpAddressBulkStatus({
                ids: Array.from(selectedIds),
                status: Number(values.status),
                updateNote: values.updateNote,
                note: values.updateNote ? values.note.trim() || null : null,
            });
            toast.success(response.message || "Cập nhật trạng thái hàng loạt thành công");
            setBulkFormOpen(false);
            setSelectedIds(new Set());
            setSkippedResult(response.data.skippedIpAddresses.length > 0 ? response.data.skippedIpAddresses : null);
            await fetchIpAddresses();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, "Đổi trạng thái hàng loạt thất bại"));
        } finally {
            setIsBulkSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-[#e0e3e5] bg-[#f8fafc] p-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            value={keyword}
                            onChange={(event) => setKeyword(event.target.value)}
                            onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                            placeholder="Tìm theo địa chỉ IP, thiết bị..."
                            className="h-9 w-64 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                        />
                        <button
                            onClick={handleSearch}
                            disabled={isLoading}
                            className="cursor-pointer h-9 rounded-lg border border-[#e0e3e5] bg-white px-4 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50"
                        >
                            Tìm kiếm
                        </button>
                        <StyledSelect
                            value={statusFilter}
                            onChange={(value) => {
                                setStatusFilter(value);
                                setPageIndex(1);
                            }}
                            triggerClassName="h-9 w-44 rounded-lg border border-[#e0e3e5] bg-white px-3 pr-9 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                            options={[
                                { value: "", label: "Tất cả trạng thái" },
                                ...ipStatusOptions.map((status) => ({
                                    value: String(status),
                                    label: ipStatusLabels[status],
                                    dotClassName: ipStatusDotClasses[status],
                                })),
                            ]}
                        />
                        {canBulkSelect && selectedIds.size > 0 && (
                            <button
                                onClick={() => setBulkFormOpen(true)}
                                className="cursor-pointer h-9 rounded-lg bg-[#e3000f] px-4 text-sm font-semibold text-white transition hover:bg-[#b40009]"
                            >
                                Đổi trạng thái hàng loạt ({selectedIds.size})
                            </button>
                        )}
                    </div>
                    <div className="text-sm text-[#5e3f3a]">
                        {isLoading ? "Đang tải dữ liệu..." : `Hiển thị ${ipAddresses.length} / ${totalCount} bản ghi`}
                    </div>
                </div>

                {error && (
                    <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>
                )}

                {skippedResult && (
                    <div className="border-b border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-sm text-[#92400e]">
                        <div className="mb-2 flex items-center justify-between">
                            <span className="font-semibold">Đã bỏ qua {skippedResult.length} địa chỉ IP:</span>
                            <button
                                onClick={() => setSkippedResult(null)}
                                className="cursor-pointer font-semibold text-[#92400e] transition hover:text-[#78350f]"
                                aria-label="Đóng"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <ul className="list-inside list-disc space-y-1">
                            {skippedResult.map((item) => (
                                <li key={item.id}>
                                    <strong>{item.ipAddress}</strong> — {item.reason}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: VISIBLE_ROWS * ROW_HEIGHT_PX }}>
                    <table className="min-w-full border-collapse text-left">
                        <thead className="sticky top-0 z-10">
                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.06em] text-[#5e3f3a]">
                                {canBulkSelect && (
                                    <th className="whitespace-nowrap px-4 py-3">
                                        <input
                                            type="checkbox"
                                            checked={allOnPageSelected}
                                            onChange={toggleSelectAllOnPage}
                                            aria-label="Chọn tất cả"
                                            className="cursor-pointer h-4 w-4 rounded border-[#e0e3e5]"
                                        />
                                    </th>
                                )}
                                <th className="whitespace-nowrap px-3 py-2">Địa chỉ IP</th>
                                <th className="whitespace-nowrap px-3 py-2">Dải mạng</th>
                                <th className="whitespace-nowrap px-3 py-2">Thiết bị</th>
                                <th className="whitespace-nowrap px-3 py-2">Trạng thái</th>
                                <th className="whitespace-nowrap px-3 py-2">Ghi chú</th>
                                <th className="whitespace-nowrap px-3 py-2 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && ipAddresses.length === 0 && (
                                <tr>
                                    <td colSpan={canBulkSelect ? 7 : 6} className="px-6 py-8 text-center text-sm text-[#5e3f3a]">
                                        Không có dữ liệu địa chỉ IP.
                                    </td>
                                </tr>
                            )}
                            {ipAddresses.map((ip) => (
                                <tr key={ip.id} className="border-b border-[#f1f5f9] bg-white transition-colors even:bg-[#f2f4f7] hover:bg-[#e8ecf1]">
                                    {canBulkSelect && (
                                        <td className="whitespace-nowrap px-4 py-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(ip.id)}
                                                onChange={() => toggleSelected(ip.id)}
                                                aria-label={`Chọn ${ip.ipAddress}`}
                                                className="cursor-pointer h-4 w-4 rounded border-[#e0e3e5]"
                                            />
                                        </td>
                                    )}
                                    <td className="whitespace-nowrap px-3 py-2 text-sm font-semibold text-[#191c1e]">{ip.ipAddress}</td>
                                    <td className="whitespace-nowrap px-3 py-2 text-sm text-[#5e3f3a]">{ip.prefix ?? "—"}</td>
                                    <td className="whitespace-nowrap px-3 py-2 text-sm text-[#5e3f3a]">{ip.deviceCode ?? "—"}</td>
                                    <td className="whitespace-nowrap px-3 py-2">
                                        <span
                                            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
                                                ipStatusClasses[ip.status] ?? "border border-[#e0e3e5] bg-[#f8fafc] text-[#5e3f3a]"
                                            }`}
                                        >
                                            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                                            {ip.statusText || "Không xác định"}
                                        </span>
                                    </td>
                                    <td className="max-w-[220px] truncate px-3 py-2 text-sm text-[#5e3f3a]" title={ip.note ?? undefined}>
                                        {ip.note ?? "—"}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2 text-right text-sm">
                                        <button
                                            onClick={() => openEditForm(ip)}
                                            className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border transition disabled:cursor-not-allowed disabled:opacity-40 border-[#e0e3e5] text-[#5e3f3a] hover:bg-[#f2f4f6] hover:text-[#191c1e]"
                                            title="Sửa"
                                            aria-label="Sửa"
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                    </td>
                                </tr>
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

            <IpForm
                isOpen={formOpen}
                initial={editingIp}
                loading={isSaving}
                onClose={closeForm}
                onSubmit={handleSubmitForm}
            />

            <IpBulkStatusForm
                isOpen={bulkFormOpen}
                selectedCount={selectedIds.size}
                loading={isBulkSaving}
                onClose={closeBulkForm}
                onSubmit={handleSubmitBulkForm}
            />
        </div>
    );
});

export default IpAddressList;
