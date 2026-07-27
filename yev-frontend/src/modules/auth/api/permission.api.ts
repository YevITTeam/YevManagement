import { api } from "@/lib/client";
import type {
    PermissionDto,
    PermissionModuleGroupDto,
    UpdateUserPermissionOverridesDto,
    UserPermissionOverrideDto,
} from "@/modules/auth/types/permission.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
    PERMISSION: {
        getAll: "/Permission/all",
        getByRole: (roleId: number) => `/Permission/role/${roleId}`,
        updateRolePermissions: (roleId: number) => `/Permission/role/${roleId}`,
        getUserOverrides: (userId: number) => `/Permission/user/${userId}`,
        getUserEffective: (userId: number) => `/Permission/user/${userId}/effective`,
        updateUserOverrides: (userId: number) => `/Permission/user/${userId}`,
    }
} as const;

export const PermissionApi = {
    // Nhóm 2 cấp Module > Entity (docs/identity-api-fe.md §4.7, đổi 2026-07-11) — dùng để dựng UI dạng cây.
    getAll: async () => {
        const response = await api.get<ApiResponse<PermissionModuleGroupDto[]>>(ENDPOINTS.PERMISSION.getAll);
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

    // Override (grant/deny) riêng đang áp dụng cho 1 user, đè lên permission suy ra từ Role — docs/identity-api-fe.md §4.8.
    getUserOverrides: async (userId: number) => {
        const response = await api.get<ApiResponse<UserPermissionOverrideDto[]>>(ENDPOINTS.PERMISSION.getUserOverrides(userId));
        return response.data;
    },
    // Permission hiệu lực cuối cùng của user (đã cộng/trừ override) — dùng để preview/audit, cùng shape GET /all.
    getUserEffective: async (userId: number) => {
        const response = await api.get<ApiResponse<PermissionDto[]>>(ENDPOINTS.PERMISSION.getUserEffective(userId));
        return response.data;
    },
    // body là TOÀN BỘ override sau cùng (thay thế hết override cũ, giống cơ chế PUT /role/{roleId}).
    updateUserOverrides: async (userId: number, overrides: UpdateUserPermissionOverridesDto) => {
        const response = await api.put<ApiResponse<null>>(ENDPOINTS.PERMISSION.updateUserOverrides(userId), overrides);
        return response.data;
    },
};

export { ENDPOINTS as PERMISSION_ENDPOINTS };
