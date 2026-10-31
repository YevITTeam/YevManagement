import { api } from "@/lib/client";
import type { ProductionApprovalStepDto, ReplaceProductionApprovalStepItem } from "@/modules/attendance/types/production-approval-step.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
    PRODUCTION_APPROVAL_STEP: {
        getByDepartment: (departmentId: number) => `/ProductionApprovalStep/by-department/${departmentId}`,
        replaceByDepartment: (departmentId: number) => `/ProductionApprovalStep/by-department/${departmentId}`,
    },
} as const;

export const ProductionApprovalStepApi = {
    getByDepartment: async (departmentId: number) => {
        const response = await api.get<ApiResponse<ProductionApprovalStepDto[]>>(
            ENDPOINTS.PRODUCTION_APPROVAL_STEP.getByDepartment(departmentId)
        );
        return response.data;
    },
    // `steps` must be in approval order (first item = step 1).
    replaceByDepartment: async (departmentId: number, steps: ReplaceProductionApprovalStepItem[]) => {
        const response = await api.put<ApiResponse<ProductionApprovalStepDto[]>>(
            ENDPOINTS.PRODUCTION_APPROVAL_STEP.replaceByDepartment(departmentId),
            { steps }
        );
        return response.data;
    },
};

export { ENDPOINTS };
