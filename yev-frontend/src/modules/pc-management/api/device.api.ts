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
    // Exact id match; checked with !== undefined since 0 is a valid id.
    groupId?: number;
    departmentId?: number;
    note?: string;
    isOutsourced?: boolean;
    serialNumber?: string;
    isUseUsb?: boolean;
    // Devices flagged for the daily QR check, to batch-print server-room labels.
    requiresDailyCheck?: boolean;
    branchId?: number;
    deviceTypeId?: number;
    // 0=Unused, 1=In use, 2=Pending liquidation, 3=Liquidated (Asset.Domain.Enums.DeviceStatus).
    status?: number;
    // Expiring on or before this date (yyyy-MM-dd).
    expiryDate?: string;
    sortDeviceCodeAscending?: boolean;
    sortIpAddressAscending?: boolean;
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
        if (params?.requiresDailyCheck !== undefined) query.set("RequiresDailyCheck", String(params.requiresDailyCheck));
        if (params?.branchId !== undefined) query.set("BranchId", String(params.branchId));
        if (params?.deviceTypeId !== undefined) query.set("DeviceTypeId", String(params.deviceTypeId));
        if (params?.status !== undefined) query.set("Status", String(params.status));
        if (params?.expiryDate) query.set("ExpiryDate", params.expiryDate);
        if (params?.sortDeviceCodeAscending !== undefined) query.set("SortDeviceCodeAscending", String(params.sortDeviceCodeAscending));
        if (params?.sortIpAddressAscending !== undefined) query.set("SortIpAddressAscending", String(params.sortIpAddressAscending));

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
    // Unused devices only (status=0), unpaged, for the replacement picker.
    getAvailableDevices: async (keyword?: string) => {
        const query = new URLSearchParams();
        if (keyword) query.set("keyword", keyword);
        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.DEVICE.getAvailableDevices}?${queryString}` : ENDPOINTS.DEVICE.getAvailableDevices;

        const response = await api.get<ApiResponse<DeviceDto[]>>(url);
        return response.data;
    },
    // Prefilled replacement inferred from the Excel old-device-code column; may be null.
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
    // BE preserves the ids order and drops missing/deleted devices.
    getQrLabels: async (ids: number[]) => {
        const response = await api.post<ApiResponse<DeviceQrLabelDto[]>>(ENDPOINTS.DEVICE.getQrLabels, { ids });
        return response.data;
    },
};

export { ENDPOINTS };