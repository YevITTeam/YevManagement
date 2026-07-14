import { api } from "@/lib/client";
import type { SoftwareDto } from "@/modules/pc-management/types/software.dto";
import { ApiResponse, ApiResponseWithPageNation } from "@/types/api";

const ENDPOINTS = {
    SOFTWARE: {
        getSoftwarePageNation: "/Software/grid-list",
        getAllSoftware: "/Software/all",
        getSoftwareById: (id: number) => `/Software/${id}`,
        createSoftware: "/Software",
        updateSoftware: (id: number) => `/Software/${id}`,
        deleteSoftware: (id: number) => `/Software/${id}`,
    }
} as const;

export interface GetSoftwarePageNationParams {
    pageIndex?: number;
    pageSize?: number;
    keyword?: string;
}

export const SoftwareApi = {
    getSoftwarePageNation: async (params?: GetSoftwarePageNationParams) => {
        const query = new URLSearchParams();
        if (params?.pageIndex) query.set("PageIndex", String(params.pageIndex));
        if (params?.pageSize) query.set("PageSize", String(params.pageSize));
        if (params?.keyword) query.set("Keyword", params.keyword);
        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.SOFTWARE.getSoftwarePageNation}?${queryString}` : ENDPOINTS.SOFTWARE.getSoftwarePageNation;
        const response = await api.get<ApiResponseWithPageNation<SoftwareDto>>(url);
        return response.data;
    },
    getAllSoftware: async () => {
        const response = await api.get<ApiResponse<SoftwareDto[]>>(ENDPOINTS.SOFTWARE.getAllSoftware);
        return response.data;
    },
    getSoftwareById: async (id: number) => {
        const response = await api.get<ApiResponse<SoftwareDto>>(ENDPOINTS.SOFTWARE.getSoftwareById(id));
        return response.data;
    },
    createSoftware: async (softwareData: Omit<SoftwareDto, "id">) => {
        const response = await api.post<ApiResponse<SoftwareDto>>(ENDPOINTS.SOFTWARE.createSoftware, softwareData);         
        return response.data;
    },
    updateSoftware: async (id: number, softwareData: Partial<SoftwareDto>) => {
        const response = await api.put<ApiResponse<SoftwareDto>>(ENDPOINTS.SOFTWARE.updateSoftware(id), {
            id: id,
            ...softwareData
        });
        return response.data;
    },
    deleteSoftware: async (id: number) => {
        const response = await api.delete<ApiResponse<void>>(ENDPOINTS.SOFTWARE.deleteSoftware(id));
        return response.data;
    }
}