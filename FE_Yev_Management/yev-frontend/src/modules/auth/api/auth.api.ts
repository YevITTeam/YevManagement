import { api } from "@/lib/client";
import type { UserDto } from "@/modules/auth/types/auth.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
  AUTH: {
    windowsLogin: "/Auth/windows-login",
    getAllUsersWithRoles: "/Auth/get-all-users-with-roles",
    updateUserRoles: "/Auth/update-user-roles",
    getAllRoles: "/Auth/get-all-roles",
    createRole: "/Auth/create-role",
    updateRole: (roleId: number) => `/Auth/update-role/${roleId}`,
    deleteRole: (roleId: number) => `/Auth/delete-role/${roleId}`,
  }
} as const;

export const AuthApi = {
  windowsLogin: async () => {
    // Ép kiểu cho toàn bộ cấu trúc trả về
    const response = await api.post<ApiResponse<any>>(ENDPOINTS.AUTH.windowsLogin);
    return response.data?.user as UserDto;
  },

  getAllUsersWithRoles: async () => {
    const response = await api.get<ApiResponse<UserDto[]>>(ENDPOINTS.AUTH.getAllUsersWithRoles);
    return response.data;
  },
  updateUserRoles: async ({ userId, roleIds }: { userId: number; roleIds: number[] }) => {
    const response = await api.post<ApiResponse<any>>(ENDPOINTS.AUTH.updateUserRoles, { userId, roleIds });
    return response.data;
  },

  getAllRoles: async () => {
    const response = await api.get<ApiResponse<any[]>>(ENDPOINTS.AUTH.getAllRoles);
    return response.data;
  },

  createRole: async (roleName: string, description?: string) => {
    const response = await api.post<ApiResponse<any>>(ENDPOINTS.AUTH.createRole, { roleName, description });
    return response.data;
  },

  updateRole: async (roleId: number, roleName: string, description?: string) => {
    const response = await api.put<ApiResponse<any>>(ENDPOINTS.AUTH.updateRole(roleId), { roleName, description });
    return response.data;
  },

  deleteRole: async (roleId: number) => {
    const response = await api.delete<ApiResponse<any>>(ENDPOINTS.AUTH.deleteRole(roleId));
    return response.data;
  },
};

export { ENDPOINTS };