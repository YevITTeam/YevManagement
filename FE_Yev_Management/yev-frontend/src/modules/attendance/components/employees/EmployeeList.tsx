"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { toast } from "react-toastify";

import { EmployeeApi } from "@/modules/attendance/api/employee.api";
import type { EmployeeDto } from "@/modules/attendance/types/employee.dto";
import EmployeeForm, { type EmployeeFormValues } from "./EmployeeForm";
import EmployeeImportDialog from "./EmployeeImportDialog";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { getApiErrorMessage } from "@/lib/apiError";
import type { ListHandle, ListToolbarProps } from "../list-toolbar";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

const PAGE_SIZE = 10;

const EmployeeList = forwardRef<ListHandle, ListToolbarProps>(function EmployeeList({ onLoadingChange }, ref) {
    const [employees, setEmployees] = useState<EmployeeDto[]>([]);

    const [keyword, setKeyword] = useState("");
    const [appliedKeyword, setAppliedKeyword] = useState("");

    const [pageIndex, setPageIndex] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [hasPreviousPage, setHasPreviousPage] = useState(false);

    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<"create" | "edit">("create");
    const [editingEmployee, setEditingEmployee] = useState<EmployeeDto | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [deletingEmployee, setDeletingEmployee] = useState<EmployeeDto | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [importOpen, setImportOpen] = useState(false);

    const { isLoading, error, refetch: fetchEmployees } = useFetchEffect(
        () => EmployeeApi.getEmployeePageNation({ pageIndex, pageSize: PAGE_SIZE, keyword: appliedKeyword || undefined }),
        [pageIndex, appliedKeyword],
        (result) => {
            setEmployees(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
            setHasNextPage(result.hasNextPage);
            setHasPreviousPage(result.hasPreviousPage);
        },
        "Không thể tải danh sách nhân viên.",
        (message) => toast.error(message)
    );

    useEffect(() => {
        onLoadingChange?.(isLoading);
    }, [isLoading, onLoadingChange]);

    const openCreateForm = () => {
        setFormMode("create");
        setEditingEmployee(null);
        setFormOpen(true);
    };

    useImperativeHandle(ref, () => ({
        refresh: fetchEmployees,
        openCreate: openCreateForm,
    }));

    const handleSearch = () => {
        setPageIndex(1);
        setAppliedKeyword(keyword.trim());
    };

    const openEditForm = (employee: EmployeeDto) => {
        setFormMode("edit");
        setEditingEmployee(employee);
        setFormOpen(true);
    };

    const closeForm = () => {
        if (isSaving) return;
        setFormOpen(false);
        setEditingEmployee(null);
    };

    const handleSubmitForm = async (values: EmployeeFormValues) => {
        setIsSaving(true);
        try {
            if (formMode === "create") {
                await EmployeeApi.createEmployee(values);
                toast.success("Tạo nhân viên thành công");
            } else if (editingEmployee) {
                await EmployeeApi.updateEmployee(editingEmployee.id, values);
                toast.success("Cập nhật nhân viên thành công");
            }
            setFormOpen(false);
            setEditingEmployee(null);
            await fetchEmployees();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, formMode === "create" ? "Tạo nhân viên thất bại" : "Cập nhật nhân viên thất bại"));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingEmployee) return;
        setIsDeleting(true);
        try {
            await EmployeeApi.deleteEmployee(deletingEmployee.id);
            toast.success("Xoá nhân viên thành công");
            setDeletingEmployee(null);
            await fetchEmployees();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, "Xoá nhân viên thất bại"));
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
                            placeholder="Tìm theo mã hoặc tên nhân viên..."
                            className="h-10 w-64 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                        />
                        <button
                            onClick={handleSearch}
                            disabled={isLoading}
                            className="cursor-pointer h-10 rounded-lg border border-[#e0e3e5] bg-white px-4 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50"
                        >
                            Tìm kiếm
                        </button>
                        <button
                            onClick={() => setImportOpen(true)}
                            className="cursor-pointer h-10 rounded-lg border border-[#e0e3e5] bg-white px-4 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                        >
                            Import Excel
                        </button>
                    </div>
                    <div className="text-sm text-[#5e3f3a]">
                        {isLoading ? "Đang tải dữ liệu..." : `Hiển thị ${employees.length} / ${totalCount} bản ghi`}
                    </div>
                </div>

                {error && (
                    <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>
                )}

                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">
                                <th className="px-6 py-3">Mã NV</th>
                                <th className="px-6 py-3">Họ và tên</th>
                                <th className="px-6 py-3">Tài khoản AD</th>
                                <th className="px-6 py-3">Nhóm</th>
                                <th className="px-6 py-3">Lũy kế tháng</th>
                                <th className="px-6 py-3">Lũy kế năm</th>
                                <th className="px-6 py-3 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && employees.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-sm text-[#5e3f3a]">
                                        Không có dữ liệu nhân viên.
                                    </td>
                                </tr>
                            )}
                            {employees.map((employee) => (
                                <tr key={employee.id} className="border-b border-[#f1f5f9] transition-colors hover:bg-[#f8fafc]">
                                    <td className="px-6 py-4 text-sm font-semibold text-[#191c1e]">{employee.code}</td>
                                    <td className="px-6 py-4 text-sm text-[#5e3f3a]">
                                        {employee.lastName} {employee.firstName}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-[#5e3f3a]">{employee.userName ?? "-"}</td>
                                    <td className="px-6 py-4 text-sm text-[#5e3f3a]">{employee.groupNameVn}</td>
                                    <td className="px-6 py-4 text-sm text-[#5e3f3a]">{employee.monthToDate}</td>
                                    <td className="px-6 py-4 text-sm text-[#5e3f3a]">{employee.yearToDate}</td>
                                    <td className="px-6 py-4 text-right text-sm">
                                        <div className="inline-flex items-center gap-3">
                                            <button
                                                onClick={() => openEditForm(employee)}
                                                className="cursor-pointer font-semibold text-[#5e3f3a] transition hover:text-[#191c1e]"
                                                title="Sửa"
                                            >
                                                Sửa
                                            </button>
                                            <button
                                                onClick={() => setDeletingEmployee(employee)}
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

            <EmployeeImportDialog
                isOpen={importOpen}
                onClose={() => setImportOpen(false)}
                onImported={fetchEmployees}
            />

            <EmployeeForm
                isOpen={formOpen}
                mode={formMode}
                initial={editingEmployee}
                loading={isSaving}
                onClose={closeForm}
                onSubmit={handleSubmitForm}
            />

            <ConfirmDialog
                isOpen={deletingEmployee !== null}
                title="Xoá nhân viên"
                message={
                    <>
                        Bạn có chắc muốn xoá nhân viên{" "}
                        <strong>
                            {deletingEmployee?.lastName} {deletingEmployee?.firstName}
                        </strong>{" "}
                        không? Hành động này không thể hoàn tác.
                    </>
                }
                approveLabel="Xoá"
                deniedLabel="Huỷ"
                loading={isDeleting}
                onApprove={handleDelete}
                onDenied={() => {
                    if (!isDeleting) setDeletingEmployee(null);
                }}
            />
        </div>
    );
});

export default EmployeeList;
