import { api, getAuthToken, passwordLogin as requestPasswordLogin, windowsLogin as requestWindowsLogin } from "@/lib/client";
import type { UserDto, RoleDto, WindowsLoginResponseDto, LoginRequestDto, CreateUserDto, UpdateUserFullNameDto } from "@/modules/auth/types/auth.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
  AUTH: {
    windowsLogin: "/Auth/windows-login",
    login: "/Auth/login",
    me: "/Auth/me",
    createUser: "/Auth/create-user",
    getAllUsersWithRoles: "/Auth/get-all-users-with-roles",
    updateUserRoles: "/Auth/update-user-roles",
    updateUserFullName: "/Auth/update-user-fullname",
    getAllRoles: "/Auth/get-all-roles",
    createRole: "/Auth/create-role",
    updateRole: (roleId: number) => `/Auth/update-role/${roleId}`,
    deleteRole: (roleId: number) => `/Auth/delete-role/${roleId}`,
    deleteUser: (userId: number) => `/Auth/delete-user/${userId}`,
  }
} as const;

export const AuthApi = {
  // Goes through the single-flight requestWindowsLogin() so concurrent 401 retries share one Negotiate,
  // avoiding overlapping NTLM handshakes that cause repeated domain login popups.
  windowsLogin: async (): Promise<UserDto> => {
    const payload = (await requestWindowsLogin()) as ApiResponse<WindowsLoginResponseDto> | null;
    if (!payload?.data?.user) {
      throw new Error("Đăng nhập thất bại: phản hồi từ server không hợp lệ.");
    }
    return payload.data.user;
  },

  // BE validates against AD (not Negotiate); requestPasswordLogin stores the token like windowsLogin.
  login: async ({ userName, password }: LoginRequestDto): Promise<UserDto> => {
    const payload = (await requestPasswordLogin(userName, password)) as ApiResponse<WindowsLoginResponseDto> | null;
    if (!payload?.data?.user) {
      throw new Error("Đăng nhập thất bại: phản hồi từ server không hợp lệ.");
    }
    return payload.data.user;
  },

  // Renews the current JWT without a Negotiate handshake; client.ts stores the new token.
  me: async (): Promise<UserDto> => {
    const payload = await api.get<ApiResponse<WindowsLoginResponseDto>>(ENDPOINTS.AUTH.me);
    if (!payload?.data?.user) {
      throw new Error("Không lấy được thông tin phiên đăng nhập.");
    }
    return payload.data.user;
  },

  // Never fall back to windowsLogin(): Negotiate would pop the Windows Security dialog when SSO is absent.
  getCurrentUser: async (): Promise<UserDto | null> => {
    if (typeof window === "undefined") return null;
    if (!getAuthToken()) return null;
    try {
      return await AuthApi.me();
    } catch {
      return null;
    }
  },

  // Pre-provisions a user who has never logged in via Windows; deviceName is display-only, login matches userName.
  createUser: async (data: CreateUserDto) => {
    const response = await api.post<ApiResponse<UserDto>>(ENDPOINTS.AUTH.createUser, data);
    return response.data;
  },

  // Omit roleId to get all users.
  getAllUsersWithRoles: async (roleId?: number) => {
    const query = roleId !== undefined ? `?roleId=${roleId}` : "";
    const response = await api.get<ApiResponse<UserDto[]>>(`${ENDPOINTS.AUTH.getAllUsersWithRoles}${query}`);
    return response.data;
  },
  updateUserRoles: async ({ userId, roleIds }: { userId: number; roleIds: number[] }) => {
    const response = await api.post<ApiResponse<null>>(ENDPOINTS.AUTH.updateUserRoles, { userId, roleIds });
    return response.data;
  },

  // Only FullName is editable.
  updateUserFullName: async ({ userId, fullName }: UpdateUserFullNameDto) => {
    const response = await api.put<ApiResponse<UserDto>>(ENDPOINTS.AUTH.updateUserFullName, { userId, fullName });
    return response.data;
  },

  getAllRoles: async () => {
    const response = await api.get<ApiResponse<RoleDto[]>>(ENDPOINTS.AUTH.getAllRoles);
    return response.data;
  },

  createRole: async (roleName: string, description?: string) => {
    const response = await api.post<ApiResponse<RoleDto>>(ENDPOINTS.AUTH.createRole, { roleName, description });
    return response.data;
  },

  updateRole: async (roleId: number, roleName: string, description?: string) => {
    const response = await api.put<ApiResponse<RoleDto>>(ENDPOINTS.AUTH.updateRole(roleId), { roleName, description });
    return response.data;
  },

  deleteRole: async (roleId: number) => {
    const response = await api.delete<ApiResponse<null>>(ENDPOINTS.AUTH.deleteRole(roleId));
    return response.data;
  },

  deleteUser: async (userId: number) => {
    const response = await api.delete<ApiResponse<null>>(ENDPOINTS.AUTH.deleteUser(userId));
    return response.data;
  },
};

export { ENDPOINTS };