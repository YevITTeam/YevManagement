import { api } from "@/lib/client";
import type { GroupApprovalStepDto, ReplaceGroupApprovalStepItem } from "@/modules/attendance/types/group-approval-step.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
    GROUP_APPROVAL_STEP: {
        getByGroup: (groupId: number) => `/GroupApprovalStep/by-group/${groupId}`,
        replaceByGroup: (groupId: number) => `/GroupApprovalStep/by-group/${groupId}`,
    },
} as const;

export const GroupApprovalStepApi = {
    getByGroup: async (groupId: number) => {
        const response = await api.get<ApiResponse<GroupApprovalStepDto[]>>(
            ENDPOINTS.GROUP_APPROVAL_STEP.getByGroup(groupId)
        );
        return response.data;
    },
    // steps phải là mảng ĐÃ SẮP XẾP theo đúng thứ tự bước duyệt mong muốn (phần tử đầu = bước 1).
    replaceByGroup: async (groupId: number, steps: ReplaceGroupApprovalStepItem[]) => {
        const response = await api.put<ApiResponse<GroupApprovalStepDto[]>>(
            ENDPOINTS.GROUP_APPROVAL_STEP.replaceByGroup(groupId),
            { steps }
        );
        return response.data;
    },
};

export { ENDPOINTS };
