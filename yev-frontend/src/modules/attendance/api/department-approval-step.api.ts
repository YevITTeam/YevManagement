import { api } from "@/lib/client";
import type { ApprovalTreeDepartmentDto, DepartmentApprovalStepDto, ReplaceDepartmentApprovalStepItem } from "@/modules/attendance/types/department-approval-step.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
    DEPARTMENT_APPROVAL_STEP: {
        myDepartments: "/DepartmentApprovalStep/my-departments",
        getByDepartment: (departmentId: number) => `/DepartmentApprovalStep/by-department/${departmentId}`,
        replaceByDepartment: (departmentId: number) => `/DepartmentApprovalStep/by-department/${departmentId}`,
    },
} as const;

export const DepartmentApprovalStepApi = {
    // Admin sees all; a coordinator only the departments they are assigned to.
    getMyDepartments: async () => {
        const response = await api.get<ApiResponse<ApprovalTreeDepartmentDto[]>>(ENDPOINTS.DEPARTMENT_APPROVAL_STEP.myDepartments);
        return response.data;
    },
    getByDepartment: async (departmentId: number) => {
        const response = await api.get<ApiResponse<DepartmentApprovalStepDto[]>>(
            ENDPOINTS.DEPARTMENT_APPROVAL_STEP.getByDepartment(departmentId)
        );
        return response.data;
    },
    // `steps` must be in approval order (first item = step 1).
    replaceByDepartment: async (departmentId: number, steps: ReplaceDepartmentApprovalStepItem[]) => {
        const response = await api.put<ApiResponse<DepartmentApprovalStepDto[]>>(
            ENDPOINTS.DEPARTMENT_APPROVAL_STEP.replaceByDepartment(departmentId),
            { steps }
        );
        return response.data;
    },
};

export { ENDPOINTS };
