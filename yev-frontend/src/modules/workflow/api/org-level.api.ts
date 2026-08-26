import { api } from "@/lib/client";
import type { OrgLevelDto, CreateUpdateOrgLevelDto } from "@/modules/workflow/types/org-level.dto";
import { ApiResponse, ApiResponseWithPageNation } from "@/types/api";

// Tiền tố "/Workflow" bắt buộc: BE dùng api/Workflow/[controller] để tránh trùng route với
// Attendance.EmployeeController/JobTitleController (workflow-module.md §1.7).
const ENDPOINTS = {
    ORG_LEVEL: {
        getOrgLevelPageNation: "/Workflow/OrgLevel/grid-list",
        getAllOrgLevels: "/Workflow/OrgLevel/all",
        getOrgLevelById: (id: number) => `/Workflow/OrgLevel/${id}`,
        createOrgLevel: "/Workflow/OrgLevel",
        updateOrgLevel: (id: number) => `/Workflow/OrgLevel/${id}`,
        deleteOrgLevel: (id: number) => `/Workflow/OrgLevel/${id}`,
    },
} as const;

export interface GetOrgLevelPageNationParams {
    pageIndex?: number;
    pageSize?: number;
    keyword?: string;
}

export const OrgLevelApi = {
    getOrgLevelPageNation: async (params?: GetOrgLevelPageNationParams) => {
        const query = new URLSearchParams();
        if (params?.pageIndex) query.set("PageIndex", String(params.pageIndex));
        if (params?.pageSize) query.set("PageSize", String(params.pageSize));
        if (params?.keyword) query.set("Keyword", params.keyword);

        const queryString = query.toString();
        const url = queryString
            ? `${ENDPOINTS.ORG_LEVEL.getOrgLevelPageNation}?${queryString}`
            : ENDPOINTS.ORG_LEVEL.getOrgLevelPageNation;

        const response = await api.get<ApiResponseWithPageNation<OrgLevelDto>>(url);
        return response.data;
    },

    getAllOrgLevels: async () => {
        const response = await api.get<ApiResponse<OrgLevelDto[]>>(ENDPOINTS.ORG_LEVEL.getAllOrgLevels);
        return response.data;
    },

    getOrgLevelById: async (id: number) => {
        const response = await api.get<ApiResponse<OrgLevelDto>>(ENDPOINTS.ORG_LEVEL.getOrgLevelById(id));
        return response.data;
    },

    createOrgLevel: async (data: CreateUpdateOrgLevelDto) => {
        const response = await api.post<ApiResponse<OrgLevelDto>>(ENDPOINTS.ORG_LEVEL.createOrgLevel, data);
        return response.data;
    },

    updateOrgLevel: async (id: number, data: CreateUpdateOrgLevelDto) => {
        const response = await api.put<ApiResponse<boolean>>(ENDPOINTS.ORG_LEVEL.updateOrgLevel(id), { id, ...data });
        return response.data;
    },

    deleteOrgLevel: async (id: number) => {
        const response = await api.delete<ApiResponse<boolean>>(ENDPOINTS.ORG_LEVEL.deleteOrgLevel(id));
        return response.data;
    },
};

export { ENDPOINTS };
