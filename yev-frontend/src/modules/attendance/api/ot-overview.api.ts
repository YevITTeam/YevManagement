import { api } from "@/lib/client";
import type { OtOverviewDto } from "@/modules/attendance/types/ot-overview.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
    OT_OVERVIEW: {
        get: "/OtOverview",
        access: "/OtOverview/access",
    },
} as const;

export const OtOverviewApi = {
    getAccess: async () => {
        const response = await api.get<ApiResponse<boolean>>(ENDPOINTS.OT_OVERVIEW.access);
        return response.data;
    },
    get: async (year: number, month: number, workshopId?: number) => {
        const query = new URLSearchParams({ year: String(year), month: String(month) });
        if (workshopId !== undefined) query.set("workshopId", String(workshopId));
        const response = await api.get<ApiResponse<OtOverviewDto>>(`${ENDPOINTS.OT_OVERVIEW.get}?${query.toString()}`);
        return response.data;
    },
};
