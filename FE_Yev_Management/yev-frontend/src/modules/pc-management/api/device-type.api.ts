import { api } from "@/lib/client";
import type { DeviceTypeDto } from "@/modules/pc-management/types/device-type.dto";
import { ApiResponse, ApiResponseWithPageNation } from "@/types/api";

const ENDPOINTS = {
    DEVICE_TYPE: {
        getDeviceTypePageNation: "/DeviceType/grid-list",
        getAllDeviceTypes: "/DeviceType/all",
        getDeviceTypeById: (deviceTypeId: number) => `/DeviceType/${deviceTypeId}`,
        updateDeviceType: (deviceTypeId: number) => `/DeviceType/${deviceTypeId}`,
        deleteDeviceType: (deviceTypeId: number) => `/DeviceType/${deviceTypeId}`,
        createDeviceType: "/DeviceType"
    }
} as const;

export interface GetDeviceTypePageNationParams {
    pageIndex?: number;
    pageSize?: number;
    keyword?: string;
}

export const DeviceTypeApi = {
    getDeviceTypePageNation: async (params?: GetDeviceTypePageNationParams) => {
        const query = new URLSearchParams();
        if (params?.pageIndex) query.set("PageIndex", String(params.pageIndex));
        if (params?.pageSize) query.set("PageSize", String(params.pageSize));
        if (params?.keyword) query.set("Keyword", params.keyword);
        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.DEVICE_TYPE.getDeviceTypePageNation}?${queryString}` : ENDPOINTS.DEVICE_TYPE.getDeviceTypePageNation;
        const response = await api.get<ApiResponseWithPageNation<DeviceTypeDto>>(url);
        return response.data;
    },
    getAllDeviceTypes: async () => {
        const response = await api.get<ApiResponse<DeviceTypeDto[]>>(ENDPOINTS.DEVICE_TYPE.getAllDeviceTypes);
        return response.data;
    },
    getDeviceTypeById: async (deviceTypeId: number) => {
        const response = await api.get<ApiResponse<DeviceTypeDto>>(ENDPOINTS.DEVICE_TYPE.getDeviceTypeById(deviceTypeId));
        return response.data;
    },
    updateDeviceType: async (deviceTypeId: number, deviceTypeData: Partial<DeviceTypeDto>) => {
        const response = await api.put<ApiResponse<DeviceTypeDto>>(ENDPOINTS.DEVICE_TYPE.updateDeviceType(deviceTypeId),
            {
                id: deviceTypeId,
                ...deviceTypeData
            });
        return response.data;
    },
    deleteDeviceType: async (deviceTypeId: number) => {
        const response = await api.delete<ApiResponse<void>>(ENDPOINTS.DEVICE_TYPE.deleteDeviceType(deviceTypeId));
        return response.data;
    },
    createDeviceType: async (deviceTypeData: Omit<DeviceTypeDto, "id">) => {
        const response = await api.post<ApiResponse<DeviceTypeDto>>(ENDPOINTS.DEVICE_TYPE.createDeviceType, deviceTypeData);
        return response.data;
    }
}   