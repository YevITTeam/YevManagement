import { api, getForBlob, type BlobDownloadResult } from "@/lib/client";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
    GENERAL_AFFAIRS_REPORT: {
        excel: "/GeneralAffairsReport/excel",
        sendNow: "/GeneralAffairsReport/send-now",
    },
} as const;

export const GeneralAffairsReportApi = {
    // Completed office forms only; dates are yyyy-MM-dd, both ends included.
    exportExcel: async (fromDate: string, toDate: string, workshopId?: number, departmentId?: number): Promise<BlobDownloadResult> => {
        const params = new URLSearchParams({ fromDate, toDate });
        if (workshopId) params.set("workshopId", String(workshopId));
        if (departmentId) params.set("departmentId", String(departmentId));
        return getForBlob(`${ENDPOINTS.GENERAL_AFFAIRS_REPORT.excel}?${params.toString()}`);
    },
    // Sends every OT date with new or changed forms now; returns how many mails were queued. Requires Attendance.Setting.Update.
    sendNow: async () => {
        const response = await api.post<ApiResponse<number>>(ENDPOINTS.GENERAL_AFFAIRS_REPORT.sendNow);
        return response.data;
    },
};

export { ENDPOINTS };
