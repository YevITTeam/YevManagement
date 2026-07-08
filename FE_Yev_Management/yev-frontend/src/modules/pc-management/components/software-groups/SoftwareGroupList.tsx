"use client";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { toast } from "react-toastify";

import { SoftwareGroupApi } from "@/modules/pc-management/api/software-group.api";
import type { SoftwareGroupDto } from "@/modules/pc-management/types/software-group.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import SoftwareGroupForm, { type SoftwareGroupFormValues } from "./SoftwareGroupForm";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import type { ListHandle, ListToolbarProps } from "../list-toolbar";

const PAGE_SIZE = 10;

const SoftwareGroupList = forwardRef<ListHandle, ListToolbarProps>(function SoftwareGroupList({ onLoadingChange }, ref) {
    const [groups, setGroups] = useState<SoftwareGroupDto[]>([]);
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
    const [editingGroup, setEditingGroup] = useState<SoftwareGroupDto | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [deletingGroup, setDeletingGroup] = useState<SoftwareGroupDto | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchGroups = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await SoftwareGroupApi.getSoftwareGroupPageNation({
                pageIndex,
                pageSize: PAGE_SIZE,
                keyword: appliedKeyword || undefined,
            });
            setGroups(result.data);
            setTotalCount(result.totalCount);
            setTotalPages(result.totalPages);
            setHasNextPage(result.hasNextPage);
            setHasPreviousPage(result.hasPreviousPage);
        } catch (err) {
            console.error(err);
            const message = getApiErrorMessage(err, "Không thể tải danh sách nhóm phần mềm.");
            setError(message);
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchGroups();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageIndex, appliedKeyword]);

    useEffect(() => {
        onLoadingChange?.(isLoading);
    }, [isLoading, onLoadingChange]);

    useImperativeHandle(ref, () => ({
        refresh: fetchGroups,
        openCreate: openCreateForm,
    }));

    const handleSearch = () => {
        setPageIndex(1);
        setAppliedKeyword(keyword.trim());
    };

    const openCreateForm = () => {
        setFormMode("create");
        setEditingGroup(null);
        setFormOpen(true);
    };

    const openEditForm = (group: SoftwareGroupDto) => {
        setFormMode("edit");
        setEditingGroup(group);
        setFormOpen(true);
    };

    const closeForm = () => {
        if (isSaving) return;
        setFormOpen(false);
        setEditingGroup(null);
    };

    const handleSubmitForm = async (values: SoftwareGroupFormValues) => {
        setIsSaving(true);
        try {
            if (formMode === "create") {
                await SoftwareGroupApi.createSoftwareGroup(values);
                toast.success("Tạo nhóm phần mềm thành công");
            } else if (editingGroup) {
                await SoftwareGroupApi.updateSoftwareGroup(editingGroup.id, values);
                toast.success("Cập nhật nhóm phần mềm thành công");
            }
            setFormOpen(false);
            setEditingGroup(null);
            await fetchGroups();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, formMode === "create" ? "Tạo nhóm phần mềm thất bại" : "Cập nhật nhóm phần mềm thất bại"));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deletingGroup) return;
        setIsDeleting(true);
        try {
            await SoftwareGroupApi.deleteSoftwareGroup(deletingGroup.id);
            toast.success("Xoá nhóm phần mềm thành công");
            setDeletingGroup(null);
            await fetchGroups();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, "Xoá nhóm phần mềm thất bại"));
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
                            placeholder="Tìm theo mã hoặc tên nhóm phần mềm..."
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
                        {isLoading ? "Đang tải dữ liệu..." : `Hiển thị ${groups.length} / ${totalCount} bản ghi`}
                    </div>
                </div>

                {error && (
                    <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">{error}</div>
                )}

                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-left">
                        <thead>
                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                <th className="px-6 py-3">ID</th>
                                <th className="px-6 py-3">Mã nhóm</th>
                                <th className="px-6 py-3">Tên nhóm</th>
                                <th className="px-6 py-3 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && groups.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-sm text-[#5e3f3a]">
                                        Không có dữ liệu nhóm phần mềm.
                                    </td>
                                </tr>
                            )}
                            {groups.map((group) => (
                                <tr key={group.id} className="border-b border-[#f1f5f9] transition-colors hover:bg-[#f8fafc]">
                                    <td className="px-6 py-4 text-sm font-semibold text-[#191c1e]">{group.id}</td>
                                    <td className="px-6 py-4 text-sm text-[#191c1e]">{group.groupCode}</td>
                                    <td className="px-6 py-4 text-sm text-[#5e3f3a]">{group.groupName}</td>
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

            <SoftwareGroupForm
                isOpen={formOpen}
                mode={formMode}
                initial={editingGroup}
                loading={isSaving}
                onClose={closeForm}
                onSubmit={handleSubmitForm}
            />

            <ConfirmDialog
                isOpen={deletingGroup !== null}
                title="Xoá nhóm phần mềm"
                message={
                    <>
                        Bạn có chắc muốn xoá nhóm phần mềm <strong>{deletingGroup?.groupName}</strong> không? Hành động này
                        không thể hoàn tác.
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

export default SoftwareGroupList;
