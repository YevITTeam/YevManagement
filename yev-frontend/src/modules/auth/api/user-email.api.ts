import { api } from "@/lib/client";
import type {
  CreateUserEmailDto,
  DomainAccountEmailStatusDto,
  LinkDomainAccountEmailsDto,
  LinkDomainAccountEmailsResultDto,
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
    domainAccount: "/UserEmail/domain-account",
    linkDomainAccount: "/UserEmail/link-domain-account",
  },
} as const;

// Every write returns the full new overview so the dialog replaces its state once.
export const UserEmailApi = {
  getOverview: async (userId: number) => {
    const response = await api.get<ApiResponse<UserEmailOverviewDto>>(ENDPOINTS.USER_EMAIL.byUser(userId));
    return response.data;
  },

  // Emails found on AD (mail + aliases) outside the current list.
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

  // userExists=false means no User yet.
  getByDomainAccount: async (domainAccount: string) => {
    const response = await api.get<ApiResponse<DomainAccountEmailStatusDto>>(
      `${ENDPOINTS.USER_EMAIL.domainAccount}?domainAccount=${encodeURIComponent(domainAccount)}`
    );
    return response.data;
  },

  // Creates the User (Basic role) if missing.
  linkDomainAccount: async (data: LinkDomainAccountEmailsDto) => {
    const response = await api.post<ApiResponse<LinkDomainAccountEmailsResultDto>>(ENDPOINTS.USER_EMAIL.linkDomainAccount, data);
    return response.data;
  },

  updateModules: async (userId: number, data: UpdateUserEmailModulesDto) => {
    const response = await api.put<ApiResponse<UserEmailOverviewDto>>(ENDPOINTS.USER_EMAIL.modules(userId), data);
    return response.data;
  },
};

export { ENDPOINTS };
