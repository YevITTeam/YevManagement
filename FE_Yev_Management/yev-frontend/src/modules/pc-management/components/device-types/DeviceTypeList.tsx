"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";

import { DeviceTypeApi } from "@/modules/pc-management/api/device-type.api";
import type { DeviceTypeDto } from "@/modules/pc-management/types/device-type.dto";
import DeviceTypeForm, { type DeviceTypeFormValues } from "./DeviceTypeForm";
import ConfirmDialog from "@/components/common/ConfirmDialog";

const PAGE_SIZE = 10;

export default function DeviceTypeList() {
    const [deviceTypes, setDeviceTypes] = useState<DeviceTypeDto[]>([]);
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
    const [editingDeviceType, setEditingDeviceType] = useState<DeviceTypeDto | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [deletingDeviceType, setDeletingDeviceType] = useState<DeviceTypeDto | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchDeviceTypes = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await DeviceTypeApi.getDeviceTypePageNation({
                pageIndex,
                pageSize: PAGE_SIZE,
                keyword: appliedKeyword || undefined,
            });
            setDeviceTypes(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
            setHasNextPage(result.hasNextPage);
            setHasPreviousPage(result.hasPreviousPage);
        } catch (err) {
            console.error(err);
            setError("Không thể tải danh sách loại thiết bị.");
            toast.error("Không thể tải danh sách loại thiết bị.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDeviceTypes();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageIndex, appliedKeyword]);

    const handleSearch = () => {
        setPageIndex(1);
        setAppliedKeyword(keyword.trim());
    };

    const openCreateForm = () => {
        setFormMode("create");
        setEditingDeviceType(null);
        setFormOpen(true);
    };

    const openEditForm = (deviceType: DeviceTypeDto) => {
        setFormMode("edit");
        setEditingDeviceType(deviceType);
        setFormOpen(true);
    };

    const closeForm = () => {
        if (isSaving) return;
        setFormOpen(false);
        setEditingDeviceType(null);
    };

    const handleSubmitForm = async (values: DeviceTypeFormValues) => {
        setIsSaving(true);
        try {
            if (formMode === "create") {
                await DeviceTypeApi.createDeviceType(values);
                toast.success("Tạo loại thiết bị thành công");
            } else if (editingDeviceType) {
                await DeviceTypeApi.updateDeviceType(editingDeviceType.id, values);
                toast.success("Cập nhật loại thiết bị thành công");
            }
            setFormOpen(false);
            setEditingDeviceType(null);
            await fetchDeviceTypes();
        } catch (err) {
            console.error(err);
            toast.error(formMode === "create" ? "Tạo loại thiết bị thất bại" : "Cập nhật loại thiết bị thất bại");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingDeviceType) return;
        setIsDeleting(true);
        try {
            await DeviceTypeApi.deleteDeviceType(deletingDeviceType.id);
            toast.success("Xoá loại thiết bị thành công");
            setDeletingDeviceType(null);
            await fetchDeviceTypes();
        } catch (err) {
            console.error(err);
            toast.error("Xoá loại thiết bị thất bại");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-[32px] font-semibold text-[#191c1e]">Loại thiết bị</h1>
                    <p className="mt-1 text-[15px] text-[#5e3f3a]">Quản lý các nhóm thiết bị và mô tả sử dụng.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => fetchDeviceTypes()}
                        disabled={isLoading}
                        className="cursor-pointer rounded-md border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50"
                    >
                        ↻ Làm mới
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
                            placeholder="Tìm theo mã hoặc tên loại thiết bị..."
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
                        {isLoading ? "Đang tải dữ liệu..." : `Hiển thị ${deviceTypes.length} / ${totalCount} bản ghi`}
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
                                <th className="px-6 py-3">Mã loại</th>
                                <th className="px-6 py-3">Tên loại</th>
                                <th className="px-6 py-3 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && deviceTypes.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-sm text-[#5e3f3a]">
                                        Không có dữ liệu loại thiết bị.
                                    </td>
                                </tr>
                            )}
                            {deviceTypes.map((deviceType) => (
                                <tr key={deviceType.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
                                    <td className="px-6 py-4 text-sm font-semibold text-[#191c1e]">{deviceType.id}</td>
                                    <td className="px-6 py-4 text-sm text-[#191c1e]">{deviceType.typeCode}</td>
                                    <td className="px-6 py-4 text-sm text-[#5e3f3a]">{deviceType.typeName}</td>
                                    <td className="px-6 py-4 text-right text-sm">
                                        <div className="inline-flex items-center gap-3">
                                            <button
                                                onClick={() => openEditForm(deviceType)}
                                                className="cursor-pointer font-semibold text-[#5e3f3a] transition hover:text-[#191c1e]"
                                                title="Sửa"
                                            >
                                                Sửa
                                            </button>
                                            <button
                                                onClick={() => setDeletingDeviceType(deviceType)}
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

            <DeviceTypeForm
                isOpen={formOpen}
                mode={formMode}
                initial={editingDeviceType}
                loading={isSaving}
                onClose={closeForm}
                onSubmit={handleSubmitForm}
            />

            <ConfirmDialog
                isOpen={deletingDeviceType !== null}
                title="Xoá loại thiết bị"
                message={
                    <>
                        Bạn có chắc muốn xoá loại thiết bị <strong>{deletingDeviceType?.typeName}</strong> không? Hành động này
                        không thể hoàn tác.
                    </>
                }
                approveLabel="Xoá"
                deniedLabel="Huỷ"
                loading={isDeleting}
                onApprove={handleDelete}
                onDenied={() => {
                    if (!isDeleting) setDeletingDeviceType(null);
                }}
            />
        </div>
    );
}
