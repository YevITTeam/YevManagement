import { api } from "@/lib/client";
import type { DeviceListReportItemDto, DeviceReportSummaryDto } from "@/modules/pc-management/types/report.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
    REPORT: {
        getDeviceListReport: "/Report/device-list",
        getDeviceReportSummary: "/Report/device-summary",
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
    getDeviceReportSummary: async () => {
        const response = await api.get<ApiResponse<DeviceReportSummaryDto>>(ENDPOINTS.REPORT.getDeviceReportSummary);
        return response.data;
    },
};

export { ENDPOINTS as REPORT_ENDPOINTS };
