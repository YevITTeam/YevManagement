import { api } from "@/lib/client";
import type { UsbFileEventDto, UsbMachineDto, UsbSessionDto } from "@/modules/pc-management/types/usb-log.dto";
import { ApiResponseWithPageNation } from "@/types/api";

// Read-only from FE; the agent writes via POST ingest. Needs Asset.UsbLog.View.
const ENDPOINTS = {
    USB_LOG: {
        getMachines: "/UsbLog/machines",
        getSessions: "/UsbLog/sessions",
        getSessionFiles: (id: string) => `/UsbLog/sessions/${id}/files`,
    },
} as const;

export interface GetUsbSessionsParams {
    pageIndex?: number;
    pageSize?: number;
    deviceId?: number;
    machineName?: string;
    keyword?: string;
    fromDate?: string;
    toDate?: string;
    unpermittedOnly?: boolean;
}

export interface GetUsbMachinesParams {
    pageIndex?: number;
    pageSize?: number;
    keyword?: string;
    fromDate?: string;
    toDate?: string;
    connectedNowOnly?: boolean;
}

export const UsbLogApi = {
    getMachines: async (params?: GetUsbMachinesParams) => {
        const query = new URLSearchParams();
        if (params?.pageIndex) query.set("pageIndex", String(params.pageIndex));
        if (params?.pageSize) query.set("pageSize", String(params.pageSize));
        if (params?.keyword) query.set("keyword", params.keyword);
        if (params?.fromDate) query.set("fromDate", params.fromDate);
        if (params?.toDate) query.set("toDate", params.toDate);
        if (params?.connectedNowOnly) query.set("connectedNowOnly", "true");
        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.USB_LOG.getMachines}?${queryString}` : ENDPOINTS.USB_LOG.getMachines;
        const response = await api.get<ApiResponseWithPageNation<UsbMachineDto>>(url);
        return response.data;
    },
    getSessions: async (params?: GetUsbSessionsParams) => {
        const query = new URLSearchParams();
        if (params?.pageIndex) query.set("pageIndex", String(params.pageIndex));
        if (params?.pageSize) query.set("pageSize", String(params.pageSize));
        if (params?.deviceId !== undefined) query.set("deviceId", String(params.deviceId));
        if (params?.machineName) query.set("machineName", params.machineName);
        if (params?.keyword) query.set("keyword", params.keyword);
        if (params?.fromDate) query.set("fromDate", params.fromDate);
        if (params?.toDate) query.set("toDate", params.toDate);
        if (params?.unpermittedOnly) query.set("unpermittedOnly", "true");
        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.USB_LOG.getSessions}?${queryString}` : ENDPOINTS.USB_LOG.getSessions;
        const response = await api.get<ApiResponseWithPageNation<UsbSessionDto>>(url);
        return response.data;
    },
    getSessionFiles: async (id: string, params?: { pageIndex?: number; pageSize?: number }) => {
        const query = new URLSearchParams();
        if (params?.pageIndex) query.set("pageIndex", String(params.pageIndex));
        if (params?.pageSize) query.set("pageSize", String(params.pageSize));
        const queryString = query.toString();
        const base = ENDPOINTS.USB_LOG.getSessionFiles(id);
        const response = await api.get<ApiResponseWithPageNation<UsbFileEventDto>>(queryString ? `${base}?${queryString}` : base);
        return response.data;
    },
};

export { ENDPOINTS };
