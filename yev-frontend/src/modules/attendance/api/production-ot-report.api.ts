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
        officeQryExportExcel: "/ProductionOtReport/office-qry-export-excel",
        officeProductivityGroups: "/ProductionOtReport/office-productivity-groups",
        sumExportData: "/ProductionOtReport/sum-export-data",
        ticketBatch: "/ProductionOtReport/ticket-batch",
    },
} as const;

// `date` is yyyy-MM-dd to bind to DateOnly; departmentId undefined = all departments.
export const ProductionOtReportApi = {
    getTicketReport: async (date: string, departmentId?: number, workshopId?: number) => {
        const params = new URLSearchParams({ date });
        if (departmentId !== undefined) params.set("departmentId", String(departmentId));
        if (workshopId !== undefined) params.set("workshopId", String(workshopId));
        const response = await api.get<ApiResponse<ProductionTicketReportDto>>(
            `${ENDPOINTS.PRODUCTION_OT_REPORT.ticketReport}?${params.toString()}`
        );
        return response.data;
    },
    exportHoursReportExcel: async (date: string, departmentId?: number, workshopId?: number): Promise<BlobDownloadResult> => {
        const params = new URLSearchParams({ date });
        if (departmentId !== undefined) params.set("departmentId", String(departmentId));
        if (workshopId !== undefined) params.set("workshopId", String(workshopId));
        return getForBlob(`${ENDPOINTS.PRODUCTION_OT_REPORT.hoursReportExcel}?${params.toString()}`);
    },
    exportTimesReportExcel: async (date: string, departmentId?: number, workshopId?: number): Promise<BlobDownloadResult> => {
        const params = new URLSearchParams({ date });
        if (departmentId !== undefined) params.set("departmentId", String(departmentId));
        if (workshopId !== undefined) params.set("workshopId", String(workshopId));
        return getForBlob(`${ENDPOINTS.PRODUCTION_OT_REPORT.timesReportExcel}?${params.toString()}`);
    },
    exportQryExportExcel: async (date: string, departmentId?: number, workshopId?: number): Promise<BlobDownloadResult> => {
        const params = new URLSearchParams({ date });
        if (departmentId !== undefined) params.set("departmentId", String(departmentId));
        if (workshopId !== undefined) params.set("workshopId", String(workshopId));
        return getForBlob(`${ENDPOINTS.PRODUCTION_OT_REPORT.qryExportExcel}?${params.toString()}`);
    },
    // Empty groupIds = every Green/Orange group; other picked groups export with NHOM = HC.
    exportOfficeQryExportExcel: async (fromDate: string, toDate: string, workshopId?: number, departmentId?: number, groupIds: number[] = []): Promise<BlobDownloadResult> => {
        const params = new URLSearchParams({ fromDate, toDate });
        if (departmentId !== undefined) params.set("departmentId", String(departmentId));
        if (workshopId !== undefined) params.set("workshopId", String(workshopId));
        groupIds.forEach((id) => params.append("groupIds", String(id)));
        return getForBlob(`${ENDPOINTS.PRODUCTION_OT_REPORT.officeQryExportExcel}?${params.toString()}`);
    },
    getOfficeProductivityGroups: async (workshopId?: number, departmentId?: number) => {
        const params = new URLSearchParams();
        if (departmentId !== undefined) params.set("departmentId", String(departmentId));
        if (workshopId !== undefined) params.set("workshopId", String(workshopId));
        const response = await api.get<ApiResponse<ProductionOptionDto[]>>(
            `${ENDPOINTS.PRODUCTION_OT_REPORT.officeProductivityGroups}?${params.toString()}`
        );
        return response.data;
    },
    exportSumExportData: async (date: string, departmentId?: number, workshopId?: number): Promise<BlobDownloadResult> => {
        const params = new URLSearchParams({ date });
        if (departmentId !== undefined) params.set("departmentId", String(departmentId));
        if (workshopId !== undefined) params.set("workshopId", String(workshopId));
        return getForBlob(`${ENDPOINTS.PRODUCTION_OT_REPORT.sumExportData}?${params.toString()}`);
    },
    getTicketBatch: async (date: string, departmentId?: number, workshopId?: number) => {
        const params = new URLSearchParams({ date });
        if (departmentId !== undefined) params.set("departmentId", String(departmentId));
        if (workshopId !== undefined) params.set("workshopId", String(workshopId));
        const response = await api.get<ApiResponse<ProductionTicketBatchGroupDto[]>>(
            `${ENDPOINTS.PRODUCTION_OT_REPORT.ticketBatch}?${params.toString()}`
        );
        return response.data;
    },
};

export { ENDPOINTS };
