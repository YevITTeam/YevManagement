"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { RoleDto, CreateRoleDto } from "@/modules/auth/types/auth.dto";
import { toast } from "react-toastify";
import RoleForm from "./RoleForm";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { AuthApi } from "../../api/auth.api";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

export default function RoleList() {
    const [roles, setRoles] = useState<RoleDto[]>([]);
    const [searchTerm, setSearchTerm] = useState("");

    const [showCreate, setShowCreate] = useState(false);
    const [editing, setEditing] = useState<RoleDto | null>(null);

    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [openDialog, setOpenDialog] = useState(false);

    const { isLoading: loading, refetch: fetchRoles } = useFetchEffect(
        () => AuthApi.getAllRoles(),
        [],
        (data) => setRoles(data),
        "Không thể tải danh sách vai trò",
        (message) => toast.error(message),
        "roles"
    );

    const filteredRoles = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return roles;
        return roles.filter(
            (r) => r.roleName.toLowerCase().includes(term) || (r.description ?? "").toLowerCase().includes(term)
        );
    }, [roles, searchTerm]);

    const isFormOpen = showCreate || editing !== null;

    const handleCreate = async (data: CreateRoleDto) => {
        try {
            await AuthApi.createRole(data.roleName, data.description);
            toast.success("Tạo quyền thành công");
            setShowCreate(false);
            await fetchRoles();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, "Tên quyền đã tồn tại hoặc không hợp lệ."));
        }
    };

    const handleUpdate = async (data: CreateRoleDto, id?: number) => {
        if (!id) return;
        try {
            await AuthApi.updateRole(id, data.roleName, data.description);
            toast.success("Cập nhật quyền thành công");
            setEditing(null);
            await fetchRoles();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, "Cập nhật thất bại"));
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await AuthApi.deleteRole(id);
            toast.success("Xoá thành công");
            await fetchRoles();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, "Xoá thất bại"));
        } finally {
            // Xong xuôi thì đóng dialog và reset id
            setOpenDialog(false);
            setDeletingId(null);
        }
    };

    // Hàm trung gian để mở Dialog xoá
    const openDeleteConfirm = (id: number) => {
        setDeletingId(id);
        setOpenDialog(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-[#191c1e]">Quản lý Roles</h1>
                    <p className="mt-1 text-sm text-[#5e3f3a]">Danh sách vai trò và mô tả phạm vi sử dụng.</p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="cursor-pointer self-start rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] md:self-auto"
                >
                    + Thêm vai trò
                </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-[#e0e3e5] bg-[#f8fafc] p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative w-full sm:max-w-sm">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a8f94]" />
                        <input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Tìm vai trò..."
                            className="h-10 w-full rounded-lg border border-[#e0e3e5] bg-white pl-9 pr-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                        />
                    </div>
                    <span className="text-xs text-[#8a8f94]">
                        Hiển thị {filteredRoles.length} / {roles.length} vai trò
                    </span>
                </div>

                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="py-10 text-center text-sm text-[#5e3f3a]">Đang tải...</div>
                    ) : (
                        <table className="min-w-full border-collapse text-left text-sm">
                            <thead>
                                <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                    <th className="px-4 py-3">Vai trò</th>
                                    <th className="px-4 py-3">Mô tả</th>
                                    <th className="px-4 py-3 text-center">Hành động</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRoles.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="px-4 py-8 text-center text-sm text-[#5e3f3a]">
                                            Không có dữ liệu.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRoles.map((r) => (
                                        <tr key={r.id} className="border-b border-[#f1f5f9] bg-white transition-colors even:bg-[#f2f4f7] hover:bg-[#e8ecf1]">
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center rounded-full border border-[#e0e3e5] bg-[#f8fafc] px-2.5 py-0.5 text-xs font-semibold text-[#191c1e]">
                                                    {r.roleName}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-[#5e3f3a]">{r.description || "-"}</td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="inline-flex items-center gap-3">
                                                    <button
                                                        onClick={() => setEditing(r)}
                                                        className="cursor-pointer font-semibold text-[#5e3f3a] transition hover:text-[#191c1e]"
                                                    >
                                                        Sửa
                                                    </button>
                                                    <button
                                                        onClick={() => openDeleteConfirm(r.id)}
                                                        className="cursor-pointer font-semibold text-[#930006] transition hover:text-[#e3000f]"
                                                    >
                                                        Xoá
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div
                        className="fixed inset-0 bg-black/40"
                        onClick={() => {
                            setShowCreate(false);
                            setEditing(null);
                        }}
                    />
                    <div role="dialog" aria-modal="true" className="z-60 mx-4 w-full max-w-md rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl">
                        <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                            <h3 className="text-lg font-semibold text-[#191c1e]">
                                {editing ? "Cập nhật vai trò" : "Thêm vai trò"}
                            </h3>
                        </div>
                        {editing ? (
                            <RoleForm
                                initial={{ id: editing.id, roleName: editing.roleName, description: editing.description }}
                                onCancel={() => setEditing(null)}
                                onSubmit={async (d, id) => await handleUpdate(d, id)}
                            />
                        ) : (
                            <RoleForm
                                onCancel={() => setShowCreate(false)}
                                onSubmit={async (d) => await handleCreate(d)}
                            />
                        )}
                    </div>
                </div>
            )}

            <ConfirmDialog
                isOpen={openDialog}
                title="Xoá Role"
                message="Bạn có chắc muốn xoá role này không?"
                onApprove={async () => {
                    if (deletingId !== null) {
                        await handleDelete(deletingId);
                    }
                }}
                onDenied={() => {
                    setOpenDialog(false);
                    setDeletingId(null);
                }}
                approveLabel="Xoá"
                deniedLabel="Huỷ"
            />
        </div>
    );
}