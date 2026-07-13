import { api } from "@/lib/client";
import type { DeviceDepartmentDto } from "@/modules/pc-management/types/device-department.dto";
import { ApiResponse, ApiResponseWithPageNation } from "@/types/api";


const ENDPOINTS = {
    DEVICE_DEPARTMENT: {
        getDeviceDepartmentPageNation: "/DeviceDepartment/grid-list",
        getAllDeviceDepartments: "/DeviceDepartment/all",
        getDeviceDepartmentById: (deviceDepartmentId: number) => `/DeviceDepartment/${deviceDepartmentId}`,
        updateDeviceDepartment: (deviceDepartmentId: number) => `/DeviceDepartment/${deviceDepartmentId}`,
        deleteDeviceDepartment: (deviceDepartmentId: number) => `/DeviceDepartment/${deviceDepartmentId}`,
        createDeviceDepartment: "/DeviceDepartment"
    }
} as const;

export interface GetDeviceDepartmentPageNationParams {
    pageIndex?: number;
    pageSize?: number;
    keyword?: string;
}

export const DeviceDepartmentApi = {
    getDeviceDepartmentPageNation: async (params?: GetDeviceDepartmentPageNationParams) => {
        const query = new URLSearchParams();
        if (params?.pageIndex) query.set("PageIndex", String(params.pageIndex));
        if (params?.pageSize) query.set("PageSize", String(params.pageSize));
        if (params?.keyword) query.set("Keyword", params.keyword);

        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.DEVICE_DEPARTMENT.getDeviceDepartmentPageNation}?${queryString}` : ENDPOINTS.DEVICE_DEPARTMENT.getDeviceDepartmentPageNation;
        const response = await api.get<ApiResponseWithPageNation<DeviceDepartmentDto>>(url);
        return response.data;
    },
    getAllDeviceDepartments: async () => {
        const response = await api.get<ApiResponse<DeviceDepartmentDto[]>>(ENDPOINTS.DEVICE_DEPARTMENT.getAllDeviceDepartments);
        return response.data;
    },
    getDeviceDepartmentById: async (deviceDepartmentId: number) => {
        const response = await api.get<ApiResponse<DeviceDepartmentDto>>(ENDPOINTS.DEVICE_DEPARTMENT.getDeviceDepartmentById(deviceDepartmentId));
        return response.data;
    },
    updateDeviceDepartment: async (deviceDepartmentId: number, deviceDepartmentData: Partial<DeviceDepartmentDto>) => {
        const response = await api.put<ApiResponse<DeviceDepartmentDto>>(ENDPOINTS.DEVICE_DEPARTMENT.updateDeviceDepartment(deviceDepartmentId),
            {
                id: deviceDepartmentId,
                ...deviceDepartmentData
            });
        return response.data;
    },
    deleteDeviceDepartment: async (deviceDepartmentId: number) => {
        const response = await api.delete<ApiResponse<void>>(ENDPOINTS.DEVICE_DEPARTMENT.deleteDeviceDepartment(deviceDepartmentId));
        return response.data;
    },
    createDeviceDepartment: async (deviceDepartmentData: Omit<DeviceDepartmentDto, "id">) => {
        const response = await api.post<ApiResponse<DeviceDepartmentDto>>(ENDPOINTS.DEVICE_DEPARTMENT.createDeviceDepartment, deviceDepartmentData);
        return response.data;
    }

}

export { ENDPOINTS };
