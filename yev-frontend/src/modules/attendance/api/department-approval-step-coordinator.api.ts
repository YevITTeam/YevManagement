import { api } from "@/lib/client";
import type {
    DepartmentApprovalStepCoordinatorDto,
    ReplaceDepartmentApprovalStepCoordinatorsDto,
} from "@/modules/attendance/types/department-approval-step-coordinator.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
    DEPARTMENT_APPROVAL_STEP_COORDINATOR: {
        getByDepartment: (departmentId: number) => `/DepartmentApprovalStepCoordinator/by-department/${departmentId}`,
        replaceByDepartment: (departmentId: number) => `/DepartmentApprovalStepCoordinator/by-department/${departmentId}`,
    },
} as const;

export const DepartmentApprovalStepCoordinatorApi = {
    getByDepartment: async (departmentId: number) => {
        const response = await api.get<ApiResponse<DepartmentApprovalStepCoordinatorDto[]>>(
            ENDPOINTS.DEPARTMENT_APPROVAL_STEP_COORDINATOR.getByDepartment(departmentId)
        );
        return response.data;
    },
    replaceByDepartment: async (departmentId: number, payload: ReplaceDepartmentApprovalStepCoordinatorsDto) => {
        const response = await api.put<ApiResponse<DepartmentApprovalStepCoordinatorDto[]>>(
            ENDPOINTS.DEPARTMENT_APPROVAL_STEP_COORDINATOR.replaceByDepartment(departmentId),
            payload
        );
        return response.data;
    },
};

export { ENDPOINTS };
