import { api } from "@/lib/client";
import type {
    ProductionEmployeeListItemDto,
    ProductionEmployeeSearchItemDto,
    ProductionOptionDto,
} from "@/modules/attendance/types/production-employee.dto";
import { ApiResponse, ApiResponseWithPageNation } from "@/types/api";

const ENDPOINTS = {
    PRODUCTION_EMPLOYEE: {
        search: "/ProductionEmployee/search",
        lineOptions: "/ProductionEmployee/line-options",
        teamOptions: "/ProductionEmployee/team-options",
        shiftTeamOptions: "/ProductionEmployee/shift-team-options",
        pageNation: "/ProductionEmployee/page-nation",
    },
} as const;

export interface GetProductionEmployeePageNationParams {
    pageIndex?: number;
    pageSize?: number;
    keyword?: string;
    productionLineId?: number;
    teamId?: number;
    shiftTeamId?: number;
    departmentId?: number;
}

export interface ProductionEmployeeSearchParams {
    productionLineId?: number;
    teamId?: number;
    shiftTeamId?: number;
    congDoan?: string;
    keyword?: string;
    // Ngày trên đơn đang tạo — BẮT BUỘC truyền để lũy kế Dự kiến (projectedDayToDate/MonthToDate/
    // YearToDate) scope đúng ngày/tháng/năm của đơn đó, không phải hôm nay thực tế (mirror
    // EmployeeApi.getEmployeesByGroup, 2026-08-26).
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
    getPageNation: async (params?: GetProductionEmployeePageNationParams) => {
        const query = new URLSearchParams();
        if (params?.pageIndex) query.set("PageIndex", String(params.pageIndex));
        if (params?.pageSize) query.set("PageSize", String(params.pageSize));
        if (params?.keyword) query.set("Keyword", params.keyword);
        if (params?.productionLineId !== undefined) query.set("ProductionLineId", String(params.productionLineId));
        if (params?.teamId !== undefined) query.set("TeamId", String(params.teamId));
        if (params?.shiftTeamId !== undefined) query.set("ShiftTeamId", String(params.shiftTeamId));
        if (params?.departmentId !== undefined) query.set("DepartmentId", String(params.departmentId));

        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.PRODUCTION_EMPLOYEE.pageNation}?${queryString}` : ENDPOINTS.PRODUCTION_EMPLOYEE.pageNation;
        const response = await api.get<ApiResponseWithPageNation<ProductionEmployeeListItemDto>>(url);
        return response.data;
    },
};

export { ENDPOINTS };
