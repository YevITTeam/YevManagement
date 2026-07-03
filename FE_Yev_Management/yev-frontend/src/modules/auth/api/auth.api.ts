import { api } from "@/lib/client";
import type { UserDto } from "@/modules/auth/types/auth.dto";

const ENDPOINTS = {
  AUTH: {
    ME: "/auth/me",
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
  getMe: () => api.get<UserDto>(ENDPOINTS.AUTH.ME),
};

export { ENDPOINTS };