"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Edit2, Save, Search } from "lucide-react";
import { AuthApi } from "@/modules/auth/api/auth.api";
import type { UserDto, RoleDto } from "@/modules/auth/types/auth.dto";
import { toast } from "react-toastify";
import RoleSelectModal from "./RoleSelectModal";
import CreateUserDialog from "./CreateUserDialog";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { getApiErrorMessage } from "@/lib/apiError";
import { hasPermission } from "@/modules/auth/lib/permissions";
import { useAuth } from "@/modules/auth/context/AuthContext";

interface Props {
    isOpen: boolean;
    onClose?: () => void;
}

export default function UserRoleModal({ isOpen, onClose }: Props) {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState<UserDto[]>([]);
    const [roles, setRoles] = useState<RoleDto[]>([]);
    const [selectedRolesMap, setSelectedRolesMap] = useState<Record<number, number[]>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [openRoleModalUserId, setOpenRoleModalUserId] = useState<number | null>(null);
    const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
    const [savingUserId, setSavingUserId] = useState<number | null>(null);
    const [deletingUser, setDeletingUser] = useState<UserDto | null>(null);
    const [isDeletingUser, setIsDeletingUser] = useState(false);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [usersData, rolesData] = await Promise.all([
                AuthApi.getAllUsersWithRoles(),
                AuthApi.getAllRoles(),
            ]);
            setUsers(usersData);
            setRoles(rolesData);

            const initialRoleMap: Record<number, number[]> = {};
            usersData.forEach((user: UserDto) => {
                const userRoleIds = rolesData
                    .filter((r: RoleDto) => user.roles.includes(r.roleName))
                    .map((r: RoleDto) => r.id);
                initialRoleMap[user.id] = userRoleIds;
            });
            setSelectedRolesMap(initialRoleMap);
        } catch (error) {
            console.error("Lỗi tải dữ liệu:", error);
            toast.warn("Không thể tải dữ liệu. Vui lòng thử lại!");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        const timer = window.setTimeout(() => {
            void fetchData();
        }, 0);
        return () => window.clearTimeout(timer);
    }, [fetchData, isOpen]);

    // POST /api/Auth/update-user-roles yêu cầu permission Identity.User.UpdateRoles (docs/identity-api-fe.md §4.2).
    const canUpdateUserRoles = hasPermission(currentUser, "Identity.User.UpdateRoles");
    // POST /api/Auth/create-user yêu cầu permission Identity.User.Create (docs/identity-api-fe.md §4.9).
    const canCreateUser = hasPermission(currentUser, "Identity.User.Create");
    // DELETE /api/Auth/delete-user/{userId} — cùng quy ước đặt tên permission với delete-role (Identity.Role.Delete).
    const canDeleteUser = hasPermission(currentUser, "Identity.User.Delete");

    const filteredUsers = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return users;
        return users.filter((user) => {
            return (
                user.userName.toLowerCase().includes(term) ||
                user.fullName.toLowerCase().includes(term)
            );
        });
    }, [users, searchTerm]);

    const handleCheckboxChange = (userId: number, roleId: number, isChecked: boolean) => {
        setSelectedRolesMap((prev) => {
            const currentRoles = prev[userId] || [];
            if (isChecked) {
                return { ...prev, [userId]: [...currentRoles, roleId] };
            }
            return { ...prev, [userId]: currentRoles.filter((id) => id !== roleId) };
        });
    };

    const handleSave = async (userId: number) => {
        setSavingUserId(userId);
        try {
            const roleIds = selectedRolesMap[userId] || [];
            await AuthApi.updateUserRoles({ userId, roleIds });
            toast.success("Cập nhật quyền thành công!");
            await fetchData();
            return true;
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, "Cập nhật thất bại!"));
            return false;
        } finally {
            setSavingUserId(null);
        }
    };

    const handleSaveFromModal = async () => {
        if (openRoleModalUserId === null) return;

        const success = await handleSave(openRoleModalUserId);
        if (success) {
            setOpenRoleModalUserId(null);
        }
    };

    const handleDeleteUser = async () => {
        if (!deletingUser) return;
        setIsDeletingUser(true);
        try {
            await AuthApi.deleteUser(deletingUser.id);
            toast.success("Xoá người dùng thành công!");
            setDeletingUser(null);
            await fetchData();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, "Xoá người dùng thất bại!"));
        } finally {
            setIsDeletingUser(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="space-y-8">
            {/* Header Section */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-[#191c1e]">Phân quyền người dùng</h1>
                    <p className="mt-1 text-[15px] text-[#5e3f3a]">
                        Cập nhật vai trò cho từng tài khoản hệ thống.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e]">
                        Tổng user: {users.length}
                    </div>
                    <div className="rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e]">
                        Tổng roles: {roles.length}
                    </div>
                    {canCreateUser && (
                        <button
                            onClick={() => setIsCreateUserOpen(true)}
                            className="cursor-pointer rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009]"
                        >
                            + Tạo user
                        </button>
                    )}
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="rounded-lg border border-[#e0e3e5] bg-white px-4 py-2 text-sm font-semibold text-[#191c1e] transition hover:bg-[#f2f4f6]"
                        >
                            Đóng
                        </button>
                    )}
                </div>
            </div>

            {/* Table Section */}
            {isLoading ? (
                <div className="flex min-h-40 items-center justify-center border border-[#e0e3e5] bg-white text-sm text-[#5e3f3a]">
                    Đang tải dữ liệu...
                </div>
            ) : (
                <section className="overflow-hidden border border-[#e0e3e5] bg-white">
                    {/* Search / Filter Bar */}
                    <div className="flex flex-col gap-3 border-b border-[#e0e3e5] bg-[#f8fafc] p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="relative w-full sm:max-w-sm">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5e3f3a]" />
                            <input
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder="Tìm tài khoản hoặc tên..."
                                className="h-10 w-full rounded-lg border border-[#e0e3e5] bg-white pl-9 pr-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                            />
                        </div>
                        <div className="text-sm font-medium text-[#5e3f3a]">
                            Hiển thị {filteredUsers.length} bản ghi
                        </div>
                    </div>

                    {/* Table Header */}
                    <div className="hidden border-b border-[#e0e3e5] bg-[#f8fafc] px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a] md:grid md:grid-cols-[1.4fr_1.2fr_0.8fr]">
                        <div>Người dùng</div>
                        <div>Vai trò</div>
                        <div className="text-right">Thao tác</div>
                    </div>

                    {/* Table Body */}
                    <div className="divide-y divide-[#e0e3e5]">
                        {filteredUsers.length === 0 ? (
                            <div className="px-4 py-10 text-center text-sm text-[#5e3f3a]">
                                Không tìm thấy người dùng phù hợp.
                            </div>
                        ) : (
                            filteredUsers.map((user) => {
                                const isSelf = currentUser?.userName === user.userName;
                                const isDisabled = isSelf || !canUpdateUserRoles;
                                const currentSelectedIds = selectedRolesMap[user.id] || [];

                                return (
                                    <div
                                        key={user.id}
                                        className={`grid gap-4 px-4 py-4 md:grid-cols-[1.4fr_1.2fr_0.8fr] align-top transition hover:bg-[#f8fafc] ${isSelf ? "bg-[#fff4f2]/40" : "bg-white"
                                            }`}
                                    >
                                        <div className="flex flex-col gap-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-sm font-semibold text-[#191c1e]">
                                                    {user.fullName || user.userName}
                                                </span>
                                                {isSelf && (
                                                    <span className="border border-[#e9bcb6] bg-[#fff4f2] px-2 py-0.5 text-[10px] font-semibold tracking-wider text-[#930006]">
                                                        BẠN
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-[#5e3f3a]">{user.userName}</p>
                                        </div>

                                        <div className="flex flex-col gap-3 justify-center">
                                            <button
                                                onClick={() => setOpenRoleModalUserId(user.id)}
                                                disabled={isDisabled}
                                                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${isDisabled
                                                    ? "cursor-not-allowed border-[#e0e3e5] bg-[#f8fafc] text-[#5e3f3a] opacity-60"
                                                    : "border-[#e0e3e5] bg-white text-[#191c1e] hover:border-[#e3000f] hover:bg-[#fff4f2]"
                                                    }`}
                                            >
                                                <span className="flex flex-wrap gap-1.5">
                                                    {currentSelectedIds.length > 0 ? (
                                                        currentSelectedIds.map((roleId) => {
                                                            const role = roles.find((item) => item.id === roleId);
                                                            return role ? (
                                                                <span
                                                                    key={role.id}
                                                                    className="border border-[#e0e3e5] bg-[#f8fafc] px-2 py-0.5 text-xs font-medium text-[#191c1e]"
                                                                >
                                                                    {role.roleName}
                                                                </span>
                                                            ) : null;
                                                        })
                                                    ) : (
                                                        <span className="text-[#5e3f3a]">Chọn vai trò...</span>
                                                    )}
                                                </span>
                                                <Edit2 className="h-4 w-4 flex-shrink-0 text-[#5e3f3a]" />
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-end">
                                            <button
                                                onClick={() => setDeletingUser(user)}
                                                disabled={isSelf || !canDeleteUser}
                                                title={isSelf ? "Không thể tự xoá chính mình" : "Xoá người dùng"}
                                                className="cursor-pointer text-sm font-semibold text-[#930006] transition hover:text-[#e3000f] disabled:cursor-not-allowed disabled:text-[#5e3f3a] disabled:opacity-60"
                                            >
                                                Xoá
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </section>
            )}

            {/* Role Select Modal */}
            {openRoleModalUserId !== null && (
                <RoleSelectModal
                    isOpen={true}
                    roles={roles}
                    selectedRoleIds={selectedRolesMap[openRoleModalUserId] || []}
                    onRoleChange={(roleId, isChecked) => handleCheckboxChange(openRoleModalUserId, roleId, isChecked)}
                    onClose={() => setOpenRoleModalUserId(null)}
                    onSave={handleSaveFromModal}
                    isSaving={savingUserId !== null}
                    disabled={currentUser?.userName === users.find((user) => user.id === openRoleModalUserId)?.userName || !canUpdateUserRoles}
                />
            )}

            <CreateUserDialog
                isOpen={isCreateUserOpen}
                roles={roles}
                onClose={() => setIsCreateUserOpen(false)}
                onCreated={() => {
                    setIsCreateUserOpen(false);
                    void fetchData();
                }}
            />

            <ConfirmDialog
                isOpen={deletingUser !== null}
                title="Xoá người dùng"
                message={
                    <>
                        Bạn có chắc muốn xoá tài khoản{" "}
                        <strong>{deletingUser?.fullName || deletingUser?.userName}</strong> không? Hành động này không
                        thể hoàn tác.
                    </>
                }
                approveLabel="Xoá"
                deniedLabel="Huỷ"
                loading={isDeletingUser}
                onApprove={handleDeleteUser}
                onDenied={() => {
                    if (!isDeletingUser) setDeletingUser(null);
                }}
            />
        </div>
    );
}