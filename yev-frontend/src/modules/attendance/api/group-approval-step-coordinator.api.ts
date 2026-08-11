import { api } from "@/lib/client";
import type {
    GroupApprovalStepCoordinatorDto,
    ReplaceGroupApprovalStepCoordinatorsDto,
} from "@/modules/attendance/types/group-approval-step-coordinator.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
    GROUP_APPROVAL_STEP_COORDINATOR: {
        getByGroup: (groupId: number) => `/GroupApprovalStepCoordinator/by-group/${groupId}`,
        replaceByGroup: (groupId: number) => `/GroupApprovalStepCoordinator/by-group/${groupId}`,
    },
} as const;

export const GroupApprovalStepCoordinatorApi = {
    getByGroup: async (groupId: number) => {
        const response = await api.get<ApiResponse<GroupApprovalStepCoordinatorDto[]>>(
            ENDPOINTS.GROUP_APPROVAL_STEP_COORDINATOR.getByGroup(groupId)
        );
        return response.data;
    },
    replaceByGroup: async (groupId: number, payload: ReplaceGroupApprovalStepCoordinatorsDto) => {
        const response = await api.put<ApiResponse<GroupApprovalStepCoordinatorDto[]>>(
            ENDPOINTS.GROUP_APPROVAL_STEP_COORDINATOR.replaceByGroup(groupId),
            payload
        );
        return response.data;
    },
};

export { ENDPOINTS };
