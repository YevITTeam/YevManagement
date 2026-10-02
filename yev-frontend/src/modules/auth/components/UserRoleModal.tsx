"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Edit2, Pencil, Plus, QrCode, Search, Trash2 } from "lucide-react";
import { AuthApi } from "@/modules/auth/api/auth.api";
import { LoginQrApi } from "@/modules/auth/api/login-qr.api";
import type { UserDto, RoleDto, LoginQrStatusDto } from "@/modules/auth/types/auth.dto";
import { toast } from "react-toastify";
import RoleSelectModal from "./RoleSelectModal";
import CreateUserDialog from "./CreateUserDialog";
import EditUserDialog from "./EditUserDialog";
import LoginQrDialog from "./LoginQrDialog";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { getApiErrorMessage } from "@/lib/apiError";
import { hasPermission } from "@/modules/auth/lib/permissions";
import { useAuth } from "@/modules/auth/context/AuthContext";

interface Props {
    isOpen: boolean;
    onClose?: () => void;
}

// get-all-users-with-roles trả toàn bộ user (endpoint này còn dùng chung cho các dropdown chọn
// nhân sự ở nơi khác nên không đổi sang phân trang BE) — phân trang client-side tại đây.
const PAGE_SIZE = 15;

export default function UserRoleModal({ isOpen, onClose }: Props) {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState<UserDto[]>([]);
    const [roles, setRoles] = useState<RoleDto[]>([]);
    const [selectedRolesMap, setSelectedRolesMap] = useState<Record<number, number[]>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [roleFilter, setRoleFilter] = useState<number | "">("");
    const [openRoleModalUserId, setOpenRoleModalUserId] = useState<number | null>(null);
    const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<UserDto | null>(null);
    const [savingUserId, setSavingUserId] = useState<number | null>(null);
    const [deletingUser, setDeletingUser] = useState<UserDto | null>(null);
    const [isDeletingUser, setIsDeletingUser] = useState(false);
    const [qrStatusByUser, setQrStatusByUser] = useState<Record<number, LoginQrStatusDto>>({});
    const [qrUser, setQrUser] = useState<UserDto | null>(null);

    // /api/LoginQr (tạo/thu hồi/xem nhật ký mã QR đăng nhập app YEV Scan) — 1 permission cho cả nhóm.
    const canManageLoginQr = hasPermission(currentUser, "Identity.LoginQr.Manage");

    const fetchQrStatuses = useCallback(async () => {
        if (!canManageLoginQr) return;
        try {
            const active = await LoginQrApi.getActive();
            setQrStatusByUser(Object.fromEntries(active.map((item) => [item.userId, item])));
        } catch (error) {
            console.error("Lỗi tải trạng thái mã QR:", error);
        }
    }, [canManageLoginQr]);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [usersData, rolesData] = await Promise.all([
                AuthApi.getAllUsersWithRoles(roleFilter === "" ? undefined : roleFilter),
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
            void fetchQrStatuses();
        } catch (error) {
            console.error("Lỗi tải dữ liệu:", error);
            toast.warn("Không thể tải dữ liệu. Vui lòng thử lại!");
        } finally {
            setIsLoading(false);
        }
    }, [roleFilter, fetchQrStatuses]);

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
    // PUT /api/Auth/update-user-fullname — CHỈ sửa tên hiển thị, không sửa được userName Windows.
    const canUpdateFullName = hasPermission(currentUser, "Identity.User.UpdateFullName");

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

    const [pageIndex, setPageIndex] = useState(1);
    // Search/filter đổi → về trang 1 (snapshot so sánh ngay trong render, không dùng effect — AGENTS.md §4.5.3).
    const filtersKey = `${searchTerm}|${roleFilter}`;
    const [prevFiltersKey, setPrevFiltersKey] = useState(filtersKey);
    if (prevFiltersKey !== filtersKey) {
        setPrevFiltersKey(filtersKey);
        setPageIndex(1);
    }

    const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
    const safePageIndex = Math.min(pageIndex, totalPages);
    const paginatedUsers = filteredUsers.slice((safePageIndex - 1) * PAGE_SIZE, safePageIndex * PAGE_SIZE);

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
                            className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009]"
                        >
                            <Plus className="h-4 w-4" /> Tạo user
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
                <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                    {/* Search / Filter Bar */}
                    <div className="flex flex-col gap-3 border-b border-[#e0e3e5] bg-[#f8fafc] p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <div className="relative w-full sm:max-w-sm">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5e3f3a]" />
                                <input
                                    value={searchTerm}
                                    onChange={(event) => setSearchTerm(event.target.value)}
                                    placeholder="Tìm tài khoản hoặc tên..."
                                    className="h-10 w-full rounded-lg border border-[#e0e3e5] bg-white pl-9 pr-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                                />
                            </div>
                            <select
                                value={roleFilter}
                                onChange={(event) =>
                                    setRoleFilter(event.target.value === "" ? "" : Number(event.target.value))
                                }
                                className="h-10 w-full rounded-lg border border-[#e0e3e5] bg-white px-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3] sm:w-auto"
                            >
                                <option value="">Tất cả vai trò</option>
                                {roles.map((role) => (
                                    <option key={role.id} value={role.id}>
                                        {role.roleName}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="text-sm font-medium text-[#5e3f3a]">
                            Hiển thị {paginatedUsers.length}/{filteredUsers.length} bản ghi (trang {safePageIndex}/{totalPages})
                        </div>
                    </div>

                    <div>
                        {/* Table Header */}
                        <div className="sticky top-0 z-10 hidden border-b border-[#e0e3e5] bg-[#f8fafc] px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#5e3f3a] md:grid md:grid-cols-[1.4fr_1.2fr_0.8fr]">
                            <div>Người dùng</div>
                            <div>Vai trò</div>
                            <div className="text-right">Thao tác</div>
                        </div>

                        {/* Table Body */}
                        <div className="divide-y divide-[#e0e3e5]">
                            {paginatedUsers.length === 0 ? (
                                <div className="px-4 py-10 text-center text-sm text-[#5e3f3a]">
                                    Không tìm thấy người dùng phù hợp.
                                </div>
                            ) : (
                                paginatedUsers.map((user) => {
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
                                                    <span className="rounded-full border border-[#e9bcb6] bg-[#fff4f2] px-2 py-0.5 text-[10px] font-semibold tracking-wider text-[#930006]">
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
                                                                    className="rounded-full border border-[#e0e3e5] bg-[#f8fafc] px-2.5 py-0.5 text-xs font-medium text-[#191c1e]"
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

                                        <div className="flex items-center justify-end gap-3">
                                            {canManageLoginQr && (
                                                <button
                                                    onClick={() => setQrUser(user)}
                                                    title={qrStatusByUser[user.id] ? "Quản lý mã QR đăng nhập (đang có mã)" : "Tạo mã QR đăng nhập"}
                                                    className={`flex cursor-pointer items-center gap-1.5 text-sm font-semibold transition hover:text-[#e3000f] ${
                                                        qrStatusByUser[user.id] ? "text-[#e3000f]" : "text-[#191c1e]"
                                                    }`}
                                                >
                                                    <QrCode className="h-3.5 w-3.5" />
                                                    QR
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setEditingUser(user)}
                                                disabled={!canUpdateFullName}
                                                title="Sửa họ tên hiển thị"
                                                className="flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-[#191c1e] transition hover:text-[#e3000f] disabled:cursor-not-allowed disabled:text-[#5e3f3a] disabled:opacity-60"
                                            >
                                                <Pencil className="h-3.5 w-3.5" /> Sửa
                                            </button>
                                            <button
                                                onClick={() => setDeletingUser(user)}
                                                disabled={isSelf || !canDeleteUser}
                                                title={isSelf ? "Không thể tự xoá chính mình" : "Xoá người dùng"}
                                                className="flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-[#930006] transition hover:text-[#e3000f] disabled:cursor-not-allowed disabled:text-[#5e3f3a] disabled:opacity-60"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" /> Xoá
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                            )}
                        </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-[#e0e3e5] px-4 py-2.5">
                        <button
                            type="button"
                            className="flex h-7 cursor-pointer items-center gap-1 rounded-md px-2 text-xs font-semibold text-[#5e3f3a] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={safePageIndex <= 1}
                            onClick={() => setPageIndex(Math.max(1, safePageIndex - 1))}
                        >
                            <ChevronLeft className="h-3.5 w-3.5" /> Trang trước
                        </button>
                        <div className="text-xs font-semibold text-[#191c1e]">
                            Trang {safePageIndex} / {totalPages}
                        </div>
                        <button
                            type="button"
                            className="flex h-7 cursor-pointer items-center gap-1 rounded-md px-2 text-xs font-semibold text-[#5e3f3a] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={safePageIndex >= totalPages}
                            onClick={() => setPageIndex(Math.min(totalPages, safePageIndex + 1))}
                        >
                            Trang sau <ChevronRight className="h-3.5 w-3.5" />
                        </button>
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

            <EditUserDialog
                isOpen={editingUser !== null}
                user={editingUser}
                onClose={() => setEditingUser(null)}
                onUpdated={() => {
                    setEditingUser(null);
                    void fetchData();
                }}
            />

            <LoginQrDialog
                isOpen={qrUser !== null}
                user={qrUser}
                status={qrUser ? (qrStatusByUser[qrUser.id] ?? null) : null}
                onClose={() => setQrUser(null)}
                onChanged={() => void fetchQrStatuses()}
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