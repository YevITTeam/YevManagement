"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Save, Search } from "lucide-react";
import { toast } from "react-toastify";
import { AuthApi } from "@/modules/auth/api/auth.api";
import { PermissionApi } from "@/modules/auth/api/permission.api";
import type { UserDto } from "@/modules/auth/types/auth.dto";
import type { PermissionDto, PermissionModuleGroupDto } from "@/modules/auth/types/permission.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import { hasPermission } from "@/modules/auth/lib/permissions";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import PermissionTree from "./PermissionTree";

// Unsaved UI choice: inherit = follow role, grant = extra grant, deny = revoke.
type OverrideChoice = "inherit" | "grant" | "deny";

// The endpoint returns all users, so the left list is paged client-side.
const USERS_PAGE_SIZE = 10;

export default function UserPermissionOverrideManager() {
    const { user: currentUser } = useAuth();
    const canUpdateUserPermissions = hasPermission(currentUser, "Identity.User.UpdatePermissions");

    const [users, setUsers] = useState<UserDto[]>([]);
    const [moduleGroups, setModuleGroups] = useState<PermissionModuleGroupDto[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
    const [userSearchTerm, setUserSearchTerm] = useState("");

    // Role-only baseline derived from overrides + effective at load time; unaffected by UI ticks.
    const [roleBaselineIds, setRoleBaselineIds] = useState<Set<number>>(new Set());
    // Job-title auto-grants are display-only and kept out of `choices`, so saving never turns them
    // into manual overrides unless the admin explicitly changes one.
    const [autoGrantedIds, setAutoGrantedIds] = useState<Set<number>>(new Set());
    // Pending manual overrides only.
    const [choices, setChoices] = useState<Map<number, OverrideChoice>>(new Map());

    const [isSaving, setIsSaving] = useState(false);

    const { isLoading: isLoadingBase } = useFetchEffect(
        () => Promise.all([AuthApi.getAllUsersWithRoles(), PermissionApi.getAll()]),
        [],
        ([usersData, permissionsData]) => {
            setUsers(usersData);
            setModuleGroups(permissionsData);
            if (usersData.length > 0) setSelectedUserId(usersData[0].id);
        },
        "Không thể tải danh sách người dùng / quyền.",
        undefined,
        "user-permission-base"
    );

    // Flat permission list, used to compute the role baseline.
    const flatPermissions = useMemo(
        () => moduleGroups.flatMap((moduleGroup) => moduleGroup.entities.flatMap((entityGroup) => entityGroup.permissions)),
        [moduleGroups]
    );

    const { isLoading: isLoadingUserPermissions, refetch: reloadUserPermissions } = useFetchEffect(
        async () => {
            if (selectedUserId === null || flatPermissions.length === 0) return null;
            const [overrides, effective] = await Promise.all([
                PermissionApi.getUserOverrides(selectedUserId),
                PermissionApi.getUserEffective(selectedUserId),
            ]);

            const effectiveIds = new Set(effective.map((p) => p.id));
            const overrideByPermissionId = new Map(overrides.map((o) => [o.permissionId, o.isGranted]));

            // Holds for both manual and auto overrides: roleHasAccess means the role alone grants it.
            const baseline = new Set<number>();
            for (const permission of flatPermissions.length > 0 ? flatPermissions : effective) {
                const override = overrideByPermissionId.get(permission.id);
                const roleHasAccess = override !== undefined ? !override : effectiveIds.has(permission.id);
                if (roleHasAccess) baseline.add(permission.id);
            }

            // Auto (job-title) overrides stay out of `choices`; otherwise every save would resend them as
            // permanent manual overrides that no longer get revoked on a job-title change.
            const autoGranted = new Set<number>();
            const nextChoices = new Map<number, OverrideChoice>();
            overrides.forEach((o) => {
                if (o.isAutoGranted) autoGranted.add(o.permissionId);
                else nextChoices.set(o.permissionId, o.isGranted ? "grant" : "deny");
            });

            return { baseline, autoGranted, nextChoices };
        },
        [selectedUserId, flatPermissions],
        (result) => {
            if (!result) return;
            setRoleBaselineIds(result.baseline);
            setAutoGrantedIds(result.autoGranted);
            setChoices(result.nextChoices);
        },
        "Không thể tải quyền của người dùng này.",
        undefined,
        "user-permission-overrides"
    );

    const filteredUsers = useMemo(() => {
        const term = userSearchTerm.trim().toLowerCase();
        if (!term) return users;
        return users.filter(
            (user) => user.userName.toLowerCase().includes(term) || user.fullName.toLowerCase().includes(term)
        );
    }, [users, userSearchTerm]);

    const [userPageIndex, setUserPageIndex] = useState(1);
    // Reset to page 1 on search change; snapshot compared during render instead of an effect.
    const [prevUserSearchTerm, setPrevUserSearchTerm] = useState(userSearchTerm);
    if (prevUserSearchTerm !== userSearchTerm) {
        setPrevUserSearchTerm(userSearchTerm);
        setUserPageIndex(1);
    }

    const userTotalPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PAGE_SIZE));
    const safeUserPageIndex = Math.min(userPageIndex, userTotalPages);
    const paginatedUsers = filteredUsers.slice(
        (safeUserPageIndex - 1) * USERS_PAGE_SIZE,
        safeUserPageIndex * USERS_PAGE_SIZE
    );

    // Checkbox = desired effective access: matching the default (role or job-title grant) needs no override.
    const setPermissionsChecked = (permissions: PermissionDto[], checked: boolean) => {
        setChoices((prev) => {
            const next = new Map(prev);
            for (const permission of permissions) {
                const defaultAccess = roleBaselineIds.has(permission.id) || autoGrantedIds.has(permission.id);
                if (checked === defaultAccess) next.delete(permission.id);
                else next.set(permission.id, checked ? "grant" : "deny");
            }
            return next;
        });
    };

    // Same formula as effectiveHasAccess in the render loop; used for collapsed header counts.
    const isPermissionEffectivelyGranted = (permissionId: number) => {
        const choice = choices.get(permissionId) ?? "inherit";
        if (choice === "grant") return true;
        if (choice === "deny") return false;
        return roleBaselineIds.has(permissionId) || autoGrantedIds.has(permissionId);
    };

    const handleSave = async () => {
        if (selectedUserId === null || isEditingSelf) return;
        const grantPermissionIds: number[] = [];
        const denyPermissionIds: number[] = [];
        choices.forEach((choice, permissionId) => {
            if (choice === "grant") grantPermissionIds.push(permissionId);
            else if (choice === "deny") denyPermissionIds.push(permissionId);
        });

        setIsSaving(true);
        try {
            await PermissionApi.updateUserOverrides(selectedUserId, { grantPermissionIds, denyPermissionIds });
            toast.success("Cập nhật phân quyền riêng thành công!");
            await reloadUserPermissions();
        } catch (err) {
            toast.error(getApiErrorMessage(err, "Cập nhật phân quyền riêng thất bại"));
        } finally {
            setIsSaving(false);
        }
    };

    const selectedUser = users.find((user) => user.id === selectedUserId) ?? null;
    // Block editing your own permissions (self-lockout/escalation); also compare userName because ids
    // from getAllUsersWithRoles and windows-login may differ in type.
    const isEditingSelf =
        currentUser !== null &&
        selectedUser !== null &&
        (String(selectedUser.id) === String(currentUser.id) ||
            selectedUser.userName.trim().toLowerCase() === currentUser.userName.trim().toLowerCase());
    const canEditSelectedUser = canUpdateUserPermissions && !isEditingSelf;

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-[#191c1e]">Phân quyền riêng theo người dùng</h1>
                    <p className="mt-1 text-[15px] text-[#5e3f3a]">
                        Tick để cấp thêm, bỏ tick để thu hồi so với quyền theo vai trò của người này.
                    </p>
                </div>
            </div>

            {isLoadingBase ? (
                <div className="flex min-h-40 items-center justify-center border border-[#e0e3e5] bg-white text-sm text-[#5e3f3a]">
                    Đang tải dữ liệu...
                </div>
            ) : users.length === 0 ? (
                <div className="flex min-h-40 items-center justify-center border border-[#e0e3e5] bg-white text-sm text-[#5e3f3a]">
                    Chưa có người dùng nào.
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-[280px_1fr]">
                    <section className="h-fit overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                        <div className="border-b border-[#e0e3e5] bg-[#f8fafc] p-3">
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5e3f3a]" />
                                <input
                                    value={userSearchTerm}
                                    onChange={(event) => setUserSearchTerm(event.target.value)}
                                    placeholder="Tìm người dùng..."
                                    className="h-9 w-full rounded-lg border border-[#e0e3e5] bg-white pl-9 pr-3 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                                />
                            </div>
                        </div>
                        <div className="divide-y divide-[#f1f5f9]">
                            {paginatedUsers.length === 0 ? (
                                <div className="px-4 py-6 text-center text-sm text-[#5e3f3a]">Không tìm thấy.</div>
                            ) : (
                                paginatedUsers.map((user) => (
                                    <button
                                        key={user.id}
                                        type="button"
                                        onClick={() => setSelectedUserId(user.id)}
                                        className={`block w-full cursor-pointer px-4 py-3 text-left text-sm transition ${
                                            user.id === selectedUserId
                                                ? "bg-[#fff4f2] font-semibold text-[#e3000f]"
                                                : "text-[#191c1e] hover:bg-[#f8fafc]"
                                        }`}
                                    >
                                        {user.fullName || user.userName}
                                    </button>
                                ))
                            )}
                        </div>
                        <div className="flex items-center justify-between border-t border-[#e0e3e5] px-3 py-2">
                            <button
                                type="button"
                                className="flex h-7 cursor-pointer items-center gap-1 rounded-md px-1.5 text-xs font-semibold text-[#5e3f3a] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-40"
                                disabled={safeUserPageIndex <= 1}
                                onClick={() => setUserPageIndex(Math.max(1, safeUserPageIndex - 1))}
                            >
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </button>
                            <div className="text-xs font-semibold text-[#191c1e]">
                                {safeUserPageIndex}/{userTotalPages}
                            </div>
                            <button
                                type="button"
                                className="flex h-7 cursor-pointer items-center gap-1 rounded-md px-1.5 text-xs font-semibold text-[#5e3f3a] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-40"
                                disabled={safeUserPageIndex >= userTotalPages}
                                onClick={() => setUserPageIndex(Math.min(userTotalPages, safeUserPageIndex + 1))}
                            >
                                <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </section>

                    <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                        <div className="flex items-center justify-between border-b border-[#e0e3e5] bg-[#f8fafc] px-4 py-3">
                            <div className="text-sm font-semibold text-[#191c1e]">
                                {selectedUser ? `Quyền riêng của "${selectedUser.fullName || selectedUser.userName}"` : "Chọn 1 người dùng"}
                            </div>
                            {canUpdateUserPermissions && (
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={isSaving || isLoadingUserPermissions || selectedUserId === null || isEditingSelf}
                                    title={isEditingSelf ? "Không thể tự chỉnh sửa quyền của chính tài khoản đang đăng nhập." : undefined}
                                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <Save className="h-4 w-4" />
                                    {isSaving ? "Đang lưu..." : "Lưu"}
                                </button>
                            )}
                        </div>

                        {isEditingSelf && (
                            <div className="border-b border-[#e9bcb6] bg-[#fff4f2] px-4 py-3 text-sm text-[#930006]">
                                Bạn đang xem tài khoản của chính mình — không thể tự chỉnh sửa quyền riêng cho tài khoản đang đăng nhập.
                            </div>
                        )}

                        {isLoadingUserPermissions ? (
                            <div className="px-4 py-10 text-center text-sm text-[#5e3f3a]">Đang tải quyền...</div>
                        ) : (
                            <PermissionTree
                                moduleGroups={moduleGroups}
                                isChecked={isPermissionEffectivelyGranted}
                                onToggle={setPermissionsChecked}
                                disabled={!canEditSelectedUser}
                                renderBadge={(permission) => {
                                    const choice = choices.get(permission.id) ?? "inherit";
                                    if (choice === "grant")
                                        return (
                                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                                                Cấp thêm
                                            </span>
                                        );
                                    if (choice === "deny")
                                        return (
                                            <span className="rounded-full border border-[#e9bcb6] bg-[#fff4f2] px-2 py-0.5 text-xs font-semibold text-[#930006]">
                                                Thu hồi
                                            </span>
                                        );
                                    if (autoGrantedIds.has(permission.id))
                                        return (
                                            <span
                                                title="Tự động cấp theo Chức vụ hiện tại (Attendance) — đổi/gỡ Chức vụ sẽ tự thu hồi. Bỏ tick để thu hồi riêng."
                                                className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700"
                                            >
                                                Theo Chức vụ
                                            </span>
                                        );
                                    return null;
                                }}
                            />
                        )}
                    </section>
                </div>
            )}
        </div>
    );
}
