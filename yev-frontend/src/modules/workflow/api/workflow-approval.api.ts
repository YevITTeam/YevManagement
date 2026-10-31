import { api } from "@/lib/client";
import type { WorkflowRequestDto, EmailApproveRequestDto, EmailRejectRequestDto } from "@/modules/workflow/types/workflow-request.dto";
import { ApiResponse } from "@/types/api";

// Anonymous email approval: the URL token is the only credential.
const ENDPOINTS = {
    WORKFLOW_APPROVAL: {
        getByToken: (token: string) => `/Workflow/WorkflowApproval/by-token/${encodeURIComponent(token)}`,
        approveByToken: (token: string) => `/Workflow/WorkflowApproval/by-token/${encodeURIComponent(token)}/approve`,
        rejectByToken: (token: string) => `/Workflow/WorkflowApproval/by-token/${encodeURIComponent(token)}/reject`,
    },
} as const;

export const WorkflowApprovalApi = {
    getByToken: async (token: string) => {
        const response = await api.get<ApiResponse<WorkflowRequestDto>>(ENDPOINTS.WORKFLOW_APPROVAL.getByToken(token));
        return response.data;
    },

    approveByToken: async (token: string, data: EmailApproveRequestDto) => {
        const response = await api.post<ApiResponse<WorkflowRequestDto>>(ENDPOINTS.WORKFLOW_APPROVAL.approveByToken(token), data);
        return response.data;
    },

    rejectByToken: async (token: string, data: EmailRejectRequestDto) => {
        const response = await api.post<ApiResponse<WorkflowRequestDto>>(ENDPOINTS.WORKFLOW_APPROVAL.rejectByToken(token), data);
        return response.data;
    },
};

export { ENDPOINTS };
