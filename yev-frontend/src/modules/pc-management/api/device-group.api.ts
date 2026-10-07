import { api } from "@/lib/client";
import type { DeviceGroupDto, DeviceGroupCreateUpdateDto } from "@/modules/pc-management/types/device-group.dto";
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
    // Lọc theo Bộ phận cha (docs/asset-module.md §4) — bỏ trống trả toàn bộ Nhóm.
    departmentId?: number;
}

export const DeviceGroupApi = {
    getDeviceGroupPageNation: async (params?: GetDeviceGroupPageNationParams) => {
        const query = new URLSearchParams();
        if (params?.pageIndex) query.set("PageIndex", String(params.pageIndex));
        if (params?.pageSize) query.set("PageSize", String(params.pageSize));
        if (params?.keyword) query.set("Keyword", params.keyword);
        if (params?.departmentId !== undefined) query.set("DepartmentId", String(params.departmentId));

        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.DEVICE_GROUP.getDeviceGroupPageNation}?${queryString}` : ENDPOINTS.DEVICE_GROUP.getDeviceGroupPageNation;
        const response = await api.get<ApiResponseWithPageNation<DeviceGroupDto>>(url);
        return response.data;
    },
    // Dùng cho dropdown "Nhóm" cascading theo "Bộ phận" đã chọn (docs/asset-module.md §4) —
    // bỏ departmentId để lấy toàn bộ Nhóm (màn quản lý danh mục Nhóm).
    getAllDeviceGroups: async (departmentId?: number) => {
        const query = new URLSearchParams();
        if (departmentId !== undefined) query.set("DepartmentId", String(departmentId));
        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.DEVICE_GROUP.getAllDeviceGroups}?${queryString}` : ENDPOINTS.DEVICE_GROUP.getAllDeviceGroups;
        const response = await api.get<ApiResponse<DeviceGroupDto[]>>(url);
        return response.data;
    },
    getDeviceGroupById: async (deviceGroupId: number) => {
        const response = await api.get<ApiResponse<DeviceGroupDto>>(ENDPOINTS.DEVICE_GROUP.getDeviceGroupById(deviceGroupId));
        return response.data;
    },
    updateDeviceGroup: async (deviceGroupId: number, deviceGroupData: DeviceGroupCreateUpdateDto) => {
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
    createDeviceGroup: async (deviceGroupData: DeviceGroupCreateUpdateDto) => {
        const response = await api.post<ApiResponse<DeviceGroupDto>>(ENDPOINTS.DEVICE_GROUP.createDeviceGroup, deviceGroupData);
        return response.data;
    }

}

export { ENDPOINTS };
