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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Quản lý Roles</h2>
                <div className="flex items-center gap-2">
                    {!showCreate && !editing && (
                        <button
                            onClick={() => setShowCreate(true)}
                            className="cursor-pointer px-3 py-1 rounded-md bg-green-600 text-white"
                        >
                            Tạo Role
                        </button>
                    )}
                </div>
            </div>

            {showCreate && (
                <div className="mb-4 border rounded p-4 bg-gray-50">
                    <RoleForm
                        onCancel={() => setShowCreate(false)}
                        onSubmit={async (d) => await handleCreate(d)}
                    />
                </div>
            )}

            {editing && (
                <div className="mb-4 border rounded p-4 bg-gray-50">
                    <RoleForm
                        initial={{ id: editing.id, roleName: editing.roleName, description: editing.description }}
                        onCancel={() => setEditing(null)}
                        onSubmit={async (d, id) => await handleUpdate(d, id)}
                    />
                </div>
            )}

            <div className="overflow-x-auto">
                {loading ? (
                    <div className="py-6 text-center text-gray-500">Đang tải...</div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-100 text-gray-600 text-sm uppercase tracking-wider">
                                <th className="p-3 border-b">Tên quyền</th>
                                <th className="p-3 border-b">Mô tả</th>
                                <th className="p-3 border-b text-center">Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            {roles.map((r) => (
                                <tr key={r.id} className="border-b hover:bg-gray-50">
                                    <td className="p-3 font-medium text-gray-800">{r.roleName}</td>
                                    <td className="p-3 text-gray-600">{r.description || "-"}</td>
                                    <td className="p-3 text-center">
                                        <div className="inline-flex gap-2">
                                            <button
                                                onClick={() => setEditing(r)}
                                                className="cursor-pointer px-3 py-1 rounded-md border text-sm"
                                            >
                                                Sửa
                                            </button>
                                            <button
                                                onClick={() => openDeleteConfirm(r.id)}
                                                className="cursor-pointer px-3 py-1 rounded-md bg-red-600 text-white text-sm"
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