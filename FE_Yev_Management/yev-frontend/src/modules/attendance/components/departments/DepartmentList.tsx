"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { toast } from "react-toastify";

import { DepartmentApi } from "@/modules/attendance/api/department.api";
import type { DepartmentDto } from "@/modules/attendance/types/department.dto";
import DepartmentForm, { type DepartmentFormValues } from "./DepartmentForm";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { getApiErrorMessage } from "@/lib/apiError";
import type { ListHandle, ListToolbarProps } from "../list-toolbar";

const PAGE_SIZE = 10;

const DepartmentList = forwardRef<ListHandle, ListToolbarProps>(function DepartmentList({ onLoadingChange }, ref) {
    const [departments, setDepartments] = useState<DepartmentDto[]>([]);
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
    const [editingDepartment, setEditingDepartment] = useState<DepartmentDto | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [deletingDepartment, setDeletingDepartment] = useState<DepartmentDto | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchDepartments = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await DepartmentApi.getDepartmentPageNation({
                pageIndex,
                pageSize: PAGE_SIZE,
                keyword: appliedKeyword || undefined,
            });
            setDepartments(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
            setHasNextPage(result.hasNextPage);
            setHasPreviousPage(result.hasPreviousPage);
        } catch (err) {
            console.error(err);
            const message = getApiErrorMessage(err, "Không thể tải danh sách bộ phận.");
            setError(message);
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDepartments();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageIndex, appliedKeyword]);

    useEffect(() => {
        onLoadingChange?.(isLoading);
    }, [isLoading, onLoadingChange]);

    const openCreateForm = () => {
        setFormMode("create");
        setEditingDepartment(null);
        setFormOpen(true);
    };

    useImperativeHandle(ref, () => ({
        refresh: fetchDepartments,
        openCreate: openCreateForm,
    }));

    const handleSearch = () => {
        setPageIndex(1);
        setAppliedKeyword(keyword.trim());
    };

    const openEditForm = (department: DepartmentDto) => {
        setFormMode("edit");
        setEditingDepartment(department);
        setFormOpen(true);
    };

    const closeForm = () => {
        if (isSaving) return;
        setFormOpen(false);
        setEditingDepartment(null);
    };

    const handleSubmitForm = async (values: DepartmentFormValues) => {
        setIsSaving(true);
        try {
            if (formMode === "create") {
                await DepartmentApi.createDepartment(values);
                toast.success("Tạo bộ phận thành công");
            } else if (editingDepartment) {
                await DepartmentApi.updateDepartment(editingDepartment.id, values);
                toast.success("Cập nhật bộ phận thành công");
            }
            setFormOpen(false);
            setEditingDepartment(null);
            await fetchDepartments();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, formMode === "create" ? "Tạo bộ phận thất bại" : "Cập nhật bộ phận thất bại"));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingDepartment) return;
        setIsDeleting(true);
        try {
            await DepartmentApi.deleteDepartment(deletingDepartment.id);
            toast.success("Xoá bộ phận thành công");
            setDeletingDepartment(null);
            await fetchDepartments();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, "Xoá bộ phận thất bại"));
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
                        {isLoading ? "Đang tải dữ liệu..." : `Hiển thị ${departments.length} / ${totalCount} bản ghi`}
                    </div>
                </div>

                {error && (
                    <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>
                )}

                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">
                                <th className="px-6 py-3">Mã bộ phận</th>
                                <th className="px-6 py-3">Tên (VN)</th>
                                <th className="px-6 py-3">Tên (JP)</th>
                                <th className="px-6 py-3 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && departments.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-sm text-[#5e3f3a]">
                                        Không có dữ liệu bộ phận.
                                    </td>
                                </tr>
                            )}
                            {departments.map((department) => (
                                <tr key={department.id} className="border-b border-[#f1f5f9] transition-colors hover:bg-[#f8fafc]">
                                    <td className="px-6 py-4 text-sm font-semibold text-[#191c1e]">{department.departmentCode}</td>
                                    <td className="px-6 py-4 text-sm text-[#5e3f3a]">{department.departmentNameVn}</td>
                                    <td className="px-6 py-4 text-sm text-[#5e3f3a]">{department.departmentNameJp || "-"}</td>
                                    <td className="px-6 py-4 text-right text-sm">
                                        <div className="inline-flex items-center gap-3">
                                            <button
                                                onClick={() => openEditForm(department)}
                                                className="cursor-pointer font-semibold text-[#5e3f3a] transition hover:text-[#191c1e]"
                                                title="Sửa"
                                            >
                                                Sửa
                                            </button>
                                            <button
                                                onClick={() => setDeletingDepartment(department)}
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

            <DepartmentForm
                isOpen={formOpen}
                mode={formMode}
                initial={editingDepartment}
                loading={isSaving}
                onClose={closeForm}
                onSubmit={handleSubmitForm}
            />

            <ConfirmDialog
                isOpen={deletingDepartment !== null}
                title="Xoá bộ phận"
                message={
                    <>
                        Bạn có chắc muốn xoá bộ phận <strong>{deletingDepartment?.departmentNameVn}</strong> không? Hành động
                        này không thể hoàn tác.
                    </>
                }
                approveLabel="Xoá"
                deniedLabel="Huỷ"
                loading={isDeleting}
                onApprove={handleDelete}
                onDenied={() => {
                    if (!isDeleting) setDeletingDepartment(null);
                }}
            />
        </div>
    );
});

export default DepartmentList;
