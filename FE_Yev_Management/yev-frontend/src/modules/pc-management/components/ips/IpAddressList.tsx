"use client";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { toast } from "react-toastify";

import { IpApi } from "@/modules/pc-management/api/ip-api";
import type { IpAddressDto } from "@/modules/pc-management/types/ip.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import IpForm, { type IpFormValues } from "./IpForm";
import { ipStatusClasses, ipStatusLabels, ipStatusOptions } from "./ip-status";
import type { ListHandle, ListToolbarProps } from "../list-toolbar";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

// Lấy hẳn 255 địa chỉ IP (đúng số IP tối đa của 1 dải mạng /24) mỗi lần gọi API
// để giảm số lần bấm "Trang sau" khi xem hết 1 prefix; UI chỉ hiển thị ~10 dòng
// cùng lúc và cho cuộn bên trong bảng (xem div bọc <table> có overflow-y-auto).
const PAGE_SIZE = 255;
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
        (message) => toast.error(message)
    );

    useEffect(() => {
        onLoadingChange?.(isLoading);
    }, [isLoading, onLoadingChange]);

    useImperativeHandle(ref, () => ({
        refresh: fetchIpAddresses,
        // Không còn "tạo mới" thủ công cho IpAddress — no-op để khớp ListHandle.
        openCreate: () => {},
    }));

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

    return (
        <div className="space-y-4">
            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-[#e0e3e5] bg-[#f8fafc] p-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex gap-2">
                        <input
                            value={keyword}
                            onChange={(event) => setKeyword(event.target.value)}
                            onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                            placeholder="Tìm theo địa chỉ IP, thiết bị..."
                            className="h-10 w-64 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                        />
                        <button
                            onClick={handleSearch}
                            disabled={isLoading}
                            className="cursor-pointer h-10 rounded-lg border border-[#e0e3e5] bg-white px-4 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50"
                        >
                            Tìm kiếm
                        </button>
                        <select
                            value={statusFilter}
                            onChange={(event) => {
                                setStatusFilter(event.target.value);
                                setPageIndex(1);
                            }}
                            className="h-10 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                        >
                            <option value="">Tất cả trạng thái</option>
                            {ipStatusOptions.map((status) => (
                                <option key={status} value={status}>
                                    {ipStatusLabels[status]}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="text-sm text-[#5e3f3a]">
                        {isLoading ? "Đang tải dữ liệu..." : `Hiển thị ${ipAddresses.length} / ${totalCount} bản ghi`}
                    </div>
                </div>

                {error && (
                    <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>
                )}

                <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: VISIBLE_ROWS * ROW_HEIGHT_PX }}>
                    <table className="min-w-full border-collapse text-left">
                        <thead className="sticky top-0 z-10">
                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                <th className="whitespace-nowrap px-6 py-3">Địa chỉ IP</th>
                                <th className="whitespace-nowrap px-6 py-3">Dải mạng</th>
                                <th className="whitespace-nowrap px-6 py-3">Thiết bị</th>
                                <th className="whitespace-nowrap px-6 py-3">Trạng thái</th>
                                <th className="whitespace-nowrap px-6 py-3">Ghi chú</th>
                                <th className="whitespace-nowrap px-6 py-3 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && ipAddresses.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-sm text-[#5e3f3a]">
                                        Không có dữ liệu địa chỉ IP.
                                    </td>
                                </tr>
                            )}
                            {ipAddresses.map((ip) => (
                                <tr key={ip.id} className="border-b border-[#f1f5f9] transition-colors hover:bg-[#f8fafc]">
                                    <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-[#191c1e]">{ip.ipAddress}</td>
                                    <td className="whitespace-nowrap px-6 py-4 text-sm text-[#5e3f3a]">{ip.prefix ?? "—"}</td>
                                    <td className="whitespace-nowrap px-6 py-4 text-sm text-[#5e3f3a]">{ip.deviceCode ?? "—"}</td>
                                    <td className="whitespace-nowrap px-6 py-4">
                                        <span
                                            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
                                                ipStatusClasses[ip.status] ?? "border border-[#e0e3e5] bg-[#f8fafc] text-[#5e3f3a]"
                                            }`}
                                        >
                                            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                                            {ip.statusText || "Không xác định"}
                                        </span>
                                    </td>
                                    <td className="max-w-[220px] truncate px-6 py-4 text-sm text-[#5e3f3a]" title={ip.note ?? undefined}>
                                        {ip.note ?? "—"}
                                    </td>
                                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                                        <button
                                            onClick={() => openEditForm(ip)}
                                            className="cursor-pointer font-semibold text-[#5e3f3a] transition hover:text-[#191c1e]"
                                            title="Sửa"
                                        >
                                            Sửa
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
        </div>
    );
});

export default IpAddressList;
