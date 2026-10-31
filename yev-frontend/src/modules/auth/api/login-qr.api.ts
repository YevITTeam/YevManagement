import { api } from "@/lib/client";
import type { LoginQrGeneratedDto, LoginQrLogDto, LoginQrStatusDto } from "@/modules/auth/types/auth.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
  LOGIN_QR: {
    list: "/LoginQr",
    batch: "/LoginQr/batch",
    byUser: (userId: number) => `/LoginQr/${userId}`,
    logs: (userId: number) => `/LoginQr/${userId}/logs`,
  },
} as const;

export const LoginQrApi = {
  getActive: async () => {
    const response = await api.get<ApiResponse<LoginQrStatusDto[]>>(ENDPOINTS.LOGIN_QR.list);
    return response.data;
  },

  // Revokes the previous code; the raw code is only in this response.
  generate: async (userId: number) => {
    const response = await api.post<ApiResponse<LoginQrGeneratedDto>>(ENDPOINTS.LOGIN_QR.byUser(userId));
    return response.data;
  },

  // Bulk version for label printing; each user's old code is revoked.
  generateBatch: async (userIds: number[]) => {
    const response = await api.post<ApiResponse<LoginQrGeneratedDto[]>>(ENDPOINTS.LOGIN_QR.batch, { userIds });
    return response.data;
  },

  revoke: async (userId: number) => {
    const response = await api.delete<ApiResponse<boolean>>(ENDPOINTS.LOGIN_QR.byUser(userId));
    return response.data;
  },

  getLogs: async (userId: number) => {
    const response = await api.get<ApiResponse<LoginQrLogDto[]>>(ENDPOINTS.LOGIN_QR.logs(userId));
    return response.data;
  },
};

export { ENDPOINTS };
