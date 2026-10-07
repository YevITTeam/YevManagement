"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CircleHelp, Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";
import { toast } from "react-toastify";
import { AuthApi } from "@/modules/auth/api/auth.api";
import { PermissionApi } from "@/modules/auth/api/permission.api";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { hasPermission } from "@/modules/auth/lib/permissions";
import type { CreateRoleDto, RoleDto } from "@/modules/auth/types/auth.dto";
import type { PermissionDto, PermissionModuleGroupDto } from "@/modules/auth/types/permission.dto";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import PermissionTree from "./PermissionTree";
import RoleForm from "../roles/RoleForm";

// Roles per page in the left list; search and pager appear only when there are more roles than this.
const ROLE_PAGE_SIZE = 8;

// Accent-free, lower-case form used for matching role names / descriptions.
function normalizeText(value: string) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .toLowerCase();
}

type RoleDialogState = { mode: "create" } | { mode: "edit"; role: RoleDto } | null;

const roleActionClassName =
    "flex size-7 cursor-pointer items-center justify-center rounded-md text-[#5e3f3a] transition hover:bg-[#e6e9ec] hover:text-[#191c1e]";

// Roles and their permissions share one screen: the left list creates / renames / deletes roles,
// the right tree edits the permissions of the selected role.
export default function RolePermissionManager() {
    const { user } = useAuth();
    const canCreateRole = hasPermission(user, "Identity.Role.Create");
    const canUpdateRole = hasPermission(user, "Identity.Role.Update");
    const canDeleteRole = hasPermission(user, "Identity.Role.Delete");

    const [roles, setRoles] = useState<RoleDto[]>([]);
    // Nhóm 2 cấp Module > Entity trả thẳng từ GET /api/Permission/all (docs/identity-module.md §6).
    const [moduleGroups, setModuleGroups] = useState<PermissionModuleGroupDto[]>([]);
    const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
    const [selectedPermissionIds, setSelectedPermissionIds] = useState<Set<number>>(new Set());
    // Quyền đã lưu của vai trò đang chọn — để biết có thay đổi chưa lưu hay không.
    const [savedPermissionIds, setSavedPermissionIds] = useState<Set<number>>(new Set());

    const [isSaving, setIsSaving] = useState(false);
    const [roleDialog, setRoleDialog] = useState<RoleDialogState>(null);
    const [deletingRole, setDeletingRole] = useState<RoleDto | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [roleSearch, setRoleSearch] = useState("");
    const [rolePage, setRolePage] = useState(1);
    // A just-created role to bring into view once it shows up in the refreshed list.
    const [pendingRevealId, setPendingRevealId] = useState<number | null>(null);

    const { isLoading: isLoadingRoles, refetch: refetchRoles } = useFetchEffect(
        () => AuthApi.getAllRoles(),
        [],
        (rolesData) => {
            setRoles(rolesData);
            // Keep the current selection while it still exists; otherwise fall back to the first role.
            setSelectedRoleId((current) =>
                rolesData.some((role) => role.id === current) ? current : (rolesData[0]?.id ?? null)
            );
        },
        "Không thể tải danh sách vai trò.",
        (message) => toast.error(message),
        "roles"
    );

    const { isLoading: isLoadingPermissions } = useFetchEffect(
        () => PermissionApi.getAll(),
        [],
        (permissionsData) => setModuleGroups(permissionsData),
        "Không thể tải danh sách quyền.",
        (message) => toast.error(message),
        "permission-groups"
    );

    const { isLoading: isLoadingRolePermissions } = useFetchEffect(
        () => (selectedRoleId === null ? Promise.resolve([]) : PermissionApi.getByRole(selectedRoleId)),
        [selectedRoleId],
        (rolePermissions) => {
            const ids = new Set(rolePermissions.map((p) => p.id));
            setSelectedPermissionIds(ids);
            setSavedPermissionIds(ids);
        },
        "Không thể tải quyền của vai trò này.",
        undefined,
        "role-permissions-by-role"
    );

    const togglePermissionGroup = (permissions: PermissionDto[], checked: boolean) => {
        setSelectedPermissionIds((prev) => {
            const next = new Set(prev);
            for (const permission of permissions) {
                if (checked) next.add(permission.id);
                else next.delete(permission.id);
            }
            return next;
        });
    };

    const handleSave = async () => {
        if (selectedRoleId === null) return;
        setIsSaving(true);
        try {
            await PermissionApi.updateRolePermissions(selectedRoleId, Array.from(selectedPermissionIds));
            setSavedPermissionIds(new Set(selectedPermissionIds));
            toast.success("Cập nhật phân quyền thành công!");
        } catch (err) {
            toast.error(getApiErrorMessage(err, "Cập nhật phân quyền thất bại"));
        } finally {
            setIsSaving(false);
        }
    };

    const handleCreateRole = async (data: CreateRoleDto) => {
        try {
            const created = await AuthApi.createRole(data.roleName, data.description);
            toast.success("Tạo vai trò thành công");
            setRoleDialog(null);
            await refetchRoles();
            if (created) {
                setSelectedRoleId(created.id);
                setRoleSearch("");
                setPendingRevealId(created.id);
            }
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, "Tên vai trò đã tồn tại hoặc không hợp lệ."));
        }
    };

    const handleUpdateRole = async (data: CreateRoleDto, id?: number) => {
        if (!id) return;
        try {
            await AuthApi.updateRole(id, data.roleName, data.description);
            toast.success("Cập nhật vai trò thành công");
            setRoleDialog(null);
            await refetchRoles();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, "Cập nhật vai trò thất bại"));
        }
    };

    const handleDeleteRole = async () => {
        if (!deletingRole) return;
        setIsDeleting(true);
        try {
            await AuthApi.deleteRole(deletingRole.id);
            toast.success("Xoá vai trò thành công");
            setDeletingRole(null);
            await refetchRoles();
        } catch (err) {
            console.error(err);
            toast.error(getApiErrorMessage(err, "Xoá vai trò thất bại"));
        } finally {
            setIsDeleting(false);
        }
    };

    const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? null;
    const totalPermissionCount = useMemo(
        () => moduleGroups.reduce((sum, m) => sum + m.entities.reduce((n, e) => n + e.permissions.length, 0), 0),
        [moduleGroups]
    );
    const isDirty =
        selectedPermissionIds.size !== savedPermissionIds.size ||
        Array.from(selectedPermissionIds).some((id) => !savedPermissionIds.has(id));

    const showRoleTools = roles.length > ROLE_PAGE_SIZE;
    const roleKeyword = showRoleTools ? normalizeText(roleSearch.trim()) : "";
    const filteredRoles = roleKeyword
        ? roles.filter((role) => normalizeText(`${role.roleName} ${role.description ?? ""}`).includes(roleKeyword))
        : roles;
    const roleTotalPages = Math.max(1, Math.ceil(filteredRoles.length / ROLE_PAGE_SIZE));
    const currentRolePage = Math.min(rolePage, roleTotalPages);
    const pagedRoles = filteredRoles.slice((currentRolePage - 1) * ROLE_PAGE_SIZE, currentRolePage * ROLE_PAGE_SIZE);

    // Back to page 1 when the search text changes (snapshot compared during render, frontend-conventions.md §3).
    const [prevRoleSearch, setPrevRoleSearch] = useState(roleSearch);
    if (prevRoleSearch !== roleSearch) {
        setPrevRoleSearch(roleSearch);
        setRolePage(1);
    }
    if (pendingRevealId !== null) {
        const index = filteredRoles.findIndex((role) => role.id === pendingRevealId);
        if (index >= 0) {
            setPendingRevealId(null);
            setRolePage(Math.floor(index / ROLE_PAGE_SIZE) + 1);
        }
    }

    const isLoadingBase = (isLoadingRoles && roles.length === 0) || isLoadingPermissions;
    const closeRoleDialog = () => setRoleDialog(null);

    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-semibold text-[#191c1e]">Phân quyền theo vai trò</h1>

            {isLoadingBase ? (
                <div className="flex min-h-40 items-center justify-center rounded-xl border border-[#e0e3e5] bg-white text-sm text-[#5e3f3a]">
                    Đang tải dữ liệu...
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-[280px_1fr]">
                    <section className="h-fit rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                        <div className="flex items-center justify-between gap-2 rounded-t-xl border-b border-[#e0e3e5] bg-[#f8fafc] px-4 py-2.5">
                            <span className="text-sm font-semibold text-[#191c1e]">
                                Vai trò <span className="font-normal text-[#8a8f94]">({roles.length})</span>
                            </span>
                            {canCreateRole && (
                                <button
                                    type="button"
                                    onClick={() => setRoleDialog({ mode: "create" })}
                                    className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#e3000f] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#b40009]"
                                >
                                    <Plus className="h-3.5 w-3.5" /> Thêm
                                </button>
                            )}
                        </div>

                        {showRoleTools && (
                            <div className="relative border-b border-[#e0e3e5] p-2">
                                <Search className="pointer-events-none absolute left-5 top-1/2 size-4 -translate-y-1/2 text-[#8a8f94]" />
                                <input
                                    type="text"
                                    value={roleSearch}
                                    onChange={(event) => setRoleSearch(event.target.value)}
                                    placeholder="Tìm vai trò"
                                    aria-label="Tìm vai trò"
                                    className="h-8 w-full rounded-lg border border-[#e0e3e5] bg-white pl-9 pr-8 text-sm text-[#191c1e] outline-none transition focus:border-[#e3000f] focus:ring-2 focus:ring-[#ffe0e3]"
                                />
                                {roleSearch && (
                                    <button
                                        type="button"
                                        onClick={() => setRoleSearch("")}
                                        aria-label="Xoá tìm kiếm"
                                        className="absolute right-3.5 top-1/2 flex size-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-[#5e3f3a] transition hover:bg-[#eceef0] hover:text-[#191c1e]"
                                    >
                                        <X className="size-3.5" />
                                    </button>
                                )}
                            </div>
                        )}

                        {roles.length === 0 ? (
                            <p className="px-4 py-8 text-center text-sm text-[#5e3f3a]">Chưa có vai trò nào.</p>
                        ) : filteredRoles.length === 0 ? (
                            <p className="px-4 py-8 text-center text-sm text-[#5e3f3a]">Không có vai trò phù hợp.</p>
                        ) : (
                            <div className="p-2">
                                {pagedRoles.map((role) => {
                                    const isSelected = role.id === selectedRoleId;
                                    return (
                                        <div
                                            key={role.id}
                                            className={`group relative flex items-center gap-1 rounded-lg pr-1 transition ${
                                                isSelected ? "bg-[#fff4f2]" : "hover:bg-[#f8fafc]"
                                            }`}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => setSelectedRoleId(role.id)}
                                                aria-current={isSelected ? "true" : undefined}
                                                className={`min-w-0 flex-1 cursor-pointer truncate px-3 py-2 text-left text-sm ${
                                                    isSelected ? "font-semibold text-[#e3000f]" : "text-[#191c1e]"
                                                }`}
                                            >
                                                {role.roleName}
                                            </button>
                                            {role.description && (
                                                <span className="group/info inline-flex shrink-0">
                                                    <button
                                                        type="button"
                                                        aria-label={`Mô tả vai trò ${role.roleName}`}
                                                        className="flex size-6 cursor-help items-center justify-center rounded-full text-[#8a8f94] transition hover:text-[#191c1e] focus-visible:text-[#191c1e]"
                                                    >
                                                        <CircleHelp className="size-3.5" />
                                                    </button>
                                                    <span
                                                        role="tooltip"
                                                        className="pointer-events-none absolute left-full top-1/2 z-30 ml-3 w-72 -translate-y-1/2 rounded-lg bg-[#191c1e] px-4 py-3 text-left opacity-0 shadow-lg transition-opacity duration-150 group-focus-within/info:opacity-100 group-hover/info:opacity-100"
                                                    >
                                                        <span className="block text-sm font-semibold text-white">{role.roleName}</span>
                                                        <span className="mt-2 block text-xs font-semibold text-[#c9cdd1]">Mô tả</span>
                                                        <span className="block whitespace-pre-line text-sm leading-relaxed text-white">
                                                            {role.description}
                                                        </span>
                                                    </span>
                                                </span>
                                            )}
                                            {(canUpdateRole || canDeleteRole) && (
                                                <div className="flex shrink-0 items-center opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                                                    {canUpdateRole && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setRoleDialog({ mode: "edit", role })}
                                                            title="Sửa"
                                                            aria-label="Sửa"
                                                            className={roleActionClassName}
                                                        >
                                                            <Pencil className="size-3.5" />
                                                        </button>
                                                    )}
                                                    {canDeleteRole && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setDeletingRole(role)}
                                                            title="Xoá"
                                                            aria-label="Xoá"
                                                            className="flex size-7 cursor-pointer items-center justify-center rounded-md text-[#930006] transition hover:bg-[#fff4f2]"
                                                        >
                                                            <Trash2 className="size-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {showRoleTools && roleTotalPages > 1 && (
                            <div className="flex items-center justify-between gap-2 rounded-b-xl border-t border-[#e0e3e5] px-4 py-2">
                                <span className="text-xs tabular-nums text-[#5e3f3a]">
                                    {(currentRolePage - 1) * ROLE_PAGE_SIZE + 1}–{(currentRolePage - 1) * ROLE_PAGE_SIZE + pagedRoles.length} / {filteredRoles.length}
                                </span>
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setRolePage(currentRolePage - 1)}
                                        disabled={currentRolePage <= 1}
                                        aria-label="Trang trước"
                                        className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-[#5e3f3a] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                                    >
                                        <ChevronLeft className="size-4" />
                                    </button>
                                    <span className="px-1 text-sm font-medium tabular-nums text-[#191c1e]">
                                        {currentRolePage} / {roleTotalPages}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setRolePage(currentRolePage + 1)}
                                        disabled={currentRolePage >= roleTotalPages}
                                        aria-label="Trang sau"
                                        className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-[#5e3f3a] transition hover:bg-[#f2f4f6] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                                    >
                                        <ChevronRight className="size-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>

                    <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                        <div className="flex items-center justify-between gap-3 border-b border-[#e0e3e5] bg-[#f8fafc] px-4 py-2.5">
                            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                                <div className="text-sm font-semibold text-[#191c1e]">
                                    {selectedRole ? `Quyền của "${selectedRole.roleName}"` : "Chọn 1 vai trò"}
                                </div>
                                {selectedRole && !isLoadingRolePermissions && (
                                    <span className="text-xs tabular-nums text-[#5e3f3a]">
                                        Đã chọn {selectedPermissionIds.size}/{totalPermissionCount} quyền
                                    </span>
                                )}
                                {isDirty && (
                                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                                        Chưa lưu
                                    </span>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={isSaving || isLoadingRolePermissions || selectedRoleId === null || !isDirty}
                                className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Save className="h-4 w-4" />
                                {isSaving ? "Đang lưu..." : "Lưu"}
                            </button>
                        </div>

                        {selectedRole === null ? (
                            <div className="px-4 py-10 text-center text-sm text-[#5e3f3a]">Chưa chọn vai trò nào.</div>
                        ) : isLoadingRolePermissions ? (
                            <div className="px-4 py-10 text-center text-sm text-[#5e3f3a]">Đang tải quyền...</div>
                        ) : (
                            <PermissionTree
                                moduleGroups={moduleGroups}
                                isChecked={(id) => selectedPermissionIds.has(id)}
                                onToggle={togglePermissionGroup}
                            />
                        )}
                    </section>
                </div>
            )}

            {roleDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/40" onClick={closeRoleDialog} />
                    <div role="dialog" aria-modal="true" className="z-60 mx-4 w-full max-w-md rounded-xl border border-[#e0e3e5] bg-white p-6 shadow-xl">
                        <div className="mb-4 flex items-center justify-between border-b border-[#e0e3e5] pb-4">
                            <h3 className="text-lg font-semibold text-[#191c1e]">
                                {roleDialog.mode === "edit" ? "Cập nhật vai trò" : "Thêm vai trò"}
                            </h3>
                            <button
                                type="button"
                                onClick={closeRoleDialog}
                                className="cursor-pointer text-[#5e3f3a] transition hover:text-[#191c1e]"
                                aria-label="Đóng"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        {roleDialog.mode === "edit" ? (
                            <RoleForm
                                initial={{
                                    id: roleDialog.role.id,
                                    roleName: roleDialog.role.roleName,
                                    description: roleDialog.role.description,
                                }}
                                onCancel={closeRoleDialog}
                                onSubmit={handleUpdateRole}
                            />
                        ) : (
                            <RoleForm onCancel={closeRoleDialog} onSubmit={(data) => handleCreateRole(data)} />
                        )}
                    </div>
                </div>
            )}

            <ConfirmDialog
                isOpen={deletingRole !== null}
                title="Xoá vai trò"
                message={`Bạn có chắc muốn xoá vai trò "${deletingRole?.roleName ?? ""}" không?`}
                approveLabel="Xoá"
                deniedLabel="Huỷ"
                loading={isDeleting}
                onApprove={handleDeleteRole}
                onDenied={() => {
                    if (!isDeleting) setDeletingRole(null);
                }}
            />
        </div>
    );
}
