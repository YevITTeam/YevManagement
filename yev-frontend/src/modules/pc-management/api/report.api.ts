import { api } from "@/lib/client";
import type { DeviceListReportItemDto } from "@/modules/pc-management/types/report.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
    REPORT: {
        getDeviceListReport: "/Report/device-list",
    }
} as const;

export interface GetDeviceListReportParams {
    deviceTypeId?: number;
    branchId?: number;
    keyword?: string;
}

export const ReportApi = {
    getDeviceListReport: async (params?: GetDeviceListReportParams) => {
        const query = new URLSearchParams();
        if (params?.deviceTypeId !== undefined) query.set("DeviceTypeId", String(params.deviceTypeId));
        if (params?.branchId !== undefined) query.set("BranchId", String(params.branchId));
        if (params?.keyword) query.set("Keyword", params.keyword);

        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.REPORT.getDeviceListReport}?${queryString}` : ENDPOINTS.REPORT.getDeviceListReport;

        const response = await api.get<ApiResponse<DeviceListReportItemDto[]>>(url);
        return response.data;
    },
};

export { ENDPOINTS as REPORT_ENDPOINTS };
