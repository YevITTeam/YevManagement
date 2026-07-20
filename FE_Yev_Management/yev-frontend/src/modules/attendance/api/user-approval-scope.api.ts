import { api } from "@/lib/client";
import type { CreateUserApprovalScopeDto, UserApprovalScopeDto } from "@/modules/attendance/types/user-approval-scope.dto";
import { ApiResponse, ApiResponseWithPageNation } from "@/types/api";

// Route /UserApprovalScope — không có PUT, sửa = xoá + tạo lại (docs/attendance-api-fe.md §5).
const ENDPOINTS = {
    USER_APPROVAL_SCOPE: {
        getScopePageNation: "/UserApprovalScope/grid-list",
        getScopesByUser: (userName: string) => `/UserApprovalScope/by-user/${encodeURIComponent(userName)}`,
        createScope: "/UserApprovalScope",
        deleteScope: (id: number) => `/UserApprovalScope/${id}`,
    },
} as const;

export interface GetUserApprovalScopePageNationParams {
    pageIndex?: number;
    pageSize?: number;
    keyword?: string;
}

export const UserApprovalScopeApi = {
    getScopePageNation: async (params?: GetUserApprovalScopePageNationParams) => {
        const query = new URLSearchParams();
        if (params?.pageIndex) query.set("PageIndex", String(params.pageIndex));
        if (params?.pageSize) query.set("PageSize", String(params.pageSize));
        if (params?.keyword) query.set("Keyword", params.keyword);

        const queryString = query.toString();
        const url = queryString
            ? `${ENDPOINTS.USER_APPROVAL_SCOPE.getScopePageNation}?${queryString}`
            : ENDPOINTS.USER_APPROVAL_SCOPE.getScopePageNation;
        const response = await api.get<ApiResponseWithPageNation<UserApprovalScopeDto>>(url);
        return response.data;
    },
    getScopesByUser: async (userName: string) => {
        const response = await api.get<ApiResponse<UserApprovalScopeDto[]>>(
            ENDPOINTS.USER_APPROVAL_SCOPE.getScopesByUser(userName)
        );
        return response.data;
    },
    createScope: async (data: CreateUserApprovalScopeDto) => {
        const response = await api.post<ApiResponse<UserApprovalScopeDto>>(ENDPOINTS.USER_APPROVAL_SCOPE.createScope, data);
        return response.data;
    },
    deleteScope: async (id: number) => {
        const response = await api.delete<ApiResponse<void>>(ENDPOINTS.USER_APPROVAL_SCOPE.deleteScope(id));
        return response.data;
    },
};

export { ENDPOINTS };
