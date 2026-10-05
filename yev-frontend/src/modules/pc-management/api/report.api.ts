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
    // Empty or omitted = no device type filter; otherwise matches any listed type.
    deviceTypeIds?: number[];
    branchId?: number;
    departmentId?: number;
    groupId?: number;
    // 0 = Chưa sử dụng, 1 = Đang sử dụng; omitted = both.
    status?: number;
}

export const ReportApi = {
    getDeviceListReport: async (params?: GetDeviceListReportParams) => {
        const query = new URLSearchParams();
        params?.deviceTypeIds?.forEach((id) => query.append("DeviceTypeIds", String(id)));
        if (params?.branchId !== undefined) query.set("BranchId", String(params.branchId));
        if (params?.departmentId !== undefined) query.set("DepartmentId", String(params.departmentId));
        if (params?.groupId !== undefined) query.set("GroupId", String(params.groupId));
        if (params?.status !== undefined) query.set("Status", String(params.status));

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
