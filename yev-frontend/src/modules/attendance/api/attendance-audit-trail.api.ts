import { api } from "@/lib/client";
import type { AuditTrailDto } from "@/modules/pc-management/types/audit-trail.dto";
import type { GetAuditTrailPageNationParams } from "@/modules/pc-management/api/audit-trail.api";
import type { AttendanceMailLogDto } from "@/modules/attendance/types/attendance-audit-trail.dto";
import { ApiResponseWithPageNation } from "@/types/api";

// Read-only, Admin only (Attendance.AuditTrail.View). Audit rows share Asset's AuditTrailDto shape.
const ENDPOINTS = {
    gridList: "/AttendanceAuditTrail/grid-list",
    mailLogs: "/AttendanceAuditTrail/mail-logs",
} as const;

export interface GetAttendanceMailLogParams {
    pageIndex?: number;
    pageSize?: number;
    // Contains-match on username, email address or subject.
    keyword?: string;
    status?: number;
    fromDate?: string;
    toDate?: string;
}

function toQuery(params: object) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
    });
    const text = query.toString();
    return text ? `?${text}` : "";
}

export const AttendanceAuditTrailApi = {
    getAuditTrailPageNation: async (params: GetAuditTrailPageNationParams) => {
        const response = await api.get<ApiResponseWithPageNation<AuditTrailDto>>(`${ENDPOINTS.gridList}${toQuery(params)}`);
        return response.data;
    },
    getMailLogPageNation: async (params: GetAttendanceMailLogParams) => {
        const response = await api.get<ApiResponseWithPageNation<AttendanceMailLogDto>>(`${ENDPOINTS.mailLogs}${toQuery(params)}`);
        return response.data;
    },
};
