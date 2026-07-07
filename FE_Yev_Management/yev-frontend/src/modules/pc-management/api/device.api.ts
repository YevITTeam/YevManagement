import { api } from "@/lib/client";
import type { DeviceDto } from "@/modules/pc-management/types/device.dto";
import { ApiResponse, ApiResponseWithPageNation } from "@/types/api";

const ENDPOINTS = {
    DEVICE: {
        getDevicePageNation: "/Device/grid-list",
    }
} as const;

export interface GetDevicePageNationParams {
    pageIndex?: number;
    pageSize?: number;
    deviceCode?: string;
    manager?: string;
    purchaseDate?: string;
    ipAddress?: string;
    supplierName?: string;
    note?: string;
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
        if (params?.supplierName) query.set("SupplierName", params.supplierName);
        if (params?.note) query.set("Note", params.note);

        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.DEVICE.getDevicePageNation}?${queryString}` : ENDPOINTS.DEVICE.getDevicePageNation;

        const response = await api.get<ApiResponseWithPageNation<DeviceDto>>(url);
        return response.data;
    }
};

export { ENDPOINTS };