import { api, AUTH_TOKEN_KEY, CURRENT_USER_KEY } from "@/lib/client";
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

  // Lấy user hiện tại: nếu ĐÃ có token + cache thì trả về cache luôn (KHÔNG gọi windows-login → không bật popup đăng nhập Windows).
  // Chỉ gọi windows-login khi CHƯA có token (lần đầu vào, hoặc token đã bị xoá). Dùng forceRefresh để buộc lấy lại từ server.
  getCurrentUser: async ({ forceRefresh = false }: { forceRefresh?: boolean } = {}): Promise<UserDto | null> => {
    if (typeof window === "undefined") return null;

    const hasToken = Boolean(window.localStorage.getItem(AUTH_TOKEN_KEY));
    const cachedRaw = window.localStorage.getItem(CURRENT_USER_KEY);

    if (!forceRefresh && hasToken && cachedRaw) {
      try {
        return JSON.parse(cachedRaw) as UserDto;
      } catch {
        window.localStorage.removeItem(CURRENT_USER_KEY);
      }
    }

    // Token được client.ts tự trích xuất & lưu từ response windows-login.
    const user = await AuthApi.windowsLogin();
    if (user) {
      window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    } else {
      window.localStorage.removeItem(CURRENT_USER_KEY);
    }
    return user;
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