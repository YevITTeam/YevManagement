import { api } from "@/lib/client";
import type { DepartmentDto } from "@/modules/attendance/types/department.dto";
import { ApiResponse, ApiResponseWithPageNation } from "@/types/api";

const ENDPOINTS = {
    DEPARTMENT: {
        getDepartmentPageNation: "/Department/grid-list",
        getAllDepartments: "/Department/all",
        getDepartmentById: (id: number) => `/Department/${id}`,
        createDepartment: "/Department",
        updateDepartment: (id: number) => `/Department/${id}`,
        deleteDepartment: (id: number) => `/Department/${id}`,
    },
} as const;

export interface GetDepartmentPageNationParams {
    pageIndex?: number;
    pageSize?: number;
    keyword?: string;
}

export const DepartmentApi = {
    getDepartmentPageNation: async (params?: GetDepartmentPageNationParams) => {
        const query = new URLSearchParams();
        if (params?.pageIndex) query.set("PageIndex", String(params.pageIndex));
        if (params?.pageSize) query.set("PageSize", String(params.pageSize));
        if (params?.keyword) query.set("Keyword", params.keyword);

        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.DEPARTMENT.getDepartmentPageNation}?${queryString}` : ENDPOINTS.DEPARTMENT.getDepartmentPageNation;
        const response = await api.get<ApiResponseWithPageNation<DepartmentDto>>(url);
        return response.data;
    },
    getAllDepartments: async () => {
        const response = await api.get<ApiResponse<DepartmentDto[]>>(ENDPOINTS.DEPARTMENT.getAllDepartments);
        return response.data;
    },
    getDepartmentById: async (id: number) => {
        const response = await api.get<ApiResponse<DepartmentDto>>(ENDPOINTS.DEPARTMENT.getDepartmentById(id));
        return response.data;
    },
    createDepartment: async (data: Omit<DepartmentDto, "id">) => {
        const response = await api.post<ApiResponse<DepartmentDto>>(ENDPOINTS.DEPARTMENT.createDepartment, data);
        return response.data;
    },
    updateDepartment: async (id: number, data: Partial<DepartmentDto>) => {
        const response = await api.put<ApiResponse<DepartmentDto>>(ENDPOINTS.DEPARTMENT.updateDepartment(id), { id, ...data });
        return response.data;
    },
    deleteDepartment: async (id: number) => {
        const response = await api.delete<ApiResponse<void>>(ENDPOINTS.DEPARTMENT.deleteDepartment(id));
        return response.data;
    },
};

export { ENDPOINTS };
