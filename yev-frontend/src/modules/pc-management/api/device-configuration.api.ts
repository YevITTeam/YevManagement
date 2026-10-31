import { api } from "@/lib/client";
import type {
    CreateUpdateDeviceConfigurationDto,
    DeviceConfigurationDto,
    DeviceConfigurationHistoryDto,
    DeviceConfigurationInitialDto,
} from "@/modules/pc-management/types/device-configuration.dto";
import { ApiResponse } from "@/types/api";

// No list endpoint; always queried by deviceId or configId.
const ENDPOINTS = {
    DEVICE_CONFIGURATION: {
        getConfigurationByDevice: (deviceId: number) => `/DeviceConfiguration/by-device/${deviceId}`,
        createConfiguration: "/DeviceConfiguration",
        updateConfiguration: (id: number) => `/DeviceConfiguration/${id}`,
        deleteConfiguration: (id: number) => `/DeviceConfiguration/${id}`,
        getInitialConfiguration: (configId: number) => `/DeviceConfiguration/${configId}/initial`,
        deleteInitialConfiguration: (id: number) => `/DeviceConfiguration/initial/${id}`,
        getConfigurationHistory: (configId: number) => `/DeviceConfiguration/${configId}/history`,
    },
} as const;

export const DeviceConfigurationApi = {
    // null means no configuration yet (not an error); decides between POST and PUT.
    getConfigurationByDevice: async (deviceId: number) => {
        const response = await api.get<ApiResponse<DeviceConfigurationDto | null>>(
            ENDPOINTS.DEVICE_CONFIGURATION.getConfigurationByDevice(deviceId)
        );
        return response.data;
    },

    // One per device; a second POST returns 400, use PUT.
    createConfiguration: async (data: CreateUpdateDeviceConfigurationDto) => {
        const response = await api.post<ApiResponse<DeviceConfigurationDto>>(
            ENDPOINTS.DEVICE_CONFIGURATION.createConfiguration,
            data
        );
        return response.data;
    },

    // deviceId is immutable; id in body must match {id}.
    updateConfiguration: async (id: number, data: Partial<CreateUpdateDeviceConfigurationDto>) => {
        const response = await api.put<ApiResponse<DeviceConfigurationDto>>(
            ENDPOINTS.DEVICE_CONFIGURATION.updateConfiguration(id),
            { id, ...data }
        );
        return response.data;
    },

    // Hard delete; cascades to the initial snapshot and full history.
    deleteConfiguration: async (id: number) => {
        const response = await api.delete<ApiResponse<void>>(
            ENDPOINTS.DEVICE_CONFIGURATION.deleteConfiguration(id)
        );
        return response.data;
    },

    // null if no snapshot yet.
    getInitialConfiguration: async (configId: number) => {
        const response = await api.get<ApiResponse<DeviceConfigurationInitialDto | null>>(
            ENDPOINTS.DEVICE_CONFIGURATION.getInitialConfiguration(configId)
        );
        return response.data;
    },

    // For fixing a mistaken initial entry.
    deleteInitialConfiguration: async (id: number) => {
        const response = await api.delete<ApiResponse<void>>(
            ENDPOINTS.DEVICE_CONFIGURATION.deleteInitialConfiguration(id)
        );
        return response.data;
    },

    // Newest first.
    getConfigurationHistory: async (configId: number) => {
        const response = await api.get<ApiResponse<DeviceConfigurationHistoryDto[]>>(
            ENDPOINTS.DEVICE_CONFIGURATION.getConfigurationHistory(configId)
        );
        return response.data;
    },
};

export { ENDPOINTS };
