import { api } from "@/lib/client";
import type { AdjustEmployeeAccumulationDto, EmployeeDto } from "@/modules/attendance/types/employee.dto";
import { ApiResponse, ApiResponseWithPageNation } from "@/types/api";

const ENDPOINTS = {
    EMPLOYEE: {
        getEmployeePageNation: "/Employee/grid-list",
        getAllEmployees: "/Employee/all",
        getEmployeeById: (id: number) => `/Employee/${id}`,
        getEmployeesByGroup: (groupId: number) => `/Employee/by-group/${groupId}`,
        getMe: "/Employee/me",
        adjustAccumulation: (id: number) => `/Employee/${id}/adjust-accumulation`,
        createEmployee: "/Employee",
        updateEmployee: (id: number) => `/Employee/${id}`,
        deleteEmployee: (id: number) => `/Employee/${id}`,
    },
} as const;

export interface GetEmployeePageNationParams {
    pageIndex?: number;
    pageSize?: number;
    keyword?: string;
}

export interface CreateUpdateEmployeeDto {
    code: string;
    firstName: string;
    lastName: string;
    userName?: string | null;
    monthToDate: number;
    yearToDate: number;
    groupId: number;
}

export const EmployeeApi = {
    getEmployeePageNation: async (params?: GetEmployeePageNationParams) => {
        const query = new URLSearchParams();
        if (params?.pageIndex) query.set("PageIndex", String(params.pageIndex));
        if (params?.pageSize) query.set("PageSize", String(params.pageSize));
        if (params?.keyword) query.set("Keyword", params.keyword);

        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.EMPLOYEE.getEmployeePageNation}?${queryString}` : ENDPOINTS.EMPLOYEE.getEmployeePageNation;
        const response = await api.get<ApiResponseWithPageNation<EmployeeDto>>(url);
        return response.data;
    },
    getAllEmployees: async () => {
        const response = await api.get<ApiResponse<EmployeeDto[]>>(ENDPOINTS.EMPLOYEE.getAllEmployees);
        return response.data;
    },
    getEmployeeById: async (id: number) => {
        const response = await api.get<ApiResponse<EmployeeDto>>(ENDPOINTS.EMPLOYEE.getEmployeeById(id));
        return response.data;
    },
    // Chọn nhân viên hàng loạt khi lập đơn OT (docs/attendance-api-fe.md §3.5).
    getEmployeesByGroup: async (groupId: number) => {
        const response = await api.get<ApiResponse<EmployeeDto[]>>(ENDPOINTS.EMPLOYEE.getEmployeesByGroup(groupId));
        return response.data;
    },
    // Không cần permission — chỉ cần đăng nhập. 404 nếu chưa được Admin gán userName (docs §3.6).
    getMe: async () => {
        const response = await api.get<ApiResponse<EmployeeDto>>(ENDPOINTS.EMPLOYEE.getMe);
        return response.data;
    },
    // Không cần permission Attendance.Employee.* — BE tự kiểm tra chính chủ hoặc Attendance.Employee.Update (docs §3.6).
    adjustAccumulation: async (id: number, data: AdjustEmployeeAccumulationDto) => {
        const response = await api.patch<ApiResponse<boolean>>(ENDPOINTS.EMPLOYEE.adjustAccumulation(id), data);
        return response.data;
    },
    createEmployee: async (data: CreateUpdateEmployeeDto) => {
        const response = await api.post<ApiResponse<EmployeeDto>>(ENDPOINTS.EMPLOYEE.createEmployee, data);
        return response.data;
    },
    updateEmployee: async (id: number, data: CreateUpdateEmployeeDto) => {
        const response = await api.put<ApiResponse<EmployeeDto>>(ENDPOINTS.EMPLOYEE.updateEmployee(id), { id, ...data });
        return response.data;
    },
    deleteEmployee: async (id: number) => {
        const response = await api.delete<ApiResponse<void>>(ENDPOINTS.EMPLOYEE.deleteEmployee(id));
        return response.data;
    },
};

export { ENDPOINTS };
