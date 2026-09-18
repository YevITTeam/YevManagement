import { api, getForBlob, type BlobDownloadResult } from "@/lib/client";
import type {
    EndServerCheckSessionDto,
    NetworkPingResultDto,
    ServerCheckItemDto,
    ServerCheckManualItemDto,
    ServerCheckReportRowDto,
    ServerCheckSessionDto,
} from "@/modules/pc-management/types/server-check.dto";
import { ApiResponse, ApiResponseWithPageNation } from "@/types/api";

const ENDPOINTS = {
    SERVER_CHECK: {
        today: "/ServerCheck/today",
        start: "/ServerCheck/start",
        getById: (id: number) => `/ServerCheck/${id}`,
        scan: (id: number) => `/ServerCheck/${id}/scan`,
        end: (id: number) => `/ServerCheck/${id}/end`,
        manualItems: "/ServerCheck/manual-items",
        gridList: "/ServerCheck/grid-list",
        report: "/ServerCheck/report",
        reportExport: "/ServerCheck/report/export",
        networkPing: "/ServerCheck/network-ping",
    },
} as const;

export interface GetServerCheckPageNationParams {
    pageIndex?: number;
    pageSize?: number;
    fromDate?: string;
    toDate?: string;
}

export const ServerCheckApi = {
    getToday: async () => {
        const response = await api.get<ApiResponse<ServerCheckSessionDto | null>>(ENDPOINTS.SERVER_CHECK.today);
        return response.data;
    },
    start: async () => {
        const response = await api.post<ApiResponse<ServerCheckSessionDto>>(ENDPOINTS.SERVER_CHECK.start, {});
        return response.data;
    },
    getById: async (id: number) => {
        const response = await api.get<ApiResponse<ServerCheckSessionDto>>(ENDPOINTS.SERVER_CHECK.getById(id));
        return response.data;
    },
    scan: async (id: number, deviceCode: string) => {
        const response = await api.post<ApiResponse<ServerCheckItemDto>>(ENDPOINTS.SERVER_CHECK.scan(id), { deviceCode });
        return response.data;
    },
    end: async (id: number, request: EndServerCheckSessionDto) => {
        const response = await api.post<ApiResponse<ServerCheckSessionDto>>(ENDPOINTS.SERVER_CHECK.end(id), request);
        return response.data;
    },
    getManualItems: async () => {
        const response = await api.get<ApiResponse<ServerCheckManualItemDto[]>>(ENDPOINTS.SERVER_CHECK.manualItems);
        return response.data;
    },
    getPageNation: async (params?: GetServerCheckPageNationParams) => {
        const query = new URLSearchParams();
        if (params?.pageIndex) query.set("PageIndex", String(params.pageIndex));
        if (params?.pageSize) query.set("PageSize", String(params.pageSize));
        if (params?.fromDate) query.set("FromDate", params.fromDate);
        if (params?.toDate) query.set("ToDate", params.toDate);
        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.SERVER_CHECK.gridList}?${queryString}` : ENDPOINTS.SERVER_CHECK.gridList;
        const response = await api.get<ApiResponseWithPageNation<ServerCheckSessionDto>>(url);
        return response.data;
    },
    getReport: async (fromDate: string, toDate: string) => {
        const query = new URLSearchParams({ fromDate, toDate });
        const response = await api.get<ApiResponse<ServerCheckReportRowDto[]>>(`${ENDPOINTS.SERVER_CHECK.report}?${query.toString()}`);
        return response.data;
    },
    // Trả file .xlsx điền sẵn vào ĐÚNG file mẫu giấy gốc (YEV–22–CV–IT-QD-810-FR-Check Sheet KT) —
    // không phải JSON, đọc bằng getForBlob() (asset-module.md §1.19).
    exportReport: async (fromDate: string, toDate: string): Promise<BlobDownloadResult> => {
        const query = new URLSearchParams({ fromDate, toDate });
        return getForBlob(`${ENDPOINTS.SERVER_CHECK.reportExport}?${query.toString()}`);
    },
    pingNetwork: async () => {
        const response = await api.get<ApiResponse<NetworkPingResultDto>>(ENDPOINTS.SERVER_CHECK.networkPing);
        return response.data;
    },
};
