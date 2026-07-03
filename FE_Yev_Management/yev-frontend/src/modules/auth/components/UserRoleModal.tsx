"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Edit2, Save, Search, ShieldCheck } from "lucide-react";
import { AdminApi } from "@/modules/auth/api/admin.api";
import { AuthApi } from "@/modules/auth/api/auth.api";
import type { UserDto, RoleDto } from "@/modules/auth/types/auth.dto";
import { toast } from "react-toastify";
import RoleSelectModal from "./RoleSelectModal";

interface Props {
    isOpen: boolean;
    onClose?: () => void;
}

export default function UserRoleModal({ isOpen, onClose }: Props) {
    const [users, setUsers] = useState<UserDto[]>([]);
    const [roles, setRoles] = useState<RoleDto[]>([]);
    const [currentUser, setCurrentUser] = useState<UserDto | null>(null);
    const [selectedRolesMap, setSelectedRolesMap] = useState<Record<number, number[]>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [openRoleModalUserId, setOpenRoleModalUserId] = useState<number | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [usersData, rolesData, meData] = await Promise.all([
                AdminApi.getUsers(),
                AdminApi.getRoles(),
                AuthApi.getMe(),
            ]);

            setUsers(usersData);
            setRoles(rolesData);
            setCurrentUser(meData);

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
        try {
            const roleIds = selectedRolesMap[userId] || [];
            await AdminApi.updateUserRoles({ userId, roleIds });
            toast.success("Cập nhật quyền thành công!");
            await fetchData();
        } catch {
            toast.error("Cập nhật thất bại!");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                            <ShieldCheck className="h-4 w-4" />
                            Quản lý phân quyền
                        </div>
                        <div>
                            <h2 className="text-2xl font-semibold text-slate-900">Phân quyền người dùng</h2>
                            <p className="text-sm text-slate-500">
                                Cập nhật vai trò cho từng tài khoản bằng bảng danh sách trực quan.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <p className="text-xs uppercase tracking-wide text-slate-400">Tổng người dùng</p>
                            <p className="text-lg font-semibold text-slate-900">{users.length}</p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <p className="text-xs uppercase tracking-wide text-slate-400">Tổng vai trò</p>
                            <p className="text-lg font-semibold text-slate-900">{roles.length}</p>
                        </div>
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="cursor-pointer rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-red-300 hover:text-red-500"
                            >
                                Đóng
                            </button>
                        )}
                    </div>
                </div>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative w-full sm:max-w-sm">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            placeholder="Tìm tên tài khoản hoặc họ tên"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white"
                        />
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="flex min-h-40 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-500 shadow-sm">
                    Đang tải dữ liệu...
                </div>
            ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="hidden border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 md:grid md:grid-cols-[1.4fr_1.2fr_0.8fr]">
                        <div>Người dùng</div>
                        <div>Vai trò</div>
                        <div className="text-right">Thao tác</div>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {filteredUsers.length === 0 ? (
                            <div className="px-4 py-10 text-center text-sm text-slate-500">
                                Không tìm thấy người dùng phù hợp.
                            </div>
                        ) : (
                            filteredUsers.map((user) => {
                                const isSelf = currentUser?.userName === user.userName;
                                const currentSelectedIds = selectedRolesMap[user.id] || [];

                                return (
                                    <div
                                        key={user.id}
                                        className={`grid gap-4 px-4 py-4 md:grid-cols-[1.4fr_1.2fr_0.8fr] ${isSelf ? "bg-rose-50/40" : "bg-white"}`}
                                    >
                                        <div className="flex flex-col gap-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-base font-semibold text-slate-800">
                                                    {user.fullName || user.userName}
                                                </span>
                                                {isSelf && (
                                                    <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-600">
                                                        Bạn
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-500">{user.userName}</p>
                                        </div>

                                        <div className="flex flex-col gap-3">
                                            <button
                                                onClick={() => setOpenRoleModalUserId(user.id)}
                                                disabled={isSelf}
                                                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition ${isSelf
                                                    ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                                                    : "border-slate-200 bg-white text-slate-700 hover:border-blue-500 hover:bg-blue-50"
                                                    }`}
                                            >
                                                <span className="flex flex-wrap gap-2">
                                                    {currentSelectedIds.length > 0 ? (
                                                        currentSelectedIds.map((roleId) => {
                                                            const role = roles.find((item) => item.id === roleId);
                                                            return role ? (
                                                                <span
                                                                    key={role.id}
                                                                    className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
                                                                >
                                                                    {role.roleName}
                                                                </span>
                                                            ) : null;
                                                        })
                                                    ) : (
                                                        <span className="text-sm text-slate-400">Chọn vai trò...</span>
                                                    )}
                                                </span>
                                                <Edit2 className="cursor-pointer h-4 w-4 flex-shrink-0" />
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-end">
                                            <button
                                                onClick={() => handleSave(user.id)}
                                                disabled={isSelf}
                                                className={`inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${isSelf
                                                    ? "cursor-not-allowed bg-slate-200 text-slate-500"
                                                    : "bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]"
                                                    }`}
                                            >
                                                <Save className="h-4 w-4" />
                                                <span>Cập nhật</span>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* Modal để chọn vai trò */}
            {openRoleModalUserId !== null && (
                <RoleSelectModal
                    isOpen={true}
                    roles={roles}
                    selectedRoleIds={selectedRolesMap[openRoleModalUserId] || []}
                    onRoleChange={(roleId, isChecked) => handleCheckboxChange(openRoleModalUserId, roleId, isChecked)}
                    onClose={() => setOpenRoleModalUserId(null)}
                />
            )}
        </div>
    );
}