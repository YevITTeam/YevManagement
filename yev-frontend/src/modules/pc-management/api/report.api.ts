import { api, getForBlob, type BlobDownloadResult } from "@/lib/client";
import type { DeviceListReportItemDto, DeviceReportSummaryDto } from "@/modules/pc-management/types/report.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
    REPORT: {
        getDeviceListReport: "/Report/device-list",
        exportDeviceListReport: "/Report/device-list/export",
        getDeviceReportSummary: "/Report/device-summary",
    }
} as const;

export interface GetDeviceListReportParams {
    // Empty or omitted = no device type filter; otherwise matches any listed type.
    deviceTypeIds?: number[];
    branchId?: number;
    departmentId?: number;
    groupId?: number;
    // 0 = unused, 1 = in use; omitted = both.
    status?: number;
}

function buildDeviceListQuery(params?: GetDeviceListReportParams) {
    const query = new URLSearchParams();
    params?.deviceTypeIds?.forEach((id) => query.append("DeviceTypeIds", String(id)));
    if (params?.branchId !== undefined) query.set("BranchId", String(params.branchId));
    if (params?.departmentId !== undefined) query.set("DepartmentId", String(params.departmentId));
    if (params?.groupId !== undefined) query.set("GroupId", String(params.groupId));
    if (params?.status !== undefined) query.set("Status", String(params.status));
    return query;
}

export const ReportApi = {
    getDeviceListReport: async (params?: GetDeviceListReportParams) => {
        const queryString = buildDeviceListQuery(params).toString();
        const url = queryString ? `${ENDPOINTS.REPORT.getDeviceListReport}?${queryString}` : ENDPOINTS.REPORT.getDeviceListReport;

        const response = await api.get<ApiResponse<DeviceListReportItemDto[]>>(url);
        return response.data;
    },
    // Returns an .xlsx file (not JSON), read with getForBlob(); title is written into the sheet heading.
    exportDeviceListReport: async (params: GetDeviceListReportParams | undefined, title: string): Promise<BlobDownloadResult> => {
        const query = buildDeviceListQuery(params);
        query.set("title", title);
        return getForBlob(`${ENDPOINTS.REPORT.exportDeviceListReport}?${query.toString()}`);
    },
    getDeviceReportSummary: async () => {
        const response = await api.get<ApiResponse<DeviceReportSummaryDto>>(ENDPOINTS.REPORT.getDeviceReportSummary);
        return response.data;
    },
};

export { ENDPOINTS as REPORT_ENDPOINTS };
