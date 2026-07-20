"use client";

import { useState } from "react";
import { toast } from "react-toastify";

import { DeviceDepartmentApi } from "@/modules/pc-management/api/device-department.api";
import type { DeviceDepartmentDto } from "@/modules/pc-management/types/device-department.dto";
import DeviceDepartmentForm, { type DeviceDepartmentFormValues } from "./DeviceDepartmentForm";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

const PAGE_SIZE = 10;

export default function DeviceDepartmentList() {
    const [deviceDepartments, setDeviceDepartments] = useState<DeviceDepartmentDto[]>([]);

    const [keyword, setKeyword] = useState("");
    const [appliedKeyword, setAppliedKeyword] = useState("");

    const [pageIndex, setPageIndex] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [hasPreviousPage, setHasPreviousPage] = useState(false);

    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<"create" | "edit">("create");
    const [editingDeviceDepartment, setEditingDeviceDepartment] = useState<DeviceDepartmentDto | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [deletingDeviceDepartment, setDeletingDeviceDepartment] = useState<DeviceDepartmentDto | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const { isLoading, error, refetch: fetchDeviceDepartments } = useFetchEffect(
        () =>
            DeviceDepartmentApi.getDeviceDepartmentPageNation({
                pageIndex,
                pageSize: PAGE_SIZE,
                keyword: appliedKeyword || undefined,
            }),
        [pageIndex, appliedKeyword],
        (result) => {
            setDeviceDepartments(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
            setHasNextPage(result.hasNextPage);
            setHasPreviousPage(result.hasPreviousPage);
        },
        "Không thể tải danh sách bộ phận.",
        (message) => toast.error(message)
    );

    const handleSearch = () => {
        setPageIndex(1);
        setAppliedKeyword(keyword.trim());
    };

    const openCreateForm = () => {
        setFormMode("create");
        setEditingDeviceDepartment(null);
        setFormOpen(true);
    };

    const openEditForm = (deviceDepartment: DeviceDepartmentDto) => {
        setFormMode("edit");
        setEditingDeviceDepartment(deviceDepartment);
        setFormOpen(true);
    };

    const closeForm = () => {
        if (isSaving) return;
        setFormOpen(false);
        setEditingDeviceDepartment(null);
    };

    const handleSubmitForm = async (values: DeviceDepartmentFormValues) => {
        setIsSaving(true);
        try {
            if (formMode === "create") {
                await DeviceDepartmentApi.createDeviceDepartment(values);
                toast.success("Tạo bộ phận thành công");
            } else if (editingDeviceDepartment) {
                await DeviceDepartmentApi.updateDeviceDepartment(editingDeviceDepartment.id, values);
                toast.success("Cập nhật bộ phận thành công");
            }
            setFormOpen(false);
            setEditingDeviceDepartment(null);
            await fetchDeviceDepartments();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, formMode === "create" ? "Tạo bộ phận thất bại" : "Cập nhật bộ phận thất bại"));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingDeviceDepartment) return;
        setIsDeleting(true);
        try {
            await DeviceDepartmentApi.deleteDeviceDepartment(deletingDeviceDepartment.id);
            toast.success("Xoá bộ phận thành công");
            setDeletingDeviceDepartment(null);
            await fetchDeviceDepartments();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, "Xoá bộ phận thất bại"));
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-[#191c1e]">Quản lý bộ phận</h1>
                    <p className="mt-1 text-[15px] text-[#5e3f3a]">Quản lý danh sách bộ phận dùng để gán vị trí sử dụng thiết bị.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => fetchDeviceDepartments()}
                        disabled={isLoading}
                        className="cursor-pointer rounded-lg border border-[#e0e3e5] bg-white px-3 py-1.5 text-xs font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50"
                    >
                        ↻ Làm mới
                    </button>
                    <button
                        onClick={openCreateForm}
                        className="cursor-pointer rounded-lg bg-[#e3000f] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#b40009]"
                    >
                        + Thêm mới
                    </button>
                </div>
            </div>

            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-[#e0e3e5] bg-[#f8fafc] p-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex gap-2">
                        <input
                            value={keyword}
                            onChange={(event) => setKeyword(event.target.value)}
                            onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                            placeholder="Tìm theo mã hoặc tên bộ phận..."
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
                        {isLoading ? "Đang tải dữ liệu..." : `Hiển thị ${deviceDepartments.length} / ${totalCount} bản ghi`}
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
                                <th className="px-6 py-3">Mã bộ phận</th>
                                <th className="px-6 py-3">Tên bộ phận</th>
                                <th className="px-6 py-3 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && deviceDepartments.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-sm text-[#5e3f3a]">
                                        Không có dữ liệu bộ phận.
                                    </td>
                                </tr>
                            )}
                            {deviceDepartments.map((deviceDepartment) => (
                                <tr key={deviceDepartment.id} className="border-b border-[#f1f5f9] transition-colors hover:bg-[#f8fafc]">
                                    <td className="px-6 py-4 text-sm font-semibold text-[#191c1e]">{deviceDepartment.id}</td>
                                    <td className="px-6 py-4 text-sm text-[#191c1e]">{deviceDepartment.departmentCode}</td>
                                    <td className="px-6 py-4 text-sm text-[#5e3f3a]">{deviceDepartment.departmentName}</td>
                                    <td className="px-6 py-4 text-right text-sm">
                                        <div className="inline-flex items-center gap-3">
                                            <button
                                                onClick={() => openEditForm(deviceDepartment)}
                                                className="cursor-pointer font-semibold text-[#5e3f3a] transition hover:text-[#191c1e]"
                                                title="Sửa"
                                            >
                                                Sửa
                                            </button>
                                            <button
                                                onClick={() => setDeletingDeviceDepartment(deviceDepartment)}
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

            <DeviceDepartmentForm
                isOpen={formOpen}
                mode={formMode}
                initial={editingDeviceDepartment}
                loading={isSaving}
                onClose={closeForm}
                onSubmit={handleSubmitForm}
            />

            <ConfirmDialog
                isOpen={deletingDeviceDepartment !== null}
                title="Xoá bộ phận"
                message={
                    <>
                        Bạn có chắc muốn xoá bộ phận <strong>{deletingDeviceDepartment?.departmentName}</strong> không? Hành động
                        này không thể hoàn tác.
                    </>
                }
                approveLabel="Xoá"
                deniedLabel="Huỷ"
                loading={isDeleting}
                onApprove={handleDelete}
                onDenied={() => {
                    if (!isDeleting) setDeletingDeviceDepartment(null);
                }}
            />
        </div>
    );
}
