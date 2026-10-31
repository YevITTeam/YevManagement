import { api } from "@/lib/client";
import type {
    CreateUpdateDeviceSoftwareDto,
    DeviceSoftwareDeviceDto,
    DeviceSoftwarePickerDto,
    DeviceSoftwareSyncDto,
} from "@/modules/pc-management/types/device-software.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
    DEVICE_SOFTWARE: {
        getDeviceSoftwareByDevice: (deviceId: number) => `/DeviceSoftware/device/${deviceId}`,
        createDeviceSoftware: "/DeviceSoftware",
        updateDeviceSoftware: "/DeviceSoftware",
        deleteDeviceSoftware: (deviceId: number, softwareId: number) =>
            `/DeviceSoftware/device/${deviceId}/software/${softwareId}`,
        getDeviceSoftwarePicker: (deviceId: number) => `/DeviceSoftware/picker/${deviceId}`,
        syncDeviceSoftware: "/DeviceSoftware/sync",
    },
} as const;

export const DeviceSoftwareApi = {
    getDeviceSoftwareByDevice: async (deviceId: number) => {
        const response = await api.get<ApiResponse<DeviceSoftwareDeviceDto[]>>(
            ENDPOINTS.DEVICE_SOFTWARE.getDeviceSoftwareByDevice(deviceId)
        );
        return response.data;
    },

    createDeviceSoftware: async (deviceSoftwareData: CreateUpdateDeviceSoftwareDto) => {
        const response = await api.post<ApiResponse<DeviceSoftwareDeviceDto>>(
            ENDPOINTS.DEVICE_SOFTWARE.createDeviceSoftware,
            deviceSoftwareData
        );
        return response.data;
    },

    // Body needs both deviceId and softwareId.
    updateDeviceSoftware: async (deviceSoftwareData: CreateUpdateDeviceSoftwareDto) => {
        const response = await api.put<ApiResponse<boolean>>(
            ENDPOINTS.DEVICE_SOFTWARE.updateDeviceSoftware,
            deviceSoftwareData
        );
        return response.data;
    },

    // Composite key deviceId + softwareId.
    deleteDeviceSoftware: async (deviceId: number, softwareId: number) => {
        const response = await api.delete<ApiResponse<boolean>>(
            ENDPOINTS.DEVICE_SOFTWARE.deleteDeviceSoftware(deviceId, softwareId)
        );
        return response.data;
    },

    // All software with an isSelected flag, for the checkbox picker.
    getDeviceSoftwarePicker: async (deviceId: number) => {
        const response = await api.get<ApiResponse<DeviceSoftwarePickerDto[]>>(
            ENDPOINTS.DEVICE_SOFTWARE.getDeviceSoftwarePicker(deviceId)
        );
        return response.data;
    },

    // Send the full ticked list; the server computes the diff.
    syncDeviceSoftware: async (syncData: DeviceSoftwareSyncDto) => {
        const response = await api.put<ApiResponse<DeviceSoftwareDeviceDto[]>>(
            ENDPOINTS.DEVICE_SOFTWARE.syncDeviceSoftware,
            syncData
        );
        return response.data;
    },
};

export { ENDPOINTS };
