import { api } from "@/lib/client";
import type { LoginQrGeneratedDto, LoginQrLogDto, LoginQrStatusDto } from "@/modules/auth/types/auth.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
  LOGIN_QR: {
    list: "/LoginQr",
    byUser: (userId: number) => `/LoginQr/${userId}`,
    logs: (userId: number) => `/LoginQr/${userId}/logs`,
  },
} as const;

export const LoginQrApi = {
  // User đang có mã QR còn hiệu lực.
  getActive: async () => {
    const response = await api.get<ApiResponse<LoginQrStatusDto[]>>(ENDPOINTS.LOGIN_QR.list);
    return response.data;
  },

  // Tạo mã mới cho user và vô hiệu mã cũ (nếu có). Mã thô chỉ có trong response này.
  generate: async (userId: number) => {
    const response = await api.post<ApiResponse<LoginQrGeneratedDto>>(ENDPOINTS.LOGIN_QR.byUser(userId));
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
