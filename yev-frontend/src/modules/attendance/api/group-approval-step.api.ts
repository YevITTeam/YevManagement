import { api } from "@/lib/client";
import type { GroupApprovalStepDto, GroupBorrowedApproversDto, GroupOtFormCreatorsDto, ReplaceGroupApprovalStepItem } from "@/modules/attendance/types/group-approval-step.dto";
import type { GroupDto } from "@/modules/attendance/types/group.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
    GROUP_APPROVAL_STEP: {
        myGroups: "/GroupApprovalStep/my-groups",
        getByGroup: (groupId: number) => `/GroupApprovalStep/by-group/${groupId}`,
        replaceByGroup: (groupId: number) => `/GroupApprovalStep/by-group/${groupId}`,
        borrowedApprovers: (groupId: number) => `/GroupApprovalStep/by-group/${groupId}/borrowed-approvers`,
        otFormCreators: (groupId: number) => `/GroupApprovalStep/by-group/${groupId}/ot-form-creators`,
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
    // `steps` must be in approval order (first item = step 1).
    replaceByGroup: async (groupId: number, steps: ReplaceGroupApprovalStepItem[]) => {
        const response = await api.put<ApiResponse<GroupApprovalStepDto[]>>(
            ENDPOINTS.GROUP_APPROVAL_STEP.replaceByGroup(groupId),
            { steps }
        );
        return response.data;
    },
    getBorrowedApprovers: async (groupId: number) => {
        const response = await api.get<ApiResponse<GroupBorrowedApproversDto>>(ENDPOINTS.GROUP_APPROVAL_STEP.borrowedApprovers(groupId));
        return response.data;
    },
    // employeeIds = the FULL list of borrowed Team Leaders after the change.
    replaceBorrowedApprovers: async (groupId: number, employeeIds: number[]) => {
        const response = await api.put<ApiResponse<GroupBorrowedApproversDto>>(ENDPOINTS.GROUP_APPROVAL_STEP.borrowedApprovers(groupId), { employeeIds });
        return response.data;
    },
    getOtFormCreators: async (groupId: number) => {
        const response = await api.get<ApiResponse<GroupOtFormCreatorsDto>>(ENDPOINTS.GROUP_APPROVAL_STEP.otFormCreators(groupId));
        return response.data;
    },
    // employeeIds = the FULL list of granted creators after the change.
    replaceOtFormCreators: async (groupId: number, employeeIds: number[]) => {
        const response = await api.put<ApiResponse<GroupOtFormCreatorsDto>>(ENDPOINTS.GROUP_APPROVAL_STEP.otFormCreators(groupId), { employeeIds });
        return response.data;
    },
};

export { ENDPOINTS };
