import { api, getAuthToken, passwordLogin as requestPasswordLogin, windowsLogin as requestWindowsLogin } from "@/lib/client";
import type { UserDto, RoleDto, WindowsLoginResponseDto, LoginRequestDto, CreateUserDto } from "@/modules/auth/types/auth.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
  AUTH: {
    windowsLogin: "/Auth/windows-login",
    login: "/Auth/login",
    me: "/Auth/me",
    createUser: "/Auth/create-user",
    getAllUsersWithRoles: "/Auth/get-all-users-with-roles",
    updateUserRoles: "/Auth/update-user-roles",
    getAllRoles: "/Auth/get-all-roles",
    createRole: "/Auth/create-role",
    updateRole: (roleId: number) => `/Auth/update-role/${roleId}`,
    deleteRole: (roleId: number) => `/Auth/delete-role/${roleId}`,
    deleteUser: (userId: number) => `/Auth/delete-user/${userId}`,
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

  // Đăng nhập bằng form username/password tự viết (trang /login) — BE tự xác thực qua AD, không phải
  // Negotiate (docs/identity-api-fe.md §2c). Không đi qua ENDPOINTS.AUTH.login/api.post vì cần tự lưu
  // token giống windowsLogin (client.ts đã làm sẵn trong requestPasswordLogin).
  login: async ({ userName, password }: LoginRequestDto): Promise<UserDto> => {
    const payload = (await requestPasswordLogin(userName, password)) as ApiResponse<WindowsLoginResponseDto> | null;
    if (!payload?.data?.user) {
      throw new Error("Đăng nhập thất bại: phản hồi từ server không hợp lệ.");
    }
    return payload.data.user;
  },

  // Lấy hồ sơ + quyền hiện hành bằng JWT đang có (Bearer) và gia hạn luôn token đó — KHÔNG cần
  // handshake Negotiate (docs/identity-api-fe.md §2b). `client.ts` tự lưu token mới trong payload.
  me: async (): Promise<UserDto> => {
    const payload = await api.get<ApiResponse<WindowsLoginResponseDto>>(ENDPOINTS.AUTH.me);
    if (!payload?.data?.user) {
      throw new Error("Không lấy được thông tin phiên đăng nhập.");
    }
    return payload.data.user;
  },

  // ĐÃ có token → lấy hồ sơ qua `/Auth/me`; CHƯA có mới gọi `windows-login`.
  // Lý do không gọi thẳng windows-login như trước: mỗi lời gọi là một handshake Negotiate/NTLM mới.
  // Trên máy đã bật SSO cho origin của BE (site nằm trong vùng Local Intranet / AuthServerAllowlist)
  // thì handshake này âm thầm; máy CHƯA bật thì trình duyệt hỏi lại tài khoản domain — nên mỗi lần
  // F5 trang là một lần bị bắt đăng nhập lại dù vừa đăng nhập đúng.
  // Token hỏng/hết hạn → `/Auth/me` trả 401 → `client.ts` tự re-login (đúng 1 lần) rồi retry.
  // KHÔNG cache profile user ở localStorage (permissions/roles là dữ liệu nhạy cảm) — nơi cache hợp lý là
  // AuthContext (React state, chỉ tồn tại trong bộ nhớ JS của tab hiện tại), không phải ở đây.
  getCurrentUser: async (): Promise<UserDto | null> => {
    if (typeof window === "undefined") return null;
    return getAuthToken() ? AuthApi.me() : AuthApi.windowsLogin();
  },

  // Chuẩn bị trước 1 user cho UserName cụ thể — dùng khi nhân viên mới chưa từng đăng nhập Windows
  // lần nào (docs/identity-api-fe.md §4.9). deviceName (2026-07-11) chỉ để tham khảo/hiển thị,
  // KHÔNG còn dùng để khớp login (chỉ khớp theo userName).
  createUser: async (data: CreateUserDto) => {
    const response = await api.post<ApiResponse<UserDto>>(ENDPOINTS.AUTH.createUser, data);
    return response.data;
  },

  // roleId optional (docs/identity-api-fe.md §4.1) — lọc user thuộc Role đó; không truyền → trả toàn bộ.
  getAllUsersWithRoles: async (roleId?: number) => {
    const query = roleId !== undefined ? `?roleId=${roleId}` : "";
    const response = await api.get<ApiResponse<UserDto[]>>(`${ENDPOINTS.AUTH.getAllUsersWithRoles}${query}`);
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

  deleteUser: async (userId: number) => {
    const response = await api.delete<ApiResponse<null>>(ENDPOINTS.AUTH.deleteUser(userId));
    return response.data;
  },
};

export { ENDPOINTS };