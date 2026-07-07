"use client";

import { useEffect, useState } from "react";
import type { RoleDto, CreateRoleDto } from "@/modules/auth/types/auth.dto";
import { toast } from "react-toastify";
import RoleForm from "./RoleForm";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { AuthApi } from "../../api/auth.api";

export default function RoleList() {
    const [roles, setRoles] = useState<RoleDto[]>([]);
    const [loading, setLoading] = useState(false);

    const [showCreate, setShowCreate] = useState(false);
    const [editing, setEditing] = useState<RoleDto | null>(null);

    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [openDialog, setOpenDialog] = useState(false);

    const fetchRoles = async () => {
        setLoading(true);
        try {
            const data = await AuthApi.getAllRoles();
            setRoles(data);
        } catch (err) {
            console.error(err);
            toast.error("Không thể tải danh sách quyền");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRoles();
    }, []);

    const handleCreate = async (data: CreateRoleDto) => {
        try {
            await AuthApi.createRole(data.roleName, data.description);
            toast.success("Tạo quyền thành công");
            setShowCreate(false);
            await fetchRoles();
        } catch (err) {
            console.error(err);
            toast.error("Tên quyền đã tồn tại hoặc không hợp lệ.");
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
            toast.error("Cập nhật thất bại");
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await AuthApi.deleteRole(id);
            toast.success("Xoá thành công");
            await fetchRoles();
        } catch (err) {
            console.error(err);
            toast.error("Xoá thất bại");
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
        <div className="rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#191c1e]">Quản lý Roles</h2>
                <div className="flex items-center gap-2">
                    {!showCreate && !editing && (
                        <button
                            onClick={() => setShowCreate(true)}
                            className="cursor-pointer rounded-lg bg-[#e3000f] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#b40009]"
                        >
                            + Tạo Role
                        </button>
                    )}
                </div>
            </div>

            {showCreate && (
                <div className="mb-4 rounded-lg border border-[#e0e3e5] bg-[#f8fafc] p-4">
                    <RoleForm
                        onCancel={() => setShowCreate(false)}
                        onSubmit={async (d) => await handleCreate(d)}
                    />
                </div>
            )}

            {editing && (
                <div className="mb-4 rounded-lg border border-[#e0e3e5] bg-[#f8fafc] p-4">
                    <RoleForm
                        initial={{ id: editing.id, roleName: editing.roleName, description: editing.description }}
                        onCancel={() => setEditing(null)}
                        onSubmit={async (d, id) => await handleUpdate(d, id)}
                    />
                </div>
            )}

            <div className="overflow-x-auto">
                {loading ? (
                    <div className="py-6 text-center text-sm text-[#5e3f3a]">Đang tải...</div>
                ) : (
                    <table className="min-w-full border-collapse text-left text-sm">
                        <thead>
                            <tr className="border-b border-[#e0e3e5] bg-[#f8fafc] text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                <th className="px-4 py-3">Tên quyền</th>
                                <th className="px-4 py-3">Mô tả</th>
                                <th className="px-4 py-3 text-center">Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            {roles.map((r) => (
                                <tr key={r.id} className="border-b border-[#f1f5f9] transition-colors hover:bg-[#f8fafc]">
                                    <td className="px-4 py-3 font-semibold text-[#191c1e]">{r.roleName}</td>
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
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

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