import { api, windowsLogin as requestWindowsLogin } from "@/lib/client";
import type { UserDto, RoleDto, WindowsLoginResponseDto } from "@/modules/auth/types/auth.dto";
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
  // Đi qua requestWindowsLogin() (single-flight ở client.ts) thay vì api.post thẳng — nếu lúc này có
  // request khác cũng đang tự retry sau 401, cả hai gộp về đúng 1 lần gọi Negotiate thật sự, tránh
  // trình duyệt phải xử lý nhiều handshake NTLM chồng chéo (nguyên nhân gây lặp popup đăng nhập domain).
  windowsLogin: async (): Promise<UserDto> => {
    const payload = (await requestWindowsLogin()) as ApiResponse<WindowsLoginResponseDto> | null;
    if (!payload?.data?.user) {
      throw new Error("Đăng nhập thất bại: phản hồi từ server không hợp lệ.");
    }
    return payload.data.user;
  },

  // Luôn gọi thẳng windows-login (Negotiate/Kerberos — âm thầm dùng phiên đăng nhập Windows hiện tại,
  // KHÔNG phải popup nhập mật khẩu, gọi nhiều lần vẫn an toàn/idempotent, xem docs/identity-api-fe.md §2.2).
  // KHÔNG cache profile user ở localStorage (permissions/roles là dữ liệu nhạy cảm) — nơi cache hợp lý là
  // AuthContext (React state, chỉ tồn tại trong bộ nhớ JS của tab hiện tại), không phải ở đây.
  getCurrentUser: async (): Promise<UserDto | null> => {
    if (typeof window === "undefined") return null;
    return AuthApi.windowsLogin();
  },

  getAllUsersWithRoles: async () => {
    const response = await api.get<ApiResponse<UserDto[]>>(ENDPOINTS.AUTH.getAllUsersWithRoles);
    return response.data;
  },
  updateUserRoles: async ({ userId, roleIds }: { userId: number; roleIds: number[] }) => {
    const response = await api.post<ApiResponse<null>>(ENDPOINTS.AUTH.updateUserRoles, { userId, roleIds });
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
};

export { ENDPOINTS };