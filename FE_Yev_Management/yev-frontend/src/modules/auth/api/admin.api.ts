import { api } from "@/lib/client";
import { ENDPOINTS } from "./auth.api";
import type {
  CreateRoleDto,
  RoleDto,
  UpdateUserRolesDto,
  UserDto,
} from "@/modules/auth/types/auth.dto";

export const AdminApi = {
  getUsers: () => api.get<UserDto[]>(ENDPOINTS.ADMIN.USERS),

  updateUserRoles: (data: UpdateUserRolesDto) =>
    api.post(ENDPOINTS.ADMIN.UPDATE_USER_ROLES, data),

  getRoles: () => api.get<RoleDto[]>(ENDPOINTS.ADMIN.ROLES),

  createRoles: (data: CreateRoleDto) =>
    api.post(ENDPOINTS.ADMIN.CREATE_ROLES, data),

  updateRoles: (id: string, data: CreateRoleDto) =>
    api.put(ENDPOINTS.ADMIN.UPDATE_ROLES(id), data),

  deleteRoles: (id: string) => api.delete(ENDPOINTS.ADMIN.DELETE_ROLES(id)),
};