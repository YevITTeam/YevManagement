import { api } from "@/lib/client";
import type {
    ApplyGroupLevelMember,
    ApplyGroupLevelMemberResult,
    GroupApprovalStepDto,
    GroupBorrowedApproversDto,
    ReplaceGroupApprovalTree,
} from "@/modules/attendance/types/group-approval-step.dto";
import type { GroupDto } from "@/modules/attendance/types/group.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
    GROUP_APPROVAL_STEP: {
        myGroups: "/GroupApprovalStep/my-groups",
        getByGroup: (groupId: number) => `/GroupApprovalStep/by-group/${groupId}`,
        replaceByGroup: (groupId: number) => `/GroupApprovalStep/by-group/${groupId}`,
        borrowedApprovers: (groupId: number) => `/GroupApprovalStep/by-group/${groupId}/borrowed-approvers`,
        applyMember: "/GroupApprovalStep/apply-member",
    },
} as const;

export const GroupApprovalStepApi = {
    // Admin gets every group; a coordinator only the groups they are assigned to.
    getMyGroups: async () => {
        const response = await api.get<ApiResponse<GroupDto[]>>(ENDPOINTS.GROUP_APPROVAL_STEP.myGroups);
        return response.data;
    },
    getByGroup: async (groupId: number) => {
        const response = await api.get<ApiResponse<GroupApprovalStepDto[]>>(
            ENDPOINTS.GROUP_APPROVAL_STEP.getByGroup(groupId)
        );
        return response.data;
    },
    // `tree.steps` must be in approval order (first item = step 1).
    replaceByGroup: async (groupId: number, tree: ReplaceGroupApprovalTree) => {
        const response = await api.put<ApiResponse<GroupApprovalStepDto[]>>(
            ENDPOINTS.GROUP_APPROVAL_STEP.replaceByGroup(groupId),
            tree
        );
        return response.data;
    },
    getBorrowedApprovers: async (groupId: number) => {
        const response = await api.get<ApiResponse<GroupBorrowedApproversDto>>(ENDPOINTS.GROUP_APPROVAL_STEP.borrowedApprovers(groupId));
        return response.data;
    },
    applyMember: async (payload: ApplyGroupLevelMember) => {
        const response = await api.post<ApiResponse<ApplyGroupLevelMemberResult>>(ENDPOINTS.GROUP_APPROVAL_STEP.applyMember, payload);
        return response.data;
    },
};

export { ENDPOINTS };
