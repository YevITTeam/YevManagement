import { api } from "@/lib/client";
import type { UserDto } from "@/modules/auth/types/auth.dto";

const ENDPOINTS = {
  AUTH: {
    windowsLogin: "/Auth/windows-login",
  },
  ADMIN: {
    USERS: "/admin/users",
    ROLES: "/admin/roles",
    UPDATE_USER_ROLES: "/admin/users/roles",
    CREATE_ROLES: "/admin/roles",
    UPDATE_ROLES: (id: string) => `/admin/roles/${id}`,
    DELETE_ROLES: (id: string) => `/admin/roles/${id}`,
  },
} as const;

export const AuthApi = {
  windowsLogin: async () => {
    const response = await api.post<any>(ENDPOINTS.AUTH.windowsLogin);
    return response.data?.user as UserDto;
  },
};

export { ENDPOINTS };