import { api } from "@/lib/client";
import type { PermissionDto } from "@/modules/auth/types/permission.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
    PERMISSION: {
        getAll: "/Permission/all",
        getByRole: (roleId: number) => `/Permission/role/${roleId}`,
        updateRolePermissions: (roleId: number) => `/Permission/role/${roleId}`,
    }
} as const;

export const PermissionApi = {
    getAll: async () => {
        const response = await api.get<ApiResponse<PermissionDto[]>>(ENDPOINTS.PERMISSION.getAll);
        return response.data;
    },
    getByRole: async (roleId: number) => {
        const response = await api.get<ApiResponse<PermissionDto[]>>(ENDPOINTS.PERMISSION.getByRole(roleId));
        return response.data;
    },
    // body là mảng Id permission sau cùng (giống cơ chế update-user-roles) — gửi thiếu 1 Id cũ nghĩa là gỡ quyền đó.
    updateRolePermissions: async (roleId: number, permissionIds: number[]) => {
        const response = await api.put<ApiResponse<null>>(ENDPOINTS.PERMISSION.updateRolePermissions(roleId), permissionIds);
        return response.data;
    },
};

export { ENDPOINTS as PERMISSION_ENDPOINTS };
