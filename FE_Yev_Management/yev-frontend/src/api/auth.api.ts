import { api } from "./client";
import { UserDto } from "../types/auth.dto";
import { API_ENDPOINTS } from "./endpoints";

export const AuthApi = {
  getMe: () => {
    return api.get<UserDto>(API_ENDPOINTS.AUTH.ME);
  },
};