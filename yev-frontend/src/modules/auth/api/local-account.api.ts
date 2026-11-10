import { api } from "@/lib/client";
import type { UserDto } from "@/modules/auth/types/auth.dto";
import type { CreateLocalAccountDto, LocalAccountPrefixDto } from "@/modules/auth/types/local-account.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
  base: "/LocalAccount",
  prefixes: "/LocalAccount/prefixes",
  prefix: (id: number) => `/LocalAccount/prefixes/${id}`,
  password: (userId: number) => `/LocalAccount/${userId}/password`,
  changeOwnPassword: "/Auth/change-password",
} as const;

export const LocalAccountApi = {
  getPrefixes: async () => {
    const response = await api.get<ApiResponse<LocalAccountPrefixDto[]>>(ENDPOINTS.prefixes);
    return response.data;
  },

  createPrefix: async (prefix: string) => {
    const response = await api.post<ApiResponse<LocalAccountPrefixDto>>(ENDPOINTS.prefixes, { prefix });
    return response.data;
  },

  deletePrefix: async (id: number) => {
    const response = await api.delete<ApiResponse<boolean>>(ENDPOINTS.prefix(id));
    return response.data;
  },

  create: async (data: CreateLocalAccountDto) => {
    const response = await api.post<ApiResponse<UserDto>>(ENDPOINTS.base, data);
    return response.data;
  },

  resetPassword: async (userId: number, newPassword: string) => {
    const response = await api.put<ApiResponse<boolean>>(ENDPOINTS.password(userId), { newPassword });
    return response.data;
  },

  changeOwnPassword: async (currentPassword: string, newPassword: string) => {
    const response = await api.post<ApiResponse<boolean>>(ENDPOINTS.changeOwnPassword, { currentPassword, newPassword });
    return response.data;
  },
};
