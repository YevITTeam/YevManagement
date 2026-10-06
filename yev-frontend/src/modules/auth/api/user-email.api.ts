import { api } from "@/lib/client";
import type {
  CreateUserEmailDto,
  UpdateUserEmailModulesDto,
  UserEmailOverviewDto,
  UserEmailSuggestionDto,
} from "@/modules/auth/types/user-email.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
  USER_EMAIL: {
    byUser: (userId: number) => `/UserEmail/user/${userId}`,
    suggestions: (userId: number) => `/UserEmail/user/${userId}/suggestions`,
    item: (userId: number, userEmailId: number) => `/UserEmail/user/${userId}/${userEmailId}`,
    primary: (userId: number, userEmailId: number) => `/UserEmail/user/${userId}/${userEmailId}/primary`,
    modules: (userId: number) => `/UserEmail/user/${userId}/modules`,
  },
} as const;

// Mọi hàm ghi trả lại toàn bộ overview mới của user để dialog thay state 1 lần.
export const UserEmailApi = {
  getOverview: async (userId: number) => {
    const response = await api.get<ApiResponse<UserEmailOverviewDto>>(ENDPOINTS.USER_EMAIL.byUser(userId));
    return response.data;
  },

  // Email tìm thấy ngoài danh sách (mail + alias trên AD).
  getSuggestions: async (userId: number) => {
    const response = await api.get<ApiResponse<UserEmailSuggestionDto[]>>(ENDPOINTS.USER_EMAIL.suggestions(userId));
    return response.data;
  },

  add: async (userId: number, data: CreateUserEmailDto) => {
    const response = await api.post<ApiResponse<UserEmailOverviewDto>>(ENDPOINTS.USER_EMAIL.byUser(userId), data);
    return response.data;
  },

  remove: async (userId: number, userEmailId: number) => {
    const response = await api.delete<ApiResponse<UserEmailOverviewDto>>(ENDPOINTS.USER_EMAIL.item(userId, userEmailId));
    return response.data;
  },

  setPrimary: async (userId: number, userEmailId: number) => {
    const response = await api.put<ApiResponse<UserEmailOverviewDto>>(ENDPOINTS.USER_EMAIL.primary(userId, userEmailId));
    return response.data;
  },

  updateModules: async (userId: number, data: UpdateUserEmailModulesDto) => {
    const response = await api.put<ApiResponse<UserEmailOverviewDto>>(ENDPOINTS.USER_EMAIL.modules(userId), data);
    return response.data;
  },
};

export { ENDPOINTS };
