"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Save, Search } from "lucide-react";
import { toast } from "react-toastify";
import { AuthApi } from "@/modules/auth/api/auth.api";
import { PermissionApi } from "@/modules/auth/api/permission.api";
import type { UserDto } from "@/modules/auth/types/auth.dto";
import type { PermissionModuleGroupDto } from "@/modules/auth/types/permission.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import { hasPermission } from "@/modules/auth/lib/permissions";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";

// Override giá trị đang chọn cho 1 permission trên UI (chưa lưu).
// "inherit": không override, theo Role. "grant": cấp thêm riêng. "deny": thu hồi riêng.
type OverrideChoice = "inherit" | "grant" | "deny";

// get-all-users-with-roles trả toàn bộ user — phân trang client-side cho danh sách bên trái.
const USERS_PAGE_SIZE = 10;

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
    // Permission đang được Chức vụ (Attendance) tự động cấp — CHỈ để hiển thị, KHÔNG nằm trong
    // `choices` (không đi vào payload lưu) trừ khi Admin chủ động bấm đổi (khi đó thao tác tay
    // "chiếm" luôn dòng đó, xem PermissionService.UpdateUserPermissionOverridesAsync ở BE).
    const [autoGrantedIds, setAutoGrantedIds] = useState<Set<number>>(new Set());
    // Lựa chọn override đang chỉnh trên UI (chưa lưu) — chỉ gồm override THỦ CÔNG.
    const [choices, setChoices] = useState<Map<number, OverrideChoice>>(new Map());

    // Cây quyền gộp theo Module > Entity, mặc định đóng hết — mirror RolePermissionManager.tsx, tránh
    // hiển thị phẳng toàn bộ hàng trăm permission gây rối (cùng lý do đã sửa ở màn Phân quyền theo vai trò).
    const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
    const [expandedEntities, setExpandedEntities] = useState<Set<string>>(new Set());

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

    // Danh sách phẳng tất cả permission, suy ra từ cây Module > Entity — dùng để tính baseline theo Role.
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

            // roleHasAccess = hasOverride ? !isGranted : effectiveHasAccess (không override thì effective = role).
            // Đúng cho CẢ override thủ công lẫn tự động — "roleHasAccess" luôn nghĩa là "Role một mình
            // (không tính bất kỳ override nào) có cấp quyền này không", không phụ thuộc nguồn override.
            const baseline = new Set<number>();
            for (const permission of flatPermissions.length > 0 ? flatPermissions : effective) {
                const override = overrideByPermissionId.get(permission.id);
                const roleHasAccess = override !== undefined ? !override : effectiveIds.has(permission.id);
                if (roleHasAccess) baseline.add(permission.id);
            }

            // Tách 2 loại override: tự động theo Chức vụ (chỉ hiển thị, không đưa vào choices để lưu)
            // và thủ công (đưa vào choices như cũ) — nếu gộp chung, mỗi lần Admin bấm Lưu (dù chỉ sửa
            // 1 quyền khác) sẽ vô tình gửi lại TOÀN BỘ quyền tự động như thể Admin vừa tự tay cấp,
            // biến chúng thành override thủ công vĩnh viễn (không còn tự thu hồi được khi đổi Chức vụ).
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
    // Tìm kiếm đổi → về trang 1 (snapshot so sánh ngay trong render, không dùng effect — AGENTS.md §4.5.3).
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

    const setChoice = (permissionId: number, choice: OverrideChoice) => {
        setChoices((prev) => {
            const next = new Map(prev);
            if (choice === "inherit") next.delete(permissionId);
            else next.set(permissionId, choice);
            return next;
        });
    };

    const toggleModuleExpand = (module: string) => {
        setExpandedModules((prev) => {
            const next = new Set(prev);
            if (next.has(module)) next.delete(module);
            else next.add(module);
            return next;
        });
    };

    const toggleEntityExpand = (entityKey: string) => {
        setExpandedEntities((prev) => {
            const next = new Set(prev);
            if (next.has(entityKey)) next.delete(entityKey);
            else next.add(entityKey);
            return next;
        });
    };

    // Hiệu lực hiện tại (Role/Chức vụ tự cấp, trừ khi bị override tay) — dùng để đếm số quyền "đang có"
    // trong tiêu đề Module/Entity lúc đang thu gọn, cùng công thức effectiveHasAccess trong vòng lặp render.
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
                            <div className="max-h-[60vh] divide-y divide-[#f1f5f9] overflow-y-auto">
                                {moduleGroups.map((moduleGroup) => {
                                    const modulePermissions = moduleGroup.entities.flatMap((e) => e.permissions);
                                    const moduleGrantedCount = modulePermissions.filter((p) => isPermissionEffectivelyGranted(p.id)).length;
                                    const isModuleExpanded = expandedModules.has(moduleGroup.module);
                                    return (
                                    <div key={moduleGroup.module} className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => toggleModuleExpand(moduleGroup.module)}
                                                className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                                                aria-label={isModuleExpanded ? "Thu gọn" : "Mở rộng"}
                                            >
                                                {isModuleExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => toggleModuleExpand(moduleGroup.module)}
                                                className="flex flex-1 cursor-pointer items-center gap-2 text-left text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]"
                                            >
                                                {moduleGroup.module}
                                                <span className="font-normal normal-case tracking-normal text-[#8a8f94]">
                                                    ({moduleGrantedCount}/{modulePermissions.length})
                                                </span>
                                            </button>
                                        </div>
                                        {isModuleExpanded && (
                                        <div className="mt-2 space-y-3 pl-6">
                                            {moduleGroup.entities.map((entityGroup) => {
                                                const entityGrantedCount = entityGroup.permissions.filter((p) =>
                                                    isPermissionEffectivelyGranted(p.id)
                                                ).length;
                                                const entityKey = `${moduleGroup.module}::${entityGroup.entity}`;
                                                const isEntityExpanded = expandedEntities.has(entityKey);
                                                return (
                                                <div key={entityGroup.entity}>
                                                    <div className="mb-1 flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleEntityExpand(entityKey)}
                                                            className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                                                            aria-label={isEntityExpanded ? "Thu gọn" : "Mở rộng"}
                                                        >
                                                            {isEntityExpanded ? (
                                                                <ChevronDown className="h-3.5 w-3.5" />
                                                            ) : (
                                                                <ChevronRight className="h-3.5 w-3.5" />
                                                            )}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleEntityExpand(entityKey)}
                                                            className="flex flex-1 cursor-pointer items-center gap-2 text-left text-xs font-semibold text-[#191c1e]"
                                                        >
                                                            {entityGroup.entity}
                                                            <span className="font-normal text-[#8a8f94]">
                                                                ({entityGrantedCount}/{entityGroup.permissions.length})
                                                            </span>
                                                        </button>
                                                    </div>
                                                    {isEntityExpanded && (
                                                    <div className="space-y-1.5 pl-6">
                                                        {entityGroup.permissions.map((permission) => {
                                                            const choice = choices.get(permission.id) ?? "inherit";
                                                            const roleHasAccess = roleBaselineIds.has(permission.id);
                                                            const isAutoGranted = autoGrantedIds.has(permission.id);
                                                            // Chưa bị override tay thì hiệu lực = Role HOẶC Chức vụ tự cấp — bấm
                                                            // "Thu hồi"/"Cấp thêm" sẽ tạo override tay, lúc đó "chiếm" hẳn dòng này
                                                            // (xem PermissionService.UpdateUserPermissionOverridesAsync).
                                                            const effectiveHasAccess =
                                                                choice === "grant" ? true : choice === "deny" ? false : roleHasAccess || isAutoGranted;

                                                            return (
                                                                <div
                                                                    key={permission.id}
                                                                    className="flex flex-col gap-1.5 border border-transparent py-1 sm:flex-row sm:items-center sm:justify-between"
                                                                    title={permission.description}
                                                                >
                                                                    <div className="flex items-center gap-2 text-sm">
                                                                        <span
                                                                            className={`h-2 w-2 flex-shrink-0 rounded-full ${
                                                                                effectiveHasAccess ? "bg-emerald-500" : "bg-[#e0e3e5]"
                                                                            }`}
                                                                        />
                                                                        <span className="text-[#191c1e]">{permission.description}</span>
                                                                        <span className="text-xs text-[#5e3f3a]">
                                                                            ({roleHasAccess ? "có theo Role" : "không có theo Role"})
                                                                        </span>
                                                                        {isAutoGranted && choice === "inherit" && (
                                                                            <span
                                                                                title="Đang được tự động cấp theo Chức vụ hiện tại của người này (Attendance) — đổi/gỡ Chức vụ sẽ tự thu hồi. Bấm Thu hồi/Cấp thêm bên phải để ghi đè tay."
                                                                                className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700"
                                                                            >
                                                                                Tự động (Chức vụ)
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex flex-shrink-0 overflow-hidden rounded-full border border-[#e0e3e5] text-xs">
                                                                        {(
                                                                            [
                                                                                ["deny", "Thu hồi"],
                                                                                ["inherit", "Theo Role"],
                                                                                ["grant", "Cấp thêm"],
                                                                            ] as [OverrideChoice, string][]
                                                                        ).map(([value, label], index) => (
                                                                            <button
                                                                                key={value}
                                                                                type="button"
                                                                                disabled={!canEditSelectedUser}
                                                                                onClick={() => setChoice(permission.id, value)}
                                                                                className={`cursor-pointer px-2.5 py-1 font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                                                                    index > 0 ? "border-l border-[#e0e3e5]" : ""
                                                                                } ${
                                                                                    choice === value
                                                                                        ? value === "deny"
                                                                                            ? "bg-[#fff4f2] text-[#930006]"
                                                                                            : value === "grant"
                                                                                              ? "bg-emerald-50 text-emerald-600"
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
                                                    )}
                                                </div>
                                                );
                                            })}
                                        </div>
                                        )}
                                    </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                </div>
            )}
        </div>
    );
}
