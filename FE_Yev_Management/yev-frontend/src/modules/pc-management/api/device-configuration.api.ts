import { api } from "@/lib/client";
import type {
    CreateUpdateDeviceConfigurationDto,
    DeviceConfigurationDto,
    DeviceConfigurationHistoryDto,
    DeviceConfigurationInitialDto,
} from "@/modules/pc-management/types/device-configuration.dto";
import { ApiResponse } from "@/types/api";

// Route /DeviceConfiguration — không có grid-list/all, luôn tra theo deviceId hoặc configId.
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
    // Cấu hình hiện tại của thiết bị. data = null nếu thiết bị chưa nhập cấu hình
    // (bình thường, không phải lỗi — dùng để quyết định hiện form POST hay PUT).
    getConfigurationByDevice: async (deviceId: number) => {
        const response = await api.get<ApiResponse<DeviceConfigurationDto | null>>(
            ENDPOINTS.DEVICE_CONFIGURATION.getConfigurationByDevice(deviceId)
        );
        return response.data;
    },

    // Tạo cấu hình — chỉ 1 lần/thiết bị (gọi lại khi đã có → 400, phải dùng PUT).
    createConfiguration: async (data: CreateUpdateDeviceConfigurationDto) => {
        const response = await api.post<ApiResponse<DeviceConfigurationDto>>(
            ENDPOINTS.DEVICE_CONFIGURATION.createConfiguration,
            data
        );
        return response.data;
    },

    // Sửa cấu hình — không đổi được deviceId. Gửi kèm id trong body để khớp {id}.
    updateConfiguration: async (id: number, data: Partial<CreateUpdateDeviceConfigurationDto>) => {
        const response = await api.put<ApiResponse<DeviceConfigurationDto>>(
            ENDPOINTS.DEVICE_CONFIGURATION.updateConfiguration(id),
            { id, ...data }
        );
        return response.data;
    },

    // Xoá cứng cấu hình — cascade xoá luôn snapshot ban đầu + toàn bộ lịch sử.
    deleteConfiguration: async (id: number) => {
        const response = await api.delete<ApiResponse<void>>(
            ENDPOINTS.DEVICE_CONFIGURATION.deleteConfiguration(id)
        );
        return response.data;
    },

    // Snapshot "cấu hình ban đầu" theo configId (null nếu chưa có).
    getInitialConfiguration: async (configId: number) => {
        const response = await api.get<ApiResponse<DeviceConfigurationInitialDto | null>>(
            ENDPOINTS.DEVICE_CONFIGURATION.getInitialConfiguration(configId)
        );
        return response.data;
    },

    // Xoá riêng snapshot ban đầu (dùng khi nhập nhầm lúc tạo).
    deleteInitialConfiguration: async (id: number) => {
        const response = await api.delete<ApiResponse<void>>(
            ENDPOINTS.DEVICE_CONFIGURATION.deleteInitialConfiguration(id)
        );
        return response.data;
    },

    // Lịch sử sửa chữa/thay thế theo configId (mới nhất trước).
    getConfigurationHistory: async (configId: number) => {
        const response = await api.get<ApiResponse<DeviceConfigurationHistoryDto[]>>(
            ENDPOINTS.DEVICE_CONFIGURATION.getConfigurationHistory(configId)
        );
        return response.data;
    },
};

export { ENDPOINTS };
