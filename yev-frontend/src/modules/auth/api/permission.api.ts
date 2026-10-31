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
    // Grouped Module > Entity for the tree UI.
    getAll: async () => {
        const response = await api.get<ApiResponse<PermissionModuleGroupDto[]>>(ENDPOINTS.PERMISSION.getAll);
        return response.data;
    },
    getByRole: async (roleId: number) => {
        const response = await api.get<ApiResponse<PermissionDto[]>>(ENDPOINTS.PERMISSION.getByRole(roleId));
        return response.data;
    },
    // body is the final Id list; omitting an existing Id revokes it.
    updateRolePermissions: async (roleId: number, permissionIds: number[]) => {
        const response = await api.put<ApiResponse<null>>(ENDPOINTS.PERMISSION.updateRolePermissions(roleId), permissionIds);
        return response.data;
    },

    // Per-user grant/deny overrides on top of role permissions.
    getUserOverrides: async (userId: number) => {
        const response = await api.get<ApiResponse<UserPermissionOverrideDto[]>>(ENDPOINTS.PERMISSION.getUserOverrides(userId));
        return response.data;
    },
    // Effective permissions after overrides, same shape as GET /all.
    getUserEffective: async (userId: number) => {
        const response = await api.get<ApiResponse<PermissionDto[]>>(ENDPOINTS.PERMISSION.getUserEffective(userId));
        return response.data;
    },
    // body replaces all existing overrides.
    updateUserOverrides: async (userId: number, overrides: UpdateUserPermissionOverridesDto) => {
        const response = await api.put<ApiResponse<null>>(ENDPOINTS.PERMISSION.updateUserOverrides(userId), overrides);
        return response.data;
    },
};

export { ENDPOINTS as PERMISSION_ENDPOINTS };
