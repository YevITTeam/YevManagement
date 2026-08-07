import { api } from "@/lib/client";
import type { DepartmentApprovalStepDto, ReplaceDepartmentApprovalStepItem } from "@/modules/attendance/types/department-approval-step.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
    DEPARTMENT_APPROVAL_STEP: {
        getByDepartment: (departmentId: number) => `/DepartmentApprovalStep/by-department/${departmentId}`,
        replaceByDepartment: (departmentId: number) => `/DepartmentApprovalStep/by-department/${departmentId}`,
    },
} as const;

export const DepartmentApprovalStepApi = {
    getByDepartment: async (departmentId: number) => {
        const response = await api.get<ApiResponse<DepartmentApprovalStepDto[]>>(
            ENDPOINTS.DEPARTMENT_APPROVAL_STEP.getByDepartment(departmentId)
        );
        return response.data;
    },
    // steps phải là mảng ĐÃ SẮP XẾP theo đúng thứ tự bước duyệt mong muốn (phần tử đầu = bước 1).
    replaceByDepartment: async (departmentId: number, steps: ReplaceDepartmentApprovalStepItem[]) => {
        const response = await api.put<ApiResponse<DepartmentApprovalStepDto[]>>(
            ENDPOINTS.DEPARTMENT_APPROVAL_STEP.replaceByDepartment(departmentId),
            { steps }
        );
        return response.data;
    },
};

export { ENDPOINTS };
