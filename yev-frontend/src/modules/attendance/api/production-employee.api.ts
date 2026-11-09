import { api } from "@/lib/client";
import type {
    ProductionEmployeeSearchItemDto,
    ProductionOptionDto,
} from "@/modules/attendance/types/production-employee.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
    PRODUCTION_EMPLOYEE: {
        search: "/ProductionEmployee/search",
        lineOptions: "/ProductionEmployee/line-options",
        teamOptions: "/ProductionEmployee/team-options",
        shiftTeamOptions: "/ProductionEmployee/shift-team-options",
        congDoanOptions: "/ProductionEmployee/cong-doan-options",
    },
} as const;

export interface ProductionEmployeeSearchParams {
    productionLineId?: number;
    teamId?: number;
    shiftTeamId?: number;
    congDoan?: string;
    keyword?: string;
    // The form's date; required so projected accumulation uses that day/month/year, not today.
    date?: string;
}

export const ProductionEmployeeApi = {
    search: async (params?: ProductionEmployeeSearchParams) => {
        const query = new URLSearchParams();
        if (params?.productionLineId !== undefined) query.set("ProductionLineId", String(params.productionLineId));
        if (params?.teamId !== undefined) query.set("TeamId", String(params.teamId));
        if (params?.shiftTeamId !== undefined) query.set("ShiftTeamId", String(params.shiftTeamId));
        if (params?.congDoan) query.set("CongDoan", params.congDoan);
        if (params?.keyword) query.set("Keyword", params.keyword);
        if (params?.date) query.set("date", params.date);

        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.PRODUCTION_EMPLOYEE.search}?${queryString}` : ENDPOINTS.PRODUCTION_EMPLOYEE.search;
        const response = await api.get<ApiResponse<ProductionEmployeeSearchItemDto[]>>(url);
        return response.data;
    },
    getLineOptions: async (teamId?: number) => {
        const url = teamId !== undefined ? `${ENDPOINTS.PRODUCTION_EMPLOYEE.lineOptions}?TeamId=${teamId}` : ENDPOINTS.PRODUCTION_EMPLOYEE.lineOptions;
        const response = await api.get<ApiResponse<ProductionOptionDto[]>>(url);
        return response.data;
    },
    getTeamOptions: async () => {
        const response = await api.get<ApiResponse<ProductionOptionDto[]>>(ENDPOINTS.PRODUCTION_EMPLOYEE.teamOptions);
        return response.data;
    },
    getShiftTeamOptions: async (productionLineId?: number, teamId?: number) => {
        const query = new URLSearchParams();
        if (productionLineId !== undefined) query.set("ProductionLineId", String(productionLineId));
        if (teamId !== undefined) query.set("TeamId", String(teamId));
        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.PRODUCTION_EMPLOYEE.shiftTeamOptions}?${queryString}` : ENDPOINTS.PRODUCTION_EMPLOYEE.shiftTeamOptions;
        const response = await api.get<ApiResponse<ProductionOptionDto[]>>(url);
        return response.data;
    },
    getCongDoanOptions: async () => {
        const response = await api.get<ApiResponse<string[]>>(ENDPOINTS.PRODUCTION_EMPLOYEE.congDoanOptions);
        return response.data;
    },
};

export { ENDPOINTS };
