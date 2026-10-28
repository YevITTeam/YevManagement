import { api } from "@/lib/client";
import type { GroupDto } from "@/modules/attendance/types/group.dto";
import { ApiResponse, ApiResponseWithPageNation } from "@/types/api";

const ENDPOINTS = {
    GROUP: {
        getGroupPageNation: "/Group/grid-list",
        getAllGroups: "/Group/all",
        getGroupById: (id: number) => `/Group/${id}`,
        // Route riêng, KHÁC cách DeviceGroup dùng query-param ?departmentId= trên /all (docs/attendance-module.md §API).
        getGroupsByDepartment: (departmentId: number, workshopId?: number) =>
            `/Group/by-department/${departmentId}${workshopId ? `?workshopId=${workshopId}` : ""}`,
        createGroup: "/Group",
        updateGroup: (id: number) => `/Group/${id}`,
        deleteGroup: (id: number) => `/Group/${id}`,
    },
} as const;

export interface GetGroupPageNationParams {
    pageIndex?: number;
    pageSize?: number;
    keyword?: string;
    workshopId?: number;
}

export interface CreateUpdateGroupDto {
    groupCode: string;
    groupNameVn: string;
    groupNameJp: string | null;
    departmentId: number;
    workshopId: number;
}

export const GroupApi = {
    getGroupPageNation: async (params?: GetGroupPageNationParams) => {
        const query = new URLSearchParams();
        if (params?.pageIndex) query.set("PageIndex", String(params.pageIndex));
        if (params?.pageSize) query.set("PageSize", String(params.pageSize));
        if (params?.keyword) query.set("Keyword", params.keyword);
        if (params?.workshopId) query.set("WorkshopId", String(params.workshopId));

        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.GROUP.getGroupPageNation}?${queryString}` : ENDPOINTS.GROUP.getGroupPageNation;
        const response = await api.get<ApiResponseWithPageNation<GroupDto>>(url);
        return response.data;
    },
    getAllGroups: async () => {
        const response = await api.get<ApiResponse<GroupDto[]>>(ENDPOINTS.GROUP.getAllGroups);
        return response.data;
    },
    getGroupById: async (id: number) => {
        const response = await api.get<ApiResponse<GroupDto>>(ENDPOINTS.GROUP.getGroupById(id));
        return response.data;
    },
    // Cascading dropdown Bộ phận theo Phòng ban đã chọn (docs/attendance-module.md §API).
    getGroupsByDepartment: async (departmentId: number, workshopId?: number) => {
        const response = await api.get<ApiResponse<GroupDto[]>>(ENDPOINTS.GROUP.getGroupsByDepartment(departmentId, workshopId));
        return response.data;
    },
    createGroup: async (data: CreateUpdateGroupDto) => {
        const response = await api.post<ApiResponse<GroupDto>>(ENDPOINTS.GROUP.createGroup, data);
        return response.data;
    },
    updateGroup: async (id: number, data: CreateUpdateGroupDto) => {
        const response = await api.put<ApiResponse<GroupDto>>(ENDPOINTS.GROUP.updateGroup(id), { id, ...data });
        return response.data;
    },
    deleteGroup: async (id: number) => {
        const response = await api.delete<ApiResponse<void>>(ENDPOINTS.GROUP.deleteGroup(id));
        return response.data;
    },
};

export { ENDPOINTS };
