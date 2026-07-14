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
    // Danh sách phần mềm đã cài trên 1 thiết bị.
    getDeviceSoftwareByDevice: async (deviceId: number) => {
        const response = await api.get<ApiResponse<DeviceSoftwareDeviceDto[]>>(
            ENDPOINTS.DEVICE_SOFTWARE.getDeviceSoftwareByDevice(deviceId)
        );
        return response.data;
    },

    // Thêm 1 phần mềm vào thiết bị (đơn lẻ).
    createDeviceSoftware: async (deviceSoftwareData: CreateUpdateDeviceSoftwareDto) => {
        const response = await api.post<ApiResponse<DeviceSoftwareDeviceDto>>(
            ENDPOINTS.DEVICE_SOFTWARE.createDeviceSoftware,
            deviceSoftwareData
        );
        return response.data;
    },

    // Sửa key/ngày cài của 1 phần mềm đã cài (đơn lẻ). Body cần đủ deviceId + softwareId.
    updateDeviceSoftware: async (deviceSoftwareData: CreateUpdateDeviceSoftwareDto) => {
        const response = await api.put<ApiResponse<boolean>>(
            ENDPOINTS.DEVICE_SOFTWARE.updateDeviceSoftware,
            deviceSoftwareData
        );
        return response.data;
    },

    // Gỡ 1 phần mềm khỏi thiết bị (khoá kép deviceId + softwareId).
    deleteDeviceSoftware: async (deviceId: number, softwareId: number) => {
        const response = await api.delete<ApiResponse<boolean>>(
            ENDPOINTS.DEVICE_SOFTWARE.deleteDeviceSoftware(deviceId, softwareId)
        );
        return response.data;
    },

    // Danh sách toàn bộ phần mềm kèm cờ isSelected — dựng dialog picker checkbox.
    getDeviceSoftwarePicker: async (deviceId: number) => {
        const response = await api.get<ApiResponse<DeviceSoftwarePickerDto[]>>(
            ENDPOINTS.DEVICE_SOFTWARE.getDeviceSoftwarePicker(deviceId)
        );
        return response.data;
    },

    // Lưu hàng loạt sau khi tick — gửi toàn bộ danh sách đang tick, server tự tính diff.
    syncDeviceSoftware: async (syncData: DeviceSoftwareSyncDto) => {
        const response = await api.put<ApiResponse<DeviceSoftwareDeviceDto[]>>(
            ENDPOINTS.DEVICE_SOFTWARE.syncDeviceSoftware,
            syncData
        );
        return response.data;
    },
};

export { ENDPOINTS };
