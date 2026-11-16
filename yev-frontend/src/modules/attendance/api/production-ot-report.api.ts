import { api, getForBlob, type BlobDownloadResult } from "@/lib/client";
import type { ProductionTicketBatchGroupDto, ProductionTicketReportDto } from "@/modules/attendance/types/production-ot-report.dto";
import type { ProductionOptionDto } from "@/modules/attendance/types/production-employee.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
    PRODUCTION_OT_REPORT: {
        ticketReport: "/ProductionOtReport/ticket-report",
        hoursReportExcel: "/ProductionOtReport/hours-report-excel",
        timesReportExcel: "/ProductionOtReport/times-report-excel",
        qryExportExcel: "/ProductionOtReport/qry-export-excel",
        sumExportData: "/ProductionOtReport/sum-export-data",
        groups: "/ProductionOtReport/groups",
        ticketBatch: "/ProductionOtReport/ticket-batch",
    },
} as const;

// Shared by every report; dates are yyyy-MM-dd (DateOnly), undefined/empty filters = all.
export interface ReportFilter {
    fromDate: string;
    toDate: string;
    workshopId?: number;
    departmentId?: number;
    groupIds?: number[];
}

const toQuery = (filter: ReportFilter) => {
    const params = new URLSearchParams({ fromDate: filter.fromDate, toDate: filter.toDate });
    if (filter.departmentId !== undefined) params.set("departmentId", String(filter.departmentId));
    if (filter.workshopId !== undefined) params.set("workshopId", String(filter.workshopId));
    filter.groupIds?.forEach((id) => params.append("groupIds", String(id)));
    return params.toString();
};

export const ProductionOtReportApi = {
    // One day only (fromDate = toDate).
    getTicketReport: async (filter: ReportFilter) => {
        const response = await api.get<ApiResponse<ProductionTicketReportDto>>(`${ENDPOINTS.PRODUCTION_OT_REPORT.ticketReport}?${toQuery(filter)}`);
        return response.data;
    },
    exportHoursReportExcel: (filter: ReportFilter): Promise<BlobDownloadResult> =>
        getForBlob(`${ENDPOINTS.PRODUCTION_OT_REPORT.hoursReportExcel}?${toQuery(filter)}`),
    exportTimesReportExcel: (filter: ReportFilter): Promise<BlobDownloadResult> =>
        getForBlob(`${ENDPOINTS.PRODUCTION_OT_REPORT.timesReportExcel}?${toQuery(filter)}`),
    exportQryExportExcel: (filter: ReportFilter): Promise<BlobDownloadResult> =>
        getForBlob(`${ENDPOINTS.PRODUCTION_OT_REPORT.qryExportExcel}?${toQuery(filter)}`),
    exportSumExportData: (filter: ReportFilter): Promise<BlobDownloadResult> =>
        getForBlob(`${ENDPOINTS.PRODUCTION_OT_REPORT.sumExportData}?${toQuery(filter)}`),
    getGroups: async (workshopId?: number, departmentId?: number) => {
        const params = new URLSearchParams();
        if (departmentId !== undefined) params.set("departmentId", String(departmentId));
        if (workshopId !== undefined) params.set("workshopId", String(workshopId));
        const response = await api.get<ApiResponse<ProductionOptionDto[]>>(`${ENDPOINTS.PRODUCTION_OT_REPORT.groups}?${params.toString()}`);
        return response.data;
    },
    // One day only (fromDate = toDate).
    getTicketBatch: async (filter: ReportFilter) => {
        const response = await api.get<ApiResponse<ProductionTicketBatchGroupDto[]>>(`${ENDPOINTS.PRODUCTION_OT_REPORT.ticketBatch}?${toQuery(filter)}`);
        return response.data;
    },
};

export { ENDPOINTS };
