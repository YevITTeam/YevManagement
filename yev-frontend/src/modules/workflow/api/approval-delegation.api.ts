import { api } from "@/lib/client";
import type { ApprovalDelegationDto, CreateUpdateApprovalDelegationDto } from "@/modules/workflow/types/approval-delegation.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
    APPROVAL_DELEGATION: {
        getMine: "/Workflow/ApprovalDelegation",
        create: "/Workflow/ApprovalDelegation",
        update: (id: number) => `/Workflow/ApprovalDelegation/${id}`,
        remove: (id: number) => `/Workflow/ApprovalDelegation/${id}`,
    },
} as const;

export const ApprovalDelegationApi = {
    getMine: async () => {
        const response = await api.get<ApiResponse<ApprovalDelegationDto[]>>(ENDPOINTS.APPROVAL_DELEGATION.getMine);
        return response.data;
    },

    create: async (data: CreateUpdateApprovalDelegationDto) => {
        const response = await api.post<ApiResponse<ApprovalDelegationDto>>(ENDPOINTS.APPROVAL_DELEGATION.create, data);
        return response.data;
    },

    update: async (id: number, data: CreateUpdateApprovalDelegationDto) => {
        const response = await api.put<ApiResponse<ApprovalDelegationDto>>(ENDPOINTS.APPROVAL_DELEGATION.update(id), data);
        return response.data;
    },

    remove: async (id: number) => {
        const response = await api.delete<ApiResponse<boolean>>(ENDPOINTS.APPROVAL_DELEGATION.remove(id));
        return response.data;
    },
};

export { ENDPOINTS };
