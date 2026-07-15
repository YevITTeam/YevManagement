"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { toast } from "react-toastify";

import { GroupApi } from "@/modules/attendance/api/group.api";
import type { GroupDto } from "@/modules/attendance/types/group.dto";
import { DepartmentApi } from "@/modules/attendance/api/department.api";
import type { DepartmentDto } from "@/modules/attendance/types/department.dto";
import GroupForm, { type GroupFormValues } from "./GroupForm";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { getApiErrorMessage } from "@/lib/apiError";
import type { ListHandle, ListToolbarProps } from "../list-toolbar";

const PAGE_SIZE = 10;

const GroupList = forwardRef<ListHandle, ListToolbarProps>(function GroupList({ onLoadingChange }, ref) {
    const [groups, setGroups] = useState<GroupDto[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [keyword, setKeyword] = useState("");
    const [appliedKeyword, setAppliedKeyword] = useState("");

    const [departments, setDepartments] = useState<DepartmentDto[]>([]);
    const [departmentFilter, setDepartmentFilter] = useState<string>("");

    const [pageIndex, setPageIndex] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [hasPreviousPage, setHasPreviousPage] = useState(false);

    const [formOpen, setFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<"create" | "edit">("create");
    const [editingGroup, setEditingGroup] = useState<GroupDto | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [deletingGroup, setDeletingGroup] = useState<GroupDto | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // grid-list toàn cục không lọc theo Bộ phận trong docs — nên khi có bộ lọc, tải toàn bộ theo
    // by-department rồi tự phân trang phía FE; khi không lọc thì dùng grid-list bình thường.
    const fetchGroups = async () => {
        setIsLoading(true);
        setError(null);
        try {
            if (departmentFilter) {
                const all = await GroupApi.getGroupsByDepartment(Number(departmentFilter));
                const filtered = appliedKeyword
                    ? all.filter(
                          (group) =>
                              group.groupCode.toLowerCase().includes(appliedKeyword.toLowerCase()) ||
                              group.groupNameVn.toLowerCase().includes(appliedKeyword.toLowerCase())
                      )
                    : all;
                const computedTotalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
                const safePageIndex = Math.min(pageIndex, computedTotalPages);
                const start = (safePageIndex - 1) * PAGE_SIZE;
                setGroups(filtered.slice(start, start + PAGE_SIZE));
                setTotalCount(filtered.length);
                setTotalPages(computedTotalPages);
                setHasPreviousPage(safePageIndex > 1);
                setHasNextPage(safePageIndex < computedTotalPages);
                if (safePageIndex !== pageIndex) setPageIndex(safePageIndex);
            } else {
                const result = await GroupApi.getGroupPageNation({
                    pageIndex,
                    pageSize: PAGE_SIZE,
                    keyword: appliedKeyword || undefined,
                });
                setGroups(result.data);
                setTotalCount(result.totalCount);
                setTotalPages(result.totalPages);
                setHasNextPage(result.hasNextPage);
                setHasPreviousPage(result.hasPreviousPage);
            }
        } catch (err) {
            console.error(err);
            const message = getApiErrorMessage(err, "Không thể tải danh sách nhóm.");
            setError(message);
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        DepartmentApi.getAllDepartments()
            .then((data) => setDepartments(data))
            .catch((err) => console.error(err));
    }, []);

    useEffect(() => {
        fetchGroups();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageIndex, appliedKeyword, departmentFilter]);

    useEffect(() => {
        onLoadingChange?.(isLoading);
    }, [isLoading, onLoadingChange]);

    const openCreateForm = () => {
        setFormMode("create");
        setEditingGroup(null);
        setFormOpen(true);
    };

    useImperativeHandle(ref, () => ({
        refresh: fetchGroups,
        openCreate: openCreateForm,
    }));

    const handleSearch = () => {
        setPageIndex(1);
        setAppliedKeyword(keyword.trim());
    };

    const openEditForm = (group: GroupDto) => {
        setFormMode("edit");
        setEditingGroup(group);
        setFormOpen(true);
    };

    const closeForm = () => {
        if (isSaving) return;
        setFormOpen(false);
        setEditingGroup(null);
    };

    const handleSubmitForm = async (values: GroupFormValues) => {
        setIsSaving(true);
        try {
            if (formMode === "create") {
                await GroupApi.createGroup(values);
                toast.success("Tạo nhóm thành công");
            } else if (editingGroup) {
                await GroupApi.updateGroup(editingGroup.id, values);
                toast.success("Cập nhật nhóm thành công");
            }
            setFormOpen(false);
            setEditingGroup(null);
            await fetchGroups();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, formMode === "create" ? "Tạo nhóm thất bại" : "Cập nhật nhóm thất bại"));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingGroup) return;
        setIsDeleting(true);
        try {
            await GroupApi.deleteGroup(deletingGroup.id);
            toast.success("Xoá nhóm thành công");
            setDeletingGroup(null);
            await fetchGroups();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, "Xoá nhóm thất bại"));
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="space-y-4">
            <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-[#e0e3e5] bg-[#f8fafc] p-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-wrap gap-2">
                        <input
                            value={keyword}
                            onChange={(event) => setKeyword(event.target.value)}
                            onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                            placeholder="Tìm theo mã hoặc tên nhóm..."
                            className="h-10 w-64 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                        />
                        <select
                            value={departmentFilter}
                            onChange={(event) => {
                                setPageIndex(1);
                                setDepartmentFilter(event.target.value);
                            }}
                            className="h-10 rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                        >
                            <option value="">Tất cả bộ phận</option>
                            {departments.map((department) => (
                                <option key={department.id} value={department.id}>
                                    {department.departmentNameVn}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={handleSearch}
                            disabled={isLoading}
                            className="cursor-pointer h-10 rounded-lg border border-[#e0e3e5] bg-white px-4 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6] disabled:opacity-50"
                        >
                            Tìm kiếm
                        </button>
                    </div>
                    <div className="text-sm text-[#5e3f3a]">
                        {isLoading ? "Đang tải dữ liệu..." : `Hiển thị ${groups.length} / ${totalCount} bản ghi`}
                    </div>
                </div>

                {error && (
                    <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>
                )}

                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a]">
                                <th className="px-6 py-3">Mã nhóm</th>
                                <th className="px-6 py-3">Tên nhóm</th>
                                <th className="px-6 py-3">Bộ phận</th>
                                <th className="px-6 py-3 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && groups.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-sm text-[#5e3f3a]">
                                        Không có dữ liệu nhóm.
                                    </td>
                                </tr>
                            )}
                            {groups.map((group) => (
                                <tr key={group.id} className="border-b border-[#f1f5f9] transition-colors hover:bg-[#f8fafc]">
                                    <td className="px-6 py-4 text-sm font-semibold text-[#191c1e]">{group.groupCode}</td>
                                    <td className="px-6 py-4 text-sm text-[#5e3f3a]">{group.groupNameVn}</td>
                                    <td className="px-6 py-4 text-sm text-[#5e3f3a]">{group.departmentNameVn}</td>
                                    <td className="px-6 py-4 text-right text-sm">
                                        <div className="inline-flex items-center gap-3">
                                            <button
                                                onClick={() => openEditForm(group)}
                                                className="cursor-pointer font-semibold text-[#5e3f3a] transition hover:text-[#191c1e]"
                                                title="Sửa"
                                            >
                                                Sửa
                                            </button>
                                            <button
                                                onClick={() => setDeletingGroup(group)}
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

            <GroupForm
                isOpen={formOpen}
                mode={formMode}
                initial={editingGroup}
                loading={isSaving}
                onClose={closeForm}
                onSubmit={handleSubmitForm}
            />

            <ConfirmDialog
                isOpen={deletingGroup !== null}
                title="Xoá nhóm"
                message={
                    <>
                        Bạn có chắc muốn xoá nhóm <strong>{deletingGroup?.groupNameVn}</strong> không? Hành động này không
                        thể hoàn tác.
                    </>
                }
                approveLabel="Xoá"
                deniedLabel="Huỷ"
                loading={isDeleting}
                onApprove={handleDelete}
                onDenied={() => {
                    if (!isDeleting) setDeletingGroup(null);
                }}
            />
        </div>
    );
});

export default GroupList;
