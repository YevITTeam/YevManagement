
// 1. DTO cho thông tin người dùng
export interface UserDto {
  id: number;
  userName: string;
  fullName: string;
  deviceName: string | null;
  roles: string[];
  // Mã permission suy ra từ roles (vd "Asset.Device.View") — dùng để ẩn/hiện UI, xem docs/identity-api-fe.md §3.
  // BE luôn tự enforce lại ở tầng API, permissions ở đây chỉ phục vụ hiển thị.
  permissions: string[];
}

// 2. DTO cho danh sách các Quyền (Roles) tải từ DB lên
export interface RoleDto {
  id: number;
  roleName: string;
  description: string;
}

// 3. DTO dùng để Admin gửi lệnh cập nhật quyền xuống Backend
export interface UpdateUserRolesDto {
  userId: number;
  roleIds: number[];
}

export interface CreateRoleDto {
  roleName: string;
  description?: string;
}

// Body cho POST /api/Auth/create-user — Admin chuẩn bị trước 1 user cho UserName cụ thể,
// trước khi người đó đăng nhập Windows lần đầu (xem docs/identity-api-fe.md §4.9).
// deviceName (2026-07-11): chỉ để tham khảo/hiển thị, KHÔNG còn dùng để khớp login
// (chỉ khớp theo userName) — để trống vẫn tạo user bình thường.
export interface CreateUserDto {
  userName: string;
  deviceName?: string;
  fullName?: string;
  roleIds?: number[];
}

// Response gốc của POST /api/Auth/windows-login (docs/identity-api-fe.md §2.2)
export interface WindowsLoginResponseDto {
  user: UserDto;
  token: string;
}