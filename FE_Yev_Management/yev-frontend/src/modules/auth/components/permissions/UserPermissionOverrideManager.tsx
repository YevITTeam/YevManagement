"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Save, Search } from "lucide-react";
import { toast } from "react-toastify";
import { AuthApi } from "@/modules/auth/api/auth.api";
import { PermissionApi } from "@/modules/auth/api/permission.api";
import type { UserDto } from "@/modules/auth/types/auth.dto";
import type { PermissionModuleGroupDto } from "@/modules/auth/types/permission.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import { hasPermission } from "@/modules/auth/lib/permissions";
import { useAuth } from "@/modules/auth/context/AuthContext";

// Override giá trị đang chọn cho 1 permission trên UI (chưa lưu).
// "inherit": không override, theo Role. "grant": cấp thêm riêng. "deny": thu hồi riêng.
type OverrideChoice = "inherit" | "grant" | "deny";

export default function UserPermissionOverrideManager() {
    const { user: currentUser } = useAuth();
    // PUT /api/Permission/user/{userId} yêu cầu permission Identity.User.UpdatePermissions (docs/identity-api-fe.md §4.8).
    const canUpdateUserPermissions = hasPermission(currentUser, "Identity.User.UpdatePermissions");

    const [users, setUsers] = useState<UserDto[]>([]);
    // Nhóm 2 cấp Module > Entity trả thẳng từ GET /api/Permission/all (docs/identity-api-fe.md §4.7, 2026-07-11).
    const [moduleGroups, setModuleGroups] = useState<PermissionModuleGroupDto[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
    const [userSearchTerm, setUserSearchTerm] = useState("");

    // Baseline quyền theo Role của user đang chọn (suy ra từ override + effective tại thời điểm tải) — không đổi khi user tick chọn trên UI.
    const [roleBaselineIds, setRoleBaselineIds] = useState<Set<number>>(new Set());
    // Lựa chọn override đang chỉnh trên UI (chưa lưu).
    const [choices, setChoices] = useState<Map<number, OverrideChoice>>(new Map());

    const [isLoadingBase, setIsLoadingBase] = useState(true);
    const [isLoadingUserPermissions, setIsLoadingUserPermissions] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const loadBase = async () => {
            setIsLoadingBase(true);
            try {
                const [usersData, permissionsData] = await Promise.all([
                    AuthApi.getAllUsersWithRoles(),
                    PermissionApi.getAll(),
                ]);
                setUsers(usersData);
                setModuleGroups(permissionsData);
                if (usersData.length > 0) setSelectedUserId(usersData[0].id);
            } catch (err) {
                toast.error(getApiErrorMessage(err, "Không thể tải danh sách người dùng / quyền."));
            } finally {
                setIsLoadingBase(false);
            }
        };
        loadBase();
    }, []);

    // Danh sách phẳng tất cả permission, suy ra từ cây Module > Entity — dùng để tính baseline theo Role.
    const flatPermissions = useMemo(
        () => moduleGroups.flatMap((moduleGroup) => moduleGroup.entities.flatMap((entityGroup) => entityGroup.permissions)),
        [moduleGroups]
    );

    const loadUserPermissions = useCallback(async (userId: number) => {
        setIsLoadingUserPermissions(true);
        try {
            const [overrides, effective] = await Promise.all([
                PermissionApi.getUserOverrides(userId),
                PermissionApi.getUserEffective(userId),
            ]);

            const effectiveIds = new Set(effective.map((p) => p.id));
            const overrideByPermissionId = new Map(overrides.map((o) => [o.permissionId, o.isGranted]));

            // roleHasAccess = hasOverride ? !isGranted : effectiveHasAccess (không override thì effective = role).
            const baseline = new Set<number>();
            for (const permission of flatPermissions.length > 0 ? flatPermissions : effective) {
                const override = overrideByPermissionId.get(permission.id);
                const roleHasAccess = override !== undefined ? !override : effectiveIds.has(permission.id);
                if (roleHasAccess) baseline.add(permission.id);
            }
            setRoleBaselineIds(baseline);

            const nextChoices = new Map<number, OverrideChoice>();
            overrideByPermissionId.forEach((isGranted, permissionId) => {
                nextChoices.set(permissionId, isGranted ? "grant" : "deny");
            });
            setChoices(nextChoices);
        } catch (err) {
            toast.error(getApiErrorMessage(err, "Không thể tải quyền của người dùng này."));
        } finally {
            setIsLoadingUserPermissions(false);
        }
    }, [flatPermissions]);

    useEffect(() => {
        if (selectedUserId === null || flatPermissions.length === 0) return;
        loadUserPermissions(selectedUserId);
    }, [selectedUserId, flatPermissions, loadUserPermissions]);

    const filteredUsers = useMemo(() => {
        const term = userSearchTerm.trim().toLowerCase();
        if (!term) return users;
        return users.filter(
            (user) => user.userName.toLowerCase().includes(term) || user.fullName.toLowerCase().includes(term)
        );
    }, [users, userSearchTerm]);

    const setChoice = (permissionId: number, choice: OverrideChoice) => {
        setChoices((prev) => {
            const next = new Map(prev);
            if (choice === "inherit") next.delete(permissionId);
            else next.set(permissionId, choice);
            return next;
        });
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
            await loadUserPermissions(selectedUserId);
        } catch (err) {
            toast.error(getApiErrorMessage(err, "Cập nhật phân quyền riêng thất bại"));
        } finally {
            setIsSaving(false);
        }
    };

    const selectedUser = users.find((user) => user.id === selectedUserId) ?? null;
    // Chặn tự sửa quyền của chính tài khoản đang đăng nhập — tránh tự khoá/tự cấp quyền cho mình.
    // So cả `id` lẫn `userName` (không phân biệt hoa/thường) — phòng trường hợp id trả về từ 2 API
    // (`getAllUsersWithRoles` vs `windows-login`) không đồng nhất kiểu dữ liệu, `userName` (định danh AD)
    // là nguồn đáng tin cậy hơn để nhận diện "đây chính là tài khoản đang đăng nhập".
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
                        Cấp thêm hoặc thu hồi riêng 1 quyền cho đúng 1 người, khác với quyền mặc định theo vai trò của họ.
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
                    <section className="h-fit overflow-hidden border border-[#e0e3e5] bg-white">
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
                        <div className="max-h-[60vh] divide-y divide-[#f1f5f9] overflow-y-auto">
                            {filteredUsers.length === 0 ? (
                                <div className="px-4 py-6 text-center text-sm text-[#5e3f3a]">Không tìm thấy.</div>
                            ) : (
                                filteredUsers.map((user) => (
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
                                        <div>{user.fullName || user.userName}</div>
                                        <div className="text-xs font-normal text-[#5e3f3a]">{user.userName}</div>
                                    </button>
                                ))
                            )}
                        </div>
                    </section>

                    <section className="overflow-hidden border border-[#e0e3e5] bg-white">
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
                            <div className="max-h-[60vh] divide-y divide-[#f1f5f9] overflow-y-auto">
                                {moduleGroups.map((moduleGroup) => (
                                    <div key={moduleGroup.module} className="px-4 py-3">
                                        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                            {moduleGroup.module}
                                        </div>
                                        <div className="space-y-3 pl-2">
                                            {moduleGroup.entities.map((entityGroup) => (
                                                <div key={entityGroup.entity}>
                                                    <div className="mb-1 text-xs font-semibold text-[#191c1e]">{entityGroup.entity}</div>
                                                    <div className="space-y-1.5">
                                                        {entityGroup.permissions.map((permission) => {
                                                            const choice = choices.get(permission.id) ?? "inherit";
                                                            const roleHasAccess = roleBaselineIds.has(permission.id);
                                                            const effectiveHasAccess =
                                                                choice === "grant" ? true : choice === "deny" ? false : roleHasAccess;

                                                            return (
                                                                <div
                                                                    key={permission.id}
                                                                    className="flex flex-col gap-1.5 border border-transparent py-1 sm:flex-row sm:items-center sm:justify-between"
                                                                    title={permission.description}
                                                                >
                                                                    <div className="flex items-center gap-2 text-sm">
                                                                        <span
                                                                            className={`h-2 w-2 flex-shrink-0 rounded-full ${
                                                                                effectiveHasAccess ? "bg-[#1a7f37]" : "bg-[#e0e3e5]"
                                                                            }`}
                                                                        />
                                                                        <span className="text-[#191c1e]">{permission.description}</span>
                                                                        <span className="text-xs text-[#5e3f3a]">
                                                                            ({roleHasAccess ? "có theo Role" : "không có theo Role"})
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex flex-shrink-0 gap-1 text-xs">
                                                                        {(
                                                                            [
                                                                                ["inherit", "Theo Role"],
                                                                                ["grant", "Cấp thêm"],
                                                                                ["deny", "Thu hồi"],
                                                                            ] as [OverrideChoice, string][]
                                                                        ).map(([value, label]) => (
                                                                            <button
                                                                                key={value}
                                                                                type="button"
                                                                                disabled={!canEditSelectedUser}
                                                                                onClick={() => setChoice(permission.id, value)}
                                                                                className={`cursor-pointer rounded px-2 py-1 font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                                                                    choice === value
                                                                                        ? value === "deny"
                                                                                            ? "bg-[#930006] text-white"
                                                                                            : value === "grant"
                                                                                              ? "bg-[#1a7f37] text-white"
                                                                                              : "bg-[#eceef0] text-[#191c1e]"
                                                                                        : "bg-white text-[#5e3f3a] hover:bg-[#f8fafc]"
                                                                                }`}
                                                                            >
                                                                                {label}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            )}
        </div>
    );
}
