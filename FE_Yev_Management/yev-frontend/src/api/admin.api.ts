import { api } from "./client";
import { API_ENDPOINTS } from "./endpoints";
import { CreateRoleDto, RoleDto, UpdateUserRolesDto, UserDto } from "../types/auth.dto"; // Ví dụ bạn đã tạo type này

export const AdminApi = {
  getUsers: () => {
    return api.get<UserDto[]>(API_ENDPOINTS.ADMIN.USERS);
  },

  // Khi POST hoặc PUT, bạn chỉ cần ném thẳng biến 'data' vào tham số thứ 2
  updateUserRoles: (data: UpdateUserRolesDto) => {
    return api.post(API_ENDPOINTS.ADMIN.UPDATE_USER_ROLES, data);
  },

  getRoles: () => {
    return api.get<RoleDto[]>(API_ENDPOINTS.ADMIN.ROLES);
  },

  createRoles: (data: CreateRoleDto) => {
    return api.post(API_ENDPOINTS.ADMIN.CREATE_ROLES, data);
  },

  updateRoles: (id: string, data: CreateRoleDto) => {
    return api.put(API_ENDPOINTS.ADMIN.UPDATE_ROLES(id), data);
  },
  deleteRoles: (id: string) => {
    return api.delete(API_ENDPOINTS.ADMIN.DELETE_ROLES(id));
  }
};