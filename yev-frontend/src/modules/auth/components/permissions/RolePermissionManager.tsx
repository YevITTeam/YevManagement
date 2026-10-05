"use client";

import { useMemo, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "react-toastify";
import { AuthApi } from "@/modules/auth/api/auth.api";
import { PermissionApi } from "@/modules/auth/api/permission.api";
import type { RoleDto } from "@/modules/auth/types/auth.dto";
import type { PermissionDto, PermissionModuleGroupDto } from "@/modules/auth/types/permission.dto";
import { getApiErrorMessage } from "@/lib/apiError";
import { useFetchEffect } from "@/modules/common/hooks/useFetchEffect";
import PermissionTree from "./PermissionTree";

export default function RolePermissionManager() {
    const [roles, setRoles] = useState<RoleDto[]>([]);
    // Nhóm 2 cấp Module > Entity trả thẳng từ GET /api/Permission/all (docs/identity-api-fe.md §4.7, 2026-07-11).
    const [moduleGroups, setModuleGroups] = useState<PermissionModuleGroupDto[]>([]);
    const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
    const [selectedPermissionIds, setSelectedPermissionIds] = useState<Set<number>>(new Set());
    // Quyền đã lưu của vai trò đang chọn — để biết có thay đổi chưa lưu hay không.
    const [savedPermissionIds, setSavedPermissionIds] = useState<Set<number>>(new Set());

    const [isSaving, setIsSaving] = useState(false);

    const { isLoading: isLoadingBase } = useFetchEffect(
        () => Promise.all([AuthApi.getAllRoles(), PermissionApi.getAll()]),
        [],
        ([rolesData, permissionsData]) => {
            setRoles(rolesData);
            setModuleGroups(permissionsData);
            if (rolesData.length > 0) setSelectedRoleId(rolesData[0].id);
        },
        "Không thể tải danh sách vai trò / quyền.",
        undefined,
        "role-permission-base"
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

    const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? null;
    const totalPermissionCount = useMemo(
        () => moduleGroups.reduce((sum, m) => sum + m.entities.reduce((n, e) => n + e.permissions.length, 0), 0),
        [moduleGroups]
    );
    const isDirty =
        selectedPermissionIds.size !== savedPermissionIds.size ||
        Array.from(selectedPermissionIds).some((id) => !savedPermissionIds.has(id));

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-[#191c1e]">Phân quyền theo vai trò</h1>
                    <p className="mt-1 text-[15px] text-[#5e3f3a]">
                        Chọn 1 vai trò, tick các quyền muốn cấp rồi bấm Lưu.
                    </p>
                </div>
            </div>

            {isLoadingBase ? (
                <div className="flex min-h-40 items-center justify-center border border-[#e0e3e5] bg-white text-sm text-[#5e3f3a]">
                    Đang tải dữ liệu...
                </div>
            ) : roles.length === 0 ? (
                <div className="flex min-h-40 items-center justify-center border border-[#e0e3e5] bg-white text-sm text-[#5e3f3a]">
                    Chưa có vai trò nào — tạo vai trò ở mục &quot;Quản lý Roles&quot; trước.
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-[240px_1fr]">
                    <section className="h-fit overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                        <div className="border-b border-[#e0e3e5] bg-[#f8fafc] px-4 py-3 text-sm font-semibold text-[#191c1e]">
                            Vai trò <span className="font-normal text-[#8a8f94]">({roles.length})</span>
                        </div>
                        <div className="p-2">
                            {roles.map((role) => (
                                <button
                                    key={role.id}
                                    type="button"
                                    onClick={() => setSelectedRoleId(role.id)}
                                    className={`block w-full cursor-pointer rounded-lg px-3 py-2.5 text-left text-sm transition ${
                                        role.id === selectedRoleId
                                            ? "bg-[#fff4f2] font-semibold text-[#e3000f]"
                                            : "text-[#191c1e] hover:bg-[#f8fafc]"
                                    }`}
                                >
                                    {role.roleName}
                                </button>
                            ))}
                        </div>
                    </section>

                    <section className="overflow-hidden rounded-xl border border-[#e0e3e5] bg-white shadow-sm">
                        <div className="flex items-center justify-between gap-3 border-b border-[#e0e3e5] bg-[#f8fafc] px-4 py-3">
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

                        {isLoadingRolePermissions ? (
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
        </div>
    );
}
