"use client";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { toast } from "react-toastify";

import { IpApi } from "@/modules/pc-management/api/ip-api";
import type { IpPrefixDto } from "@/modules/pc-management/types/ip.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import IpPrefixForm, { type IpPrefixFormValues } from "./IpPrefixForm";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import type { ListHandle, ListToolbarProps } from "../list-toolbar";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import { Pencil, Trash2 } from "lucide-react";

const PAGE_SIZE = 10;

const IpPrefixList = forwardRef<ListHandle, ListToolbarProps>(function IpPrefixList({ onLoadingChange }, ref) {
    const [prefixes, setPrefixes] = useState<IpPrefixDto[]>([]);

    const [keyword, setKeyword] = useState("");
    const [appliedKeyword, setAppliedKeyword] = useState("");

    const [pageIndex, setPageIndex] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [hasPreviousPage, setHasPreviousPage] = useState(false);

    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<"create" | "edit">("create");
    const [editingPrefix, setEditingPrefix] = useState<IpPrefixDto | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [deletingPrefix, setDeletingPrefix] = useState<IpPrefixDto | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const { isLoading, error, refetch: fetchPrefixes } = useFetchEffect(
        () => IpApi.getIpPrefixPageNation({ pageIndex, pageSize: PAGE_SIZE, keyword: appliedKeyword || undefined }),
        [pageIndex, appliedKeyword],
        (result) => {
            setPrefixes(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
            setHasNextPage(result.hasNextPage);
            setHasPreviousPage(result.hasPreviousPage);
        },
        "Không thể tải danh sách dải mạng.",
        (message) => toast.error(message),
        "ip-prefixes"
    );

    useEffect(() => {
        onLoadingChange?.(isLoading);
    }, [isLoading, onLoadingChange]);

    useImperativeHandle(ref, () => ({
        refresh: fetchPrefixes,
        openCreate: openCreateForm,
    }));

    const handleSearch = () => {
        setPageIndex(1);
        setAppliedKeyword(keyword.trim());
    };

    const openCreateForm = () => {
        setFormMode("create");
        setEditingPrefix(null);
        setFormOpen(true);
    };

    const openEditForm = (prefix: IpPrefixDto) => {
        setFormMode("edit");
        setEditingPrefix(prefix);
        setFormOpen(true);
    };

    const closeForm = () => {
        if (isSaving) return;
        setFormOpen(false);
        setEditingPrefix(null);
    };

    const handleSubmitForm = async (values: IpPrefixFormValues) => {
        setIsSaving(true);
        try {
            if (formMode === "create") {
                const created = await IpApi.createIpPrefix({
                    prefix: values.prefix.trim(),
                    branchId: values.branchId,
                    subnetMask: values.subnetMask.trim() || null,
                    gateway: values.gateway.trim() || null,
                    preferredDns: values.preferredDns.trim() || null,
                    alternateDns: values.alternateDns.trim() || null,
                    description: values.description.trim() || null,
                });
                toast.success(`Tạo dải mạng thành công, đã sinh ${created.availableIpCount} địa chỉ IP.`);
            } else if (editingPrefix) {
                await IpApi.updateIpPrefix(editingPrefix.id, {
                    branchId: values.branchId,
                    subnetMask: values.subnetMask.trim() || null,
                    gateway: values.gateway.trim() || null,
                    preferredDns: values.preferredDns.trim() || null,
                    alternateDns: values.alternateDns.trim() || null,
                    description: values.description.trim() || null,
                });
                toast.success("Cập nhật dải mạng thành công");
            }
            setFormOpen(false);
            setEditingPrefix(null);
            await fetchPrefixes();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, formMode === "create" ? "Tạo dải mạng thất bại" : "Cập nhật dải mạng thất bại"));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingPrefix) return;
        setIsDeleting(true);
        try {
            await IpApi.deleteIpPrefix(deletingPrefix.id);
            toast.success("Xoá dải mạng thành công");
            setDeletingPrefix(null);
            await fetchPrefixes();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, "Xoá dải mạng thất bại"));
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
                            placeholder="Tìm theo dải mạng, mô tả..."
                            className="h-9 w-64 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                        />
                        <button
                            onClick={handleSearch}
                            disabled={isLoading}
                            className="cursor-pointer h-9 rounded-lg border border-[#e0e3e5] bg-white px-4 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50"
                        >
                            Tìm kiếm
                        </button>
                    </div>
                    <div className="text-sm text-[#5e3f3a]">
                        {isLoading ? "Đang tải dữ liệu..." : `Hiển thị ${prefixes.length} / ${totalCount} bản ghi`}
                    </div>
                </div>

                {error && (
                    <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>
                )}

                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.06em] text-[#5e3f3a]">
                                <th className="whitespace-nowrap px-3 py-2">Dải mạng</th>
                                <th className="whitespace-nowrap px-3 py-2">Chi nhánh</th>
                                <th className="whitespace-nowrap px-3 py-2">Subnet mask</th>
                                <th className="whitespace-nowrap px-3 py-2">Gateway</th>
                                <th className="whitespace-nowrap px-3 py-2">DNS</th>
                                <th className="whitespace-nowrap px-3 py-2">Mô tả</th>
                                <th className="whitespace-nowrap px-3 py-2 text-center">IP đã dùng/ còn trống</th>
                                <th className="whitespace-nowrap px-3 py-2 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && prefixes.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-6 py-8 text-center text-sm text-[#5e3f3a]">
                                        Không có dữ liệu dải mạng.
                                    </td>
                                </tr>
                            )}
                            {prefixes.map((prefix) => (
                                <tr key={prefix.id} className="border-b border-[#f1f5f9] bg-white transition-colors even:bg-[#f2f4f7] hover:bg-[#e8ecf1]">
                                    <td className="whitespace-nowrap px-3 py-2 text-sm font-semibold text-[#191c1e]">{prefix.prefix}</td>
                                    <td className="whitespace-nowrap px-3 py-2 text-sm text-[#5e3f3a]">{prefix.branchName ?? "—"}</td>
                                    <td className="whitespace-nowrap px-3 py-2 text-sm text-[#5e3f3a]">{prefix.subnetMask ?? "—"}</td>
                                    <td className="whitespace-nowrap px-3 py-2 text-sm text-[#5e3f3a]">{prefix.gateway ?? "—"}</td>
                                    <td className="whitespace-nowrap px-3 py-2 text-sm text-[#5e3f3a]">
                                        {prefix.preferredDns || prefix.alternateDns
                                            ? [prefix.preferredDns, prefix.alternateDns].filter(Boolean).join(" / ")
                                            : "—"}
                                    </td>
                                    <td className="max-w-[220px] truncate px-3 py-2 text-sm text-[#5e3f3a]" title={prefix.description ?? undefined}>
                                        {prefix.description ?? "—"}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2 text-center text-sm text-[#5e3f3a]">
                                        {prefix.usedIpCount} / {prefix.availableIpCount}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2 text-right text-sm">
                                        <div className="inline-flex items-center gap-1.5">
                                            <button
                                                onClick={() => openEditForm(prefix)}
                                                className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border transition disabled:cursor-not-allowed disabled:opacity-40 border-[#e0e3e5] text-[#5e3f3a] hover:bg-[#f2f4f6] hover:text-[#191c1e]"
                                                title="Sửa"
                                                aria-label="Sửa"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                onClick={() => setDeletingPrefix(prefix)}
                                                className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border transition disabled:cursor-not-allowed disabled:opacity-40 border-[#e9bcb6] text-[#930006] hover:bg-[#fff4f2]"
                                                title="Xoá"
                                                aria-label="Xoá"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
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

            <IpPrefixForm
                isOpen={formOpen}
                mode={formMode}
                initial={editingPrefix}
                loading={isSaving}
                onClose={closeForm}
                onSubmit={handleSubmitForm}
            />

            <ConfirmDialog
                isOpen={deletingPrefix !== null}
                title="Xoá dải mạng"
                message={
                    <>
                        Bạn có chắc muốn xoá dải mạng <strong>{deletingPrefix?.prefix}</strong> không? Nếu còn IP đang gán cho
                        thiết bị, thao tác sẽ bị chặn. Nếu không, xoá dải mạng sẽ <strong>xoá luôn toàn bộ {deletingPrefix?.availableIpCount ?? 0} địa chỉ IP con</strong> chưa dùng — hành động này không thể hoàn tác.
                    </>
                }
                approveLabel="Xoá"
                deniedLabel="Huỷ"
                loading={isDeleting}
                onApprove={handleDelete}
                onDenied={() => {
                    if (!isDeleting) setDeletingPrefix(null);
                }}
            />
        </div>
    );
});

export default IpPrefixList;
