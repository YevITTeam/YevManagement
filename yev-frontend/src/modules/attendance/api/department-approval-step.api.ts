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
    // Bộ phận cho dropdown chọn ở màn "Cây duyệt" — Admin thấy hết, Coordinator chỉ thấy đúng Bộ
    // phận mình phụ trách (2026-08-25, thay cho DepartmentApi.getAllDepartments() không lọc trước đó).
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
