"use client";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "react-toastify";

import { SupplierApi } from "@/modules/pc-management/api/supplier.api";
import type { SupplierDto } from "@/modules/pc-management/types/supplier.dto";
import SupplierForm, { type SupplierFormValues } from "./SupplierForm";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

const PAGE_SIZE = 10;

export default function SupplierList() {
    const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);

    const [keyword, setKeyword] = useState("");
    const [appliedKeyword, setAppliedKeyword] = useState("");

    const [pageIndex, setPageIndex] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [hasPreviousPage, setHasPreviousPage] = useState(false);

    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<"create" | "edit">("create");
    const [editingSupplier, setEditingSupplier] = useState<SupplierDto | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [deletingSupplier, setDeletingSupplier] = useState<SupplierDto | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const { isLoading, error, refetch: fetchSuppliers } = useFetchEffect(
        () => SupplierApi.getSupplierPageNation({ pageIndex, pageSize: PAGE_SIZE, keyword: appliedKeyword || undefined }),
        [pageIndex, appliedKeyword],
        (result) => {
            setSuppliers(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
            setHasNextPage(result.hasNextPage);
            setHasPreviousPage(result.hasPreviousPage);
        },
        "Không thể tải danh sách nhà cung cấp.",
        (message) => toast.error(message)
    );

    const handleSearch = () => {
        setPageIndex(1);
        setAppliedKeyword(keyword.trim());
    };

    const openCreateForm = () => {
        setFormMode("create");
        setEditingSupplier(null);
        setFormOpen(true);
    };

    const openEditForm = (supplier: SupplierDto) => {
        setFormMode("edit");
        setEditingSupplier(supplier);
        setFormOpen(true);
    };

    const closeForm = () => {
        if (isSaving) return;
        setFormOpen(false);
        setEditingSupplier(null);
    };

    const handleSubmitForm = async (values: SupplierFormValues) => {
        setIsSaving(true);
        try {
            if (formMode === "create") {
                await SupplierApi.createSupplier(values);
                toast.success("Tạo nhà cung cấp thành công");
            } else if (editingSupplier) {
                await SupplierApi.updateSupplier(editingSupplier.id, values);
                toast.success("Cập nhật nhà cung cấp thành công");
            }
            setFormOpen(false);
            setEditingSupplier(null);
            await fetchSuppliers();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, formMode === "create" ? "Tạo nhà cung cấp thất bại" : "Cập nhật nhà cung cấp thất bại"));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingSupplier) return;
        setIsDeleting(true);
        try {
            await SupplierApi.deleteSupplier(deletingSupplier.id);
            toast.success("Xoá nhà cung cấp thành công");
            setDeletingSupplier(null);
            await fetchSuppliers();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, "Xoá nhà cung cấp thất bại"));
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-[#191c1e]">Nhà cung cấp</h1>
                    <p className="mt-1 text-[15px] text-[#5e3f3a]">Quản lý các nhóm nhà cung cấp và mô tả.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => fetchSuppliers()}
                        disabled={isLoading}
                        className="flex cursor-pointer items-center gap-1.5 rounded-md border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50"
                    >
                        <RefreshCw className="h-3.5 w-3.5" /> Làm mới
                    </button>
                    <button
                        onClick={openCreateForm}
                        className="cursor-pointer rounded-md bg-[#e3000f] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#b40009]"
                    >
                        + Thêm mới
                    </button>
                </div>
            </div>

            <section className="overflow-hidden border border-[#e0e3e5] bg-white">
                <div className="flex flex-col gap-3 border-b border-[#e0e3e5] bg-[#f8fafc] p-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex gap-2">
                        <input
                            value={keyword}
                            onChange={(event) => setKeyword(event.target.value)}
                            onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                            placeholder="Tìm theo mã hoặc tên nhà cung cấp..."
                            className="h-10 w-64 border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                        />
                        <button
                            onClick={handleSearch}
                            disabled={isLoading}
                            className="cursor-pointer h-10 border border-[#e0e3e5] bg-white px-4 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50"
                        >
                            Tìm kiếm
                        </button>
                    </div>
                    <div className="text-sm text-[#5e3f3a]">
                        {isLoading ? "Đang tải dữ liệu..." : `Hiển thị ${suppliers.length} / ${totalCount} bản ghi`}
                    </div>
                </div>

                {error && (
                    <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>
                )}

                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">
                                <th className="px-6 py-3">ID</th>
                                <th className="px-6 py-3">Mã nhà cung cấp</th>
                                <th className="px-6 py-3">Tên nhà cung cấp</th>
                                <th className="px-6 py-3 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && suppliers.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-sm text-[#5e3f3a]">
                                        Không có dữ liệu nhà cung cấp.
                                    </td>
                                </tr>
                            )}
                            {suppliers.map((supplier) => (
                                <tr key={supplier.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
                                    <td className="px-6 py-4 text-sm font-semibold text-[#191c1e]">{supplier.id}</td>
                                    <td className="px-6 py-4 text-sm text-[#191c1e]">{supplier.supplierCode}</td>
                                    <td className="px-6 py-4 text-sm text-[#5e3f3a]">{supplier.supplierName}</td>
                                    <td className="px-6 py-4 text-right text-sm">
                                        <div className="inline-flex items-center gap-3">
                                            <button
                                                onClick={() => openEditForm(supplier)}
                                                className="cursor-pointer font-semibold text-[#5e3f3a] transition hover:text-[#191c1e]"
                                                title="Sửa"
                                            >
                                                Sửa
                                            </button>
                                            <button
                                                onClick={() => setDeletingSupplier(supplier)}
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

            <SupplierForm
                isOpen={formOpen}
                mode={formMode}
                initial={editingSupplier}
                loading={isSaving}
                onClose={closeForm}
                onSubmit={handleSubmitForm}
            />

            <ConfirmDialog
                isOpen={deletingSupplier !== null}
                title="Xoá nhà cung cấp"
                message={
                    <>
                        Bạn có chắc muốn xoá nhà cung cấp <strong>{deletingSupplier?.supplierName}</strong> không? Hành động này
                        không thể hoàn tác.
                    </>
                }
                approveLabel="Xoá"
                deniedLabel="Huỷ"
                loading={isDeleting}
                onApprove={handleDelete}
                onDenied={() => {
                    if (!isDeleting) setDeletingSupplier(null);
                }}
            />
        </div>
    );
}
