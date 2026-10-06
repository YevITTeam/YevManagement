import { api } from "@/lib/client";
import type { OrgUnitDto, OrgUnitTreeDto, CreateUpdateOrgUnitDto, ReorderOrgUnitItemDto } from "@/modules/workflow/types/org-unit.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
    ORG_UNIT: {
        getOrgUnitTree: "/Workflow/OrgUnit/tree",
        getOrgUnitById: (id: number) => `/Workflow/OrgUnit/${id}`,
        createOrgUnit: "/Workflow/OrgUnit",
        updateOrgUnit: (id: number) => `/Workflow/OrgUnit/${id}`,
        deleteOrgUnit: (id: number) => `/Workflow/OrgUnit/${id}`,
        reorderOrgUnits: "/Workflow/OrgUnit/reorder",
    },
} as const;

export const OrgUnitApi = {
    getOrgUnitTree: async () => {
        const response = await api.get<ApiResponse<OrgUnitTreeDto[]>>(ENDPOINTS.ORG_UNIT.getOrgUnitTree);
        return response.data;
    },

    getOrgUnitById: async (id: number) => {
        const response = await api.get<ApiResponse<OrgUnitDto>>(ENDPOINTS.ORG_UNIT.getOrgUnitById(id));
        return response.data;
    },

    createOrgUnit: async (data: CreateUpdateOrgUnitDto) => {
        const response = await api.post<ApiResponse<OrgUnitDto>>(ENDPOINTS.ORG_UNIT.createOrgUnit, data);
        return response.data;
    },

    updateOrgUnit: async (id: number, data: CreateUpdateOrgUnitDto) => {
        const response = await api.put<ApiResponse<boolean>>(ENDPOINTS.ORG_UNIT.updateOrgUnit(id), { id, ...data });
        return response.data;
    },

    deleteOrgUnit: async (id: number) => {
        const response = await api.delete<ApiResponse<boolean>>(ENDPOINTS.ORG_UNIT.deleteOrgUnit(id));
        return response.data;
    },

    reorderOrgUnits: async (items: ReorderOrgUnitItemDto[]) => {
        const response = await api.put<ApiResponse<boolean>>(ENDPOINTS.ORG_UNIT.reorderOrgUnits, { items });
        return response.data;
    },
};

export { ENDPOINTS };
