import { api, getForBlob, type BlobDownloadResult } from "@/lib/client";
import type {
    EndInventorySessionDto,
    InventoryReportRowDto,
    InventorySessionDto,
    InventorySessionItemDto,
} from "@/modules/pc-management/types/inventory.dto";
import { ApiResponse, ApiResponseWithPageNation } from "@/types/api";

const ENDPOINTS = {
    INVENTORY: {
        current: "/Inventory/current",
        start: "/Inventory/start",
        getById: (id: number) => `/Inventory/${id}`,
        scan: (id: number) => `/Inventory/${id}/scan`,
        end: (id: number) => `/Inventory/${id}/end`,
        gridList: "/Inventory/grid-list",
        report: "/Inventory/report",
        reportExport: "/Inventory/report/export",
    },
} as const;

export interface GetInventoryPageNationParams {
    pageIndex?: number;
    pageSize?: number;
    fromDate?: string;
    toDate?: string;
    branchId?: number;
}

export const InventoryApi = {
    // Phiên InProgress của xưởng chính người gọi được phân công — không nhận branchId (asset-module.md §1.22).
    getCurrent: async () => {
        const response = await api.get<ApiResponse<InventorySessionDto | null>>(ENDPOINTS.INVENTORY.current);
        return response.data;
    },
    start: async () => {
        const response = await api.post<ApiResponse<InventorySessionDto>>(ENDPOINTS.INVENTORY.start, {});
        return response.data;
    },
    getById: async (id: number) => {
        const response = await api.get<ApiResponse<InventorySessionDto>>(ENDPOINTS.INVENTORY.getById(id));
        return response.data;
    },
    scan: async (id: number, deviceCode: string) => {
        const response = await api.post<ApiResponse<InventorySessionItemDto>>(ENDPOINTS.INVENTORY.scan(id), { deviceCode });
        return response.data;
    },
    end: async (id: number, request: EndInventorySessionDto) => {
        const response = await api.post<ApiResponse<InventorySessionDto>>(ENDPOINTS.INVENTORY.end(id), request);
        return response.data;
    },
    getPageNation: async (params?: GetInventoryPageNationParams) => {
        const query = new URLSearchParams();
        if (params?.pageIndex) query.set("PageIndex", String(params.pageIndex));
        if (params?.pageSize) query.set("PageSize", String(params.pageSize));
        if (params?.fromDate) query.set("FromDate", params.fromDate);
        if (params?.toDate) query.set("ToDate", params.toDate);
        if (params?.branchId !== undefined) query.set("BranchId", String(params.branchId));
        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.INVENTORY.gridList}?${queryString}` : ENDPOINTS.INVENTORY.gridList;
        const response = await api.get<ApiResponseWithPageNation<InventorySessionDto>>(url);
        return response.data;
    },
    getReport: async (fromDate: string, toDate: string, branchId?: number) => {
        const query = new URLSearchParams({ fromDate, toDate });
        if (branchId !== undefined) query.set("branchId", String(branchId));
        const response = await api.get<ApiResponse<InventoryReportRowDto[]>>(`${ENDPOINTS.INVENTORY.report}?${query.toString()}`);
        return response.data;
    },
    // Trả file .xlsx do BE tự dựng (không có file mẫu công ty, khác ServerCheck) — đọc bằng getForBlob()
    // (asset-module.md §1.22).
    exportReport: async (fromDate: string, toDate: string, branchId?: number): Promise<BlobDownloadResult> => {
        const query = new URLSearchParams({ fromDate, toDate });
        if (branchId !== undefined) query.set("branchId", String(branchId));
        return getForBlob(`${ENDPOINTS.INVENTORY.reportExport}?${query.toString()}`);
    },
};
