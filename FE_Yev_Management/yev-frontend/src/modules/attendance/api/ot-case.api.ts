import { api } from "@/lib/client";
import type { OtCaseDto } from "@/modules/attendance/types/ot-case.dto";
import { ApiResponse, ApiResponseWithPageNation } from "@/types/api";

const ENDPOINTS = {
    OT_CASE: {
        getOtCasePageNation: "/OtCase/grid-list",
        getAllOtCases: "/OtCase/all",
        getOtCaseById: (id: number) => `/OtCase/${id}`,
        createOtCase: "/OtCase",
        updateOtCase: (id: number) => `/OtCase/${id}`,
        deleteOtCase: (id: number) => `/OtCase/${id}`,
    },
} as const;

export interface GetOtCasePageNationParams {
    pageIndex?: number;
    pageSize?: number;
    keyword?: string;
}

export const OtCaseApi = {
    getOtCasePageNation: async (params?: GetOtCasePageNationParams) => {
        const query = new URLSearchParams();
        if (params?.pageIndex) query.set("PageIndex", String(params.pageIndex));
        if (params?.pageSize) query.set("PageSize", String(params.pageSize));
        if (params?.keyword) query.set("Keyword", params.keyword);

        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.OT_CASE.getOtCasePageNation}?${queryString}` : ENDPOINTS.OT_CASE.getOtCasePageNation;
        const response = await api.get<ApiResponseWithPageNation<OtCaseDto>>(url);
        return response.data;
    },
    getAllOtCases: async () => {
        const response = await api.get<ApiResponse<OtCaseDto[]>>(ENDPOINTS.OT_CASE.getAllOtCases);
        return response.data;
    },
    getOtCaseById: async (id: number) => {
        const response = await api.get<ApiResponse<OtCaseDto>>(ENDPOINTS.OT_CASE.getOtCaseById(id));
        return response.data;
    },
    createOtCase: async (data: Omit<OtCaseDto, "id">) => {
        const response = await api.post<ApiResponse<OtCaseDto>>(ENDPOINTS.OT_CASE.createOtCase, data);
        return response.data;
    },
    updateOtCase: async (id: number, data: Partial<OtCaseDto>) => {
        const response = await api.put<ApiResponse<OtCaseDto>>(ENDPOINTS.OT_CASE.updateOtCase(id), { id, ...data });
        return response.data;
    },
    deleteOtCase: async (id: number) => {
        const response = await api.delete<ApiResponse<void>>(ENDPOINTS.OT_CASE.deleteOtCase(id));
        return response.data;
    },
};

export { ENDPOINTS };
