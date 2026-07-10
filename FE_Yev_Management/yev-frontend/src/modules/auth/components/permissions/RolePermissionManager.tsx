"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "react-toastify";
import { AuthApi } from "@/modules/auth/api/auth.api";
import { PermissionApi } from "@/modules/auth/api/permission.api";
import type { RoleDto } from "@/modules/auth/types/auth.dto";
import type { PermissionDto } from "@/modules/auth/types/permission.dto";
import { getApiErrorMessage } from "@/lib/apiError";

export default function RolePermissionManager() {
    const [roles, setRoles] = useState<RoleDto[]>([]);
    const [allPermissions, setAllPermissions] = useState<PermissionDto[]>([]);
    const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
    const [selectedPermissionIds, setSelectedPermissionIds] = useState<Set<number>>(new Set());

    const [isLoadingBase, setIsLoadingBase] = useState(true);
    const [isLoadingRolePermissions, setIsLoadingRolePermissions] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const loadBase = async () => {
            setIsLoadingBase(true);
            try {
                const [rolesData, permissionsData] = await Promise.all([
                    AuthApi.getAllRoles(),
                    PermissionApi.getAll(),
                ]);
                setRoles(rolesData);
                setAllPermissions(permissionsData);
                if (rolesData.length > 0) setSelectedRoleId(rolesData[0].id);
            } catch (err) {
                toast.error(getApiErrorMessage(err, "Không thể tải danh sách vai trò / quyền."));
            } finally {
                setIsLoadingBase(false);
            }
        };
        loadBase();
    }, []);

    const loadRolePermissions = useCallback(async (roleId: number) => {
        setIsLoadingRolePermissions(true);
        try {
            const rolePermissions = await PermissionApi.getByRole(roleId);
            setSelectedPermissionIds(new Set(rolePermissions.map((p) => p.id)));
        } catch (err) {
            toast.error(getApiErrorMessage(err, "Không thể tải quyền của vai trò này."));
        } finally {
            setIsLoadingRolePermissions(false);
        }
    }, []);

    useEffect(() => {
        if (selectedRoleId === null) return;
        loadRolePermissions(selectedRoleId);
    }, [selectedRoleId, loadRolePermissions]);

    const permissionsByModule = useMemo(() => {
        const groups = new Map<string, PermissionDto[]>();
        for (const permission of allPermissions) {
            const list = groups.get(permission.module) ?? [];
            list.push(permission);
            groups.set(permission.module, list);
        }
        return Array.from(groups.entries());
    }, [allPermissions]);

    const togglePermission = (permissionId: number, checked: boolean) => {
        setSelectedPermissionIds((prev) => {
            const next = new Set(prev);
            if (checked) next.add(permissionId);
            else next.delete(permissionId);
            return next;
        });
    };

    const toggleModule = (modulePermissions: PermissionDto[], checked: boolean) => {
        setSelectedPermissionIds((prev) => {
            const next = new Set(prev);
            for (const permission of modulePermissions) {
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
            toast.success("Cập nhật phân quyền thành công!");
        } catch (err) {
            toast.error(getApiErrorMessage(err, "Cập nhật phân quyền thất bại"));
        } finally {
            setIsSaving(false);
        }
    };

    const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? null;

    return (
        <div className="space-y-8">
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
                    Chưa có vai trò nào — tạo vai trò ở mục "Quản lý Roles" trước.
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-[240px_1fr]">
                    <section className="h-fit overflow-hidden border border-[#e0e3e5] bg-white">
                        <div className="border-b border-[#e0e3e5] bg-[#f8fafc] px-4 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                            Vai trò
                        </div>
                        <div className="divide-y divide-[#f1f5f9]">
                            {roles.map((role) => (
                                <button
                                    key={role.id}
                                    type="button"
                                    onClick={() => setSelectedRoleId(role.id)}
                                    className={`block w-full cursor-pointer px-4 py-3 text-left text-sm transition ${
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

                    <section className="overflow-hidden border border-[#e0e3e5] bg-white">
                        <div className="flex items-center justify-between border-b border-[#e0e3e5] bg-[#f8fafc] px-4 py-3">
                            <div className="text-sm font-semibold text-[#191c1e]">
                                {selectedRole ? `Quyền của "${selectedRole.roleName}"` : "Chọn 1 vai trò"}
                            </div>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={isSaving || isLoadingRolePermissions || selectedRoleId === null}
                                className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#e3000f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b40009] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Save className="h-4 w-4" />
                                {isSaving ? "Đang lưu..." : "Lưu"}
                            </button>
                        </div>

                        {isLoadingRolePermissions ? (
                            <div className="px-4 py-10 text-center text-sm text-[#5e3f3a]">Đang tải quyền...</div>
                        ) : (
                            <div className="max-h-[60vh] divide-y divide-[#f1f5f9] overflow-y-auto">
                                {permissionsByModule.map(([moduleName, modulePermissions]) => {
                                    const allChecked = modulePermissions.every((p) => selectedPermissionIds.has(p.id));
                                    const someChecked = !allChecked && modulePermissions.some((p) => selectedPermissionIds.has(p.id));
                                    return (
                                        <div key={moduleName} className="px-4 py-3">
                                            <label className="mb-2 flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#5e3f3a]">
                                                <input
                                                    type="checkbox"
                                                    checked={allChecked}
                                                    ref={(el) => {
                                                        if (el) el.indeterminate = someChecked;
                                                    }}
                                                    onChange={(event) => toggleModule(modulePermissions, event.target.checked)}
                                                    className="h-4 w-4 cursor-pointer accent-[#e3000f]"
                                                />
                                                {moduleName}
                                            </label>
                                            <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 pl-6 sm:grid-cols-2 lg:grid-cols-3">
                                                {modulePermissions.map((permission) => (
                                                    <label
                                                        key={permission.id}
                                                        className="flex cursor-pointer items-start gap-2 py-0.5 text-sm text-[#191c1e]"
                                                        title={permission.description}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedPermissionIds.has(permission.id)}
                                                            onChange={(event) => togglePermission(permission.id, event.target.checked)}
                                                            className="mt-0.5 h-4 w-4 cursor-pointer accent-[#e3000f]"
                                                        />
                                                        <span>
                                                            <span className="block text-[#5e3f3a]">{permission.description}</span>
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
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
