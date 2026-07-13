import { api } from "@/lib/client";
import type { DeviceGroupDto } from "@/modules/pc-management/types/device-group.dto";
import { ApiResponse, ApiResponseWithPageNation } from "@/types/api";


const ENDPOINTS = {
    DEVICE_GROUP: {
        getDeviceGroupPageNation: "/DeviceGroup/grid-list",
        getAllDeviceGroups: "/DeviceGroup/all",
        getDeviceGroupById: (deviceGroupId: number) => `/DeviceGroup/${deviceGroupId}`,
        updateDeviceGroup: (deviceGroupId: number) => `/DeviceGroup/${deviceGroupId}`,
        deleteDeviceGroup: (deviceGroupId: number) => `/DeviceGroup/${deviceGroupId}`,
        createDeviceGroup: "/DeviceGroup"
    }
} as const;

export interface GetDeviceGroupPageNationParams {
    pageIndex?: number;
    pageSize?: number;
    keyword?: string;
}

export const DeviceGroupApi = {
    getDeviceGroupPageNation: async (params?: GetDeviceGroupPageNationParams) => {
        const query = new URLSearchParams();
        if (params?.pageIndex) query.set("PageIndex", String(params.pageIndex));
        if (params?.pageSize) query.set("PageSize", String(params.pageSize));
        if (params?.keyword) query.set("Keyword", params.keyword);

        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.DEVICE_GROUP.getDeviceGroupPageNation}?${queryString}` : ENDPOINTS.DEVICE_GROUP.getDeviceGroupPageNation;
        const response = await api.get<ApiResponseWithPageNation<DeviceGroupDto>>(url);
        return response.data;
    },
    getAllDeviceGroups: async () => {
        const response = await api.get<ApiResponse<DeviceGroupDto[]>>(ENDPOINTS.DEVICE_GROUP.getAllDeviceGroups);
        return response.data;
    },
    getDeviceGroupById: async (deviceGroupId: number) => {
        const response = await api.get<ApiResponse<DeviceGroupDto>>(ENDPOINTS.DEVICE_GROUP.getDeviceGroupById(deviceGroupId));
        return response.data;
    },
    updateDeviceGroup: async (deviceGroupId: number, deviceGroupData: Partial<DeviceGroupDto>) => {
        const response = await api.put<ApiResponse<DeviceGroupDto>>(ENDPOINTS.DEVICE_GROUP.updateDeviceGroup(deviceGroupId),
            {
                id: deviceGroupId,
                ...deviceGroupData
            });
        return response.data;
    },
    deleteDeviceGroup: async (deviceGroupId: number) => {
        const response = await api.delete<ApiResponse<void>>(ENDPOINTS.DEVICE_GROUP.deleteDeviceGroup(deviceGroupId));
        return response.data;
    },
    createDeviceGroup: async (deviceGroupData: Omit<DeviceGroupDto, "id">) => {
        const response = await api.post<ApiResponse<DeviceGroupDto>>(ENDPOINTS.DEVICE_GROUP.createDeviceGroup, deviceGroupData);
        return response.data;
    }

}

export { ENDPOINTS };
