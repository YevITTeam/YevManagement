import { api } from "@/lib/client";
import type { ReasonDto } from "@/modules/attendance/types/reason.dto";
import { ApiResponse, ApiResponseWithPageNation } from "@/types/api";

const ENDPOINTS = {
    REASON: {
        getReasonPageNation: "/Reason/grid-list",
        getAllReasons: "/Reason/all",
        getReasonById: (id: number) => `/Reason/${id}`,
        createReason: "/Reason",
        updateReason: (id: number) => `/Reason/${id}`,
        deleteReason: (id: number) => `/Reason/${id}`,
    },
} as const;

export interface GetReasonPageNationParams {
    pageIndex?: number;
    pageSize?: number;
    keyword?: string;
}

export const ReasonApi = {
    getReasonPageNation: async (params?: GetReasonPageNationParams) => {
        const query = new URLSearchParams();
        if (params?.pageIndex) query.set("PageIndex", String(params.pageIndex));
        if (params?.pageSize) query.set("PageSize", String(params.pageSize));
        if (params?.keyword) query.set("Keyword", params.keyword);

        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.REASON.getReasonPageNation}?${queryString}` : ENDPOINTS.REASON.getReasonPageNation;
        const response = await api.get<ApiResponseWithPageNation<ReasonDto>>(url);
        return response.data;
    },
    getAllReasons: async () => {
        const response = await api.get<ApiResponse<ReasonDto[]>>(ENDPOINTS.REASON.getAllReasons);
        return response.data;
    },
    getReasonById: async (id: number) => {
        const response = await api.get<ApiResponse<ReasonDto>>(ENDPOINTS.REASON.getReasonById(id));
        return response.data;
    },
    createReason: async (data: Omit<ReasonDto, "id">) => {
        const response = await api.post<ApiResponse<ReasonDto>>(ENDPOINTS.REASON.createReason, data);
        return response.data;
    },
    updateReason: async (id: number, data: Partial<ReasonDto>) => {
        const response = await api.put<ApiResponse<ReasonDto>>(ENDPOINTS.REASON.updateReason(id), { id, ...data });
        return response.data;
    },
    deleteReason: async (id: number) => {
        const response = await api.delete<ApiResponse<void>>(ENDPOINTS.REASON.deleteReason(id));
        return response.data;
    },
};

export { ENDPOINTS };
