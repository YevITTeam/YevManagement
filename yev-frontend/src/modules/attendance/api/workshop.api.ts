import { api } from "@/lib/client";
import type { WorkshopDto } from "@/modules/attendance/types/workshop.dto";
import { ApiResponse, ApiResponseWithPageNation } from "@/types/api";

const ENDPOINTS = {
    WORKSHOP: {
        getWorkshopPageNation: "/Workshop/grid-list",
        getAllWorkshops: "/Workshop/all",
        getWorkshopById: (id: number) => `/Workshop/${id}`,
        createWorkshop: "/Workshop",
        updateWorkshop: (id: number) => `/Workshop/${id}`,
        deleteWorkshop: (id: number) => `/Workshop/${id}`,
    },
} as const;

export interface GetWorkshopPageNationParams {
    pageIndex?: number;
    pageSize?: number;
    keyword?: string;
}

export const WorkshopApi = {
    getWorkshopPageNation: async (params?: GetWorkshopPageNationParams) => {
        const query = new URLSearchParams();
        if (params?.pageIndex) query.set("PageIndex", String(params.pageIndex));
        if (params?.pageSize) query.set("PageSize", String(params.pageSize));
        if (params?.keyword) query.set("Keyword", params.keyword);

        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.WORKSHOP.getWorkshopPageNation}?${queryString}` : ENDPOINTS.WORKSHOP.getWorkshopPageNation;
        const response = await api.get<ApiResponseWithPageNation<WorkshopDto>>(url);
        return response.data;
    },
    getAllWorkshops: async () => {
        const response = await api.get<ApiResponse<WorkshopDto[]>>(ENDPOINTS.WORKSHOP.getAllWorkshops);
        return response.data;
    },
    getWorkshopById: async (id: number) => {
        const response = await api.get<ApiResponse<WorkshopDto>>(ENDPOINTS.WORKSHOP.getWorkshopById(id));
        return response.data;
    },
    createWorkshop: async (data: Omit<WorkshopDto, "id">) => {
        const response = await api.post<ApiResponse<WorkshopDto>>(ENDPOINTS.WORKSHOP.createWorkshop, data);
        return response.data;
    },
    updateWorkshop: async (id: number, data: Partial<WorkshopDto>) => {
        const response = await api.put<ApiResponse<WorkshopDto>>(ENDPOINTS.WORKSHOP.updateWorkshop(id), { id, ...data });
        return response.data;
    },
    deleteWorkshop: async (id: number) => {
        const response = await api.delete<ApiResponse<void>>(ENDPOINTS.WORKSHOP.deleteWorkshop(id));
        return response.data;
    },
};

export { ENDPOINTS };
