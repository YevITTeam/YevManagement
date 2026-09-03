import { api, getForBlob, type BlobDownloadResult } from "@/lib/client";
import type { ProductionTicketReportDto } from "@/modules/attendance/types/production-ot-report.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
    PRODUCTION_OT_REPORT: {
        ticketReport: "/ProductionOtReport/ticket-report",
        hoursReportExcel: "/ProductionOtReport/hours-report-excel",
        timesReportExcel: "/ProductionOtReport/times-report-excel",
    },
} as const;

// date theo định dạng yyyy-MM-dd (khớp DateOnly model binding từ query string ở BE). departmentId
// undefined = mọi Phòng ban (không lọc) — 2026-08-29, theo yêu cầu "chọn chuyền ở phòng ban nào".
export const ProductionOtReportApi = {
    getTicketReport: async (date: string, departmentId?: number) => {
        const params = new URLSearchParams({ date });
        if (departmentId !== undefined) params.set("departmentId", String(departmentId));
        const response = await api.get<ApiResponse<ProductionTicketReportDto>>(
            `${ENDPOINTS.PRODUCTION_OT_REPORT.ticketReport}?${params.toString()}`
        );
        return response.data;
    },
    exportHoursReportExcel: async (date: string, departmentId?: number): Promise<BlobDownloadResult> => {
        const params = new URLSearchParams({ date });
        if (departmentId !== undefined) params.set("departmentId", String(departmentId));
        return getForBlob(`${ENDPOINTS.PRODUCTION_OT_REPORT.hoursReportExcel}?${params.toString()}`);
    },
    exportTimesReportExcel: async (date: string, departmentId?: number): Promise<BlobDownloadResult> => {
        const params = new URLSearchParams({ date });
        if (departmentId !== undefined) params.set("departmentId", String(departmentId));
        return getForBlob(`${ENDPOINTS.PRODUCTION_OT_REPORT.timesReportExcel}?${params.toString()}`);
    },
};

export { ENDPOINTS };
