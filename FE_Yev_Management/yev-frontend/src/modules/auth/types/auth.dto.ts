
// 1. DTO cho thông tin người dùng
export interface UserDto {
  id: number;
  userName: string;
  fullName: string;
  deviceName: string;
  roles: string[];
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