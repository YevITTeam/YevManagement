import { api } from "@/lib/client";
import type { DeviceDto,CreateUpdateDeviceDto,DeviceDetailDto,DeviceGetDto,DeviceReplacementSuggestionDto,BulkDeleteResultDto } from "@/modules/pc-management/types/device.dto";
import type { DeviceQrLabelDto } from "@/modules/pc-management/types/device-qr-label.dto";
import { ApiResponse, ApiResponseWithPageNation } from "@/types/api";

const ENDPOINTS = {
    DEVICE: {
        getDevicePageNation: "/Device/grid-list",
        getDeviceById: (id: number) => `/Device/${id}`,
        getDeviceDetailById: (id: number) => `/Device/${id}/detail`,
        getAvailableDevices: "/Device/available",
        getReplacementSuggestion: (oldDeviceId: number) => `/Device/${oldDeviceId}/replacement-suggestion`,
        createDevice: "/Device",
        updateDevice: (id: number) => `/Device/${id}`,
        deleteDevice: (id: number) => `/Device/${id}`,
        bulkDeleteDevices: "/Device/bulk-delete",
        getQrLabels: "/Device/qr-labels",
    }
} as const;

export interface GetDevicePageNationParams {
    pageIndex?: number;
    pageSize?: number;
    deviceCode?: string;
    manager?: string;
    purchaseDate?: string;
    ipAddress?: string;
    email?: string;
    supplierName?: string;
    // Lọc chính xác theo Id Nhóm/Bộ phận (docs/asset-api-fe.md §5.2) — dùng !== undefined vì 0 cũng là Id hợp lệ.
    groupId?: number;
    departmentId?: number;
    note?: string;
    isOutsourced?: boolean;
    serialNumber?: string;
    isUseUsb?: boolean;
    sortDeviceCodeAscending?: boolean;
}

export const DeviceApi = {
    getDevicePageNation: async (params?: GetDevicePageNationParams) => {
        const query = new URLSearchParams();
        if (params?.pageIndex) query.set("PageIndex", String(params.pageIndex));
        if (params?.pageSize) query.set("PageSize", String(params.pageSize));
        if (params?.deviceCode) query.set("DeviceCode", params.deviceCode);
        if (params?.manager) query.set("Manager", params.manager);
        if (params?.purchaseDate) query.set("PurchaseDate", params.purchaseDate);
        if (params?.ipAddress) query.set("IpAddress", params.ipAddress);
        if (params?.email) query.set("Email", params.email);
        if (params?.supplierName) query.set("SupplierName", params.supplierName);
        if (params?.groupId !== undefined) query.set("GroupId", String(params.groupId));
        if (params?.departmentId !== undefined) query.set("DepartmentId", String(params.departmentId));
        if (params?.note) query.set("Note", params.note);
        if (params?.isOutsourced !== undefined) query.set("IsOutsourced", String(params.isOutsourced));
        if (params?.serialNumber) query.set("SerialNumber", params.serialNumber);
        if (params?.isUseUsb !== undefined) query.set("IsUseUsb", String(params.isUseUsb));
        if (params?.sortDeviceCodeAscending !== undefined) query.set("SortDeviceCodeAscending", String(params.sortDeviceCodeAscending));

        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.DEVICE.getDevicePageNation}?${queryString}` : ENDPOINTS.DEVICE.getDevicePageNation;

        const response = await api.get<ApiResponseWithPageNation<DeviceDto>>(url);
        return response.data;
    },
    getDeviceById: async (id: number) => {
        const response = await api.get<ApiResponse<DeviceGetDto>>(ENDPOINTS.DEVICE.getDeviceById(id));
        return response.data;
    },
    getDeviceDetailById: async (id: number) => {
        const response = await api.get<ApiResponse<DeviceDetailDto>>(ENDPOINTS.DEVICE.getDeviceDetailById(id));
        return response.data;
    },
    // Chỉ trả máy đang "Chờ sử dụng" (status=0), không phân trang — dùng cho picker chọn máy mới khi "đổi thiết bị".
    getAvailableDevices: async (keyword?: string) => {
        const query = new URLSearchParams();
        if (keyword) query.set("keyword", keyword);
        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.DEVICE.getAvailableDevices}?${queryString}` : ENDPOINTS.DEVICE.getAvailableDevices;

        const response = await api.get<ApiResponse<DeviceDto[]>>(url);
        return response.data;
    },
    // Gợi ý máy mới điền sẵn cho màn "Chuyển máy", suy ra từ cột "MQL Cũ" lúc import Excel — có thể null (docs/asset-api-fe.md §5.9).
    getReplacementSuggestion: async (oldDeviceId: number) => {
        const response = await api.get<ApiResponse<DeviceReplacementSuggestionDto | null>>(
            ENDPOINTS.DEVICE.getReplacementSuggestion(oldDeviceId)
        );
        return response.data;
    },
    createDevice: async (deviceData: CreateUpdateDeviceDto) => {
        const response = await api.post<ApiResponse<DeviceDto>>(ENDPOINTS.DEVICE.createDevice, deviceData);
        return response.data;
    },
    updateDevice: async (id: number, deviceData: Partial<CreateUpdateDeviceDto>) => {
        const response = await api.put<ApiResponse<DeviceDto>>(ENDPOINTS.DEVICE.updateDevice(id), deviceData);
        return response.data;
    },
    deleteDevice: async (id: number) => {
        const response = await api.delete<ApiResponse<null>>(ENDPOINTS.DEVICE.deleteDevice(id));
        return response.data;
    },
    bulkDeleteDevices: async (ids: number[]) => {
        const response = await api.post<ApiResponse<BulkDeleteResultDto>>(ENDPOINTS.DEVICE.bulkDeleteDevices, { ids });
        return response.data;
    },
    // In tem QR hàng loạt (docs/asset-api-fe.md §5.4b) — giữ đúng thứ tự ids gửi lên,
    // máy không tồn tại/đã xoá bị BE bỏ qua khỏi kết quả.
    getQrLabels: async (ids: number[]) => {
        const response = await api.post<ApiResponse<DeviceQrLabelDto[]>>(ENDPOINTS.DEVICE.getQrLabels, { ids });
        return response.data;
    },
};

export { ENDPOINTS };