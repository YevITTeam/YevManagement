import { api, getForBlob, type BlobDownloadResult } from "@/lib/client";
import type { ProductionTicketBatchGroupDto, ProductionTicketReportDto } from "@/modules/attendance/types/production-ot-report.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
    PRODUCTION_OT_REPORT: {
        ticketReport: "/ProductionOtReport/ticket-report",
        hoursReportExcel: "/ProductionOtReport/hours-report-excel",
        timesReportExcel: "/ProductionOtReport/times-report-excel",
        qryExportExcel: "/ProductionOtReport/qry-export-excel",
        sumExportData: "/ProductionOtReport/sum-export-data",
        ticketBatch: "/ProductionOtReport/ticket-batch",
    },
} as const;

// date theo định dạng yyyy-MM-dd (khớp DateOnly model binding từ query string ở BE). departmentId
// undefined = mọi Phòng ban (không lọc) — 2026-08-29, theo yêu cầu "chọn chuyền ở phòng ban nào".
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
