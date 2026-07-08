"use client";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { toast } from "react-toastify";

import { IpApi } from "@/modules/pc-management/api/ip-api";
import type { IpAddressDto, IpPrefixDto } from "@/modules/pc-management/types/ip.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import IpForm, { type IpFormValues } from "./IpForm";
import { ipStatusClasses } from "./ip-status";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import type { ListHandle, ListToolbarProps } from "../list-toolbar";

const PAGE_SIZE = 10;

const IpAddressList = forwardRef<ListHandle, ListToolbarProps>(function IpAddressList({ onLoadingChange }, ref) {
    const [ipAddresses, setIpAddresses] = useState<IpAddressDto[]>([]);
    const [prefixes, setPrefixes] = useState<IpPrefixDto[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [keyword, setKeyword] = useState("");
    const [appliedKeyword, setAppliedKeyword] = useState("");

    const [pageIndex, setPageIndex] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [hasPreviousPage, setHasPreviousPage] = useState(false);

    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<"create" | "edit">("create");
    const [editingIp, setEditingIp] = useState<IpAddressDto | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [deletingIp, setDeletingIp] = useState<IpAddressDto | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchIpAddresses = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await IpApi.getIpAddressPageNation({
                pageIndex,
                pageSize: PAGE_SIZE,
                keyword: appliedKeyword || undefined,
            });
            setIpAddresses(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
            setHasNextPage(result.hasNextPage);
            setHasPreviousPage(result.hasPreviousPage);
        } catch (err) {
            console.error(err);
            const message = getApiErrorMessage(err, "Không thể tải danh sách địa chỉ IP.");
            setError(message);
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchIpAddresses();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageIndex, appliedKeyword]);

    useEffect(() => {
        onLoadingChange?.(isLoading);
    }, [isLoading, onLoadingChange]);

    useImperativeHandle(ref, () => ({
        refresh: fetchIpAddresses,
        openCreate: openCreateForm,
    }));

    useEffect(() => {
        let isCancelled = false;
        (async () => {
            try {
                const result = await IpApi.getAllIpPrefix();
                if (!isCancelled) setPrefixes(result);
            } catch (err) {
                console.error(err);
                if (!isCancelled) toast.error("Không thể tải danh sách dải mạng.");
            }
        })();
        return () => {
            isCancelled = true;
        };
    }, []);

    const handleSearch = () => {
        setPageIndex(1);
        setAppliedKeyword(keyword.trim());
    };

    const openCreateForm = () => {
        setFormMode("create");
        setEditingIp(null);
        setFormOpen(true);
    };

    const openEditForm = (ip: IpAddressDto) => {
        setFormMode("edit");
        setEditingIp(ip);
        setFormOpen(true);
    };

    const closeForm = () => {
        if (isSaving) return;
        setFormOpen(false);
        setEditingIp(null);
    };

    const handleSubmitForm = async (values: IpFormValues) => {
        setIsSaving(true);
        try {
            const payload = {
                ipAddress: values.ipAddress.trim(),
                ipPrefixId: Number(values.ipPrefixId),
                serverIp: values.serverIp.trim() || null,
                deviceId: editingIp?.deviceId ?? null,
                status: values.status === "" ? null : Number(values.status),
                note: values.note.trim() || null,
            };

            if (formMode === "create") {
                await IpApi.createIpAddress(payload);
                toast.success("Tạo địa chỉ IP thành công");
            } else if (editingIp) {
                await IpApi.updateIpAddress(editingIp.id, payload);
                toast.success("Cập nhật địa chỉ IP thành công");
            }
            setFormOpen(false);
            setEditingIp(null);
            await fetchIpAddresses();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, formMode === "create" ? "Tạo địa chỉ IP thất bại" : "Cập nhật địa chỉ IP thất bại"));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingIp) return;
        setIsDeleting(true);
        try {
            await IpApi.deleteIpAddress(deletingIp.id);
            toast.success("Xoá địa chỉ IP thành công");
            setDeletingIp(null);
            await fetchIpAddresses();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, "Xoá địa chỉ IP thất bại"));
        } finally {
            setIsDeleting(false);
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
                    </div>
                    <div className="text-sm text-[#5e3f3a]">
                        {isLoading ? "Đang tải dữ liệu..." : `Hiển thị ${ipAddresses.length} / ${totalCount} bản ghi`}
                    </div>
                </div>

                {error && (
                    <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>
                )}

                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                <th className="whitespace-nowrap px-6 py-3">Địa chỉ IP</th>
                                <th className="whitespace-nowrap px-6 py-3">Dải mạng</th>
                                <th className="whitespace-nowrap px-6 py-3">Server IP</th>
                                <th className="whitespace-nowrap px-6 py-3">Thiết bị</th>
                                <th className="whitespace-nowrap px-6 py-3">Trạng thái</th>
                                <th className="whitespace-nowrap px-6 py-3">Ghi chú</th>
                                <th className="whitespace-nowrap px-6 py-3 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && ipAddresses.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-sm text-[#5e3f3a]">
                                        Không có dữ liệu địa chỉ IP.
                                    </td>
                                </tr>
                            )}
                            {ipAddresses.map((ip) => (
                                <tr key={ip.id} className="border-b border-[#f1f5f9] transition-colors hover:bg-[#f8fafc]">
                                    <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-[#191c1e]">{ip.ipAddress}</td>
                                    <td className="whitespace-nowrap px-6 py-4 text-sm text-[#5e3f3a]">{ip.prefix ?? "—"}</td>
                                    <td className="whitespace-nowrap px-6 py-4 text-sm text-[#5e3f3a]">{ip.serverIp ?? "—"}</td>
                                    <td className="whitespace-nowrap px-6 py-4 text-sm text-[#5e3f3a]">{ip.deviceCode ?? "—"}</td>
                                    <td className="whitespace-nowrap px-6 py-4">
                                        <span
                                            className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                                ipStatusClasses[ip.status] ?? "border border-[#e0e3e5] bg-[#f8fafc] text-[#5e3f3a]"
                                            }`}
                                        >
                                            {ip.statusText || "Không xác định"}
                                        </span>
                                    </td>
                                    <td className="max-w-[220px] truncate px-6 py-4 text-sm text-[#5e3f3a]" title={ip.note ?? undefined}>
                                        {ip.note ?? "—"}
                                    </td>
                                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                                        <div className="inline-flex items-center gap-3">
                                            <button
                                                onClick={() => openEditForm(ip)}
                                                className="cursor-pointer font-semibold text-[#5e3f3a] transition hover:text-[#191c1e]"
                                                title="Sửa"
                                            >
                                                Sửa
                                            </button>
                                            <button
                                                onClick={() => setDeletingIp(ip)}
                                                className="cursor-pointer font-semibold text-[#930006] transition hover:text-[#e3000f]"
                                                title="Xoá"
                                            >
                                                Xoá
                                            </button>
                                        </div>
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
                mode={formMode}
                initial={editingIp}
                prefixes={prefixes}
                loading={isSaving}
                onClose={closeForm}
                onSubmit={handleSubmitForm}
            />

            <ConfirmDialog
                isOpen={deletingIp !== null}
                title="Xoá địa chỉ IP"
                message={
                    <>
                        Bạn có chắc muốn xoá địa chỉ IP <strong>{deletingIp?.ipAddress}</strong> không? Hành động này không thể
                        hoàn tác.
                    </>
                }
                approveLabel="Xoá"
                deniedLabel="Huỷ"
                loading={isDeleting}
                onApprove={handleDelete}
                onDenied={() => {
                    if (!isDeleting) setDeletingIp(null);
                }}
            />
        </div>
    );
});

export default IpAddressList;
