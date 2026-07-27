import { api } from "@/lib/client";
import type { SoftwareGroupDto } from "@/modules/pc-management/types/software-group.dto";
import { ApiResponse, ApiResponseWithPageNation } from "@/types/api";

const ENDPOINTS = {
    SOFTWARE_GROUP: {
        getSoftwareGroup: "/SoftwareGroup/grid-list",
        getAllSoftwareGroup: "/SoftwareGroup/all",
        getSoftwareGroupById: (id: number) => `/SoftwareGroup/${id}`,
        createSoftwareGroup: "/SoftwareGroup",
        updateSoftwareGroup: (id: number) => `/SoftwareGroup/${id}`,
        deleteSoftwareGroup: (id: number) => `/SoftwareGroup/${id}`,
    }
} as const;

export interface GetSoftwareGroupPageNationParams {
    pageIndex?: number;
    pageSize?: number;
    keyword?: string;
}

export const SoftwareGroupApi = {
    getSoftwareGroupPageNation: async (params?: GetSoftwareGroupPageNationParams) => {
        const query = new URLSearchParams();
        if (params?.pageIndex) query.set("PageIndex", String(params.pageIndex));
        if (params?.pageSize) query.set("PageSize", String(params.pageSize));
        if (params?.keyword) query.set("Keyword", params.keyword);
        
        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.SOFTWARE_GROUP.getSoftwareGroup}?${queryString}` : ENDPOINTS.SOFTWARE_GROUP.getSoftwareGroup;
        const response = await api.get<ApiResponseWithPageNation<SoftwareGroupDto>>(url);
        return response.data;
    },
    getAllSoftwareGroup: async () => {
        const response = await api.get<ApiResponse<SoftwareGroupDto[]>>(ENDPOINTS.SOFTWARE_GROUP.getAllSoftwareGroup);
        return response.data;
    },
    getSoftwareGroupById: async (id: number) => {
        const response = await api.get<ApiResponse<SoftwareGroupDto>>(ENDPOINTS.SOFTWARE_GROUP.getSoftwareGroupById(id));
        return response.data;
    },
    createSoftwareGroup: async (softwareGroupData: Omit<SoftwareGroupDto, "id">) => {
        const response = await api.post<ApiResponse<SoftwareGroupDto>>(ENDPOINTS.SOFTWARE_GROUP.createSoftwareGroup, softwareGroupData);
        return response.data;
    },
    updateSoftwareGroup: async (id: number, softwareGroupData: Partial<SoftwareGroupDto>) => {
        const response = await api.put<ApiResponse<SoftwareGroupDto>>(ENDPOINTS.SOFTWARE_GROUP.updateSoftwareGroup(id), {
            id: id,
            ...softwareGroupData
        });
        return response.data;
    },
    deleteSoftwareGroup: async (id: number) => {
        const response = await api.delete<ApiResponse<void>>(ENDPOINTS.SOFTWARE_GROUP.deleteSoftwareGroup(id));
        return response.data;
    }
}