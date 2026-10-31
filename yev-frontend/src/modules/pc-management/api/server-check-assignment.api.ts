import { api } from "@/lib/client";
import type { SaveServerCheckAssignmentDto, ServerCheckAssignmentDto } from "@/modules/pc-management/types/server-check.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
    ASSIGNMENT: {
        base: "/ServerCheckAssignment",
        me: "/ServerCheckAssignment/me",
        byId: (id: number) => `/ServerCheckAssignment/${id}`,
    },
} as const;

export const ServerCheckAssignmentApi = {
    getAll: async () => {
        const response = await api.get<ApiResponse<ServerCheckAssignmentDto[]>>(ENDPOINTS.ASSIGNMENT.base);
        return response.data;
    },
    // null if the current user has no assignment.
    getMine: async () => {
        const response = await api.get<ApiResponse<ServerCheckAssignmentDto | null>>(ENDPOINTS.ASSIGNMENT.me);
        return response.data;
    },
    // Upsert by userId; replaces the existing branch.
    save: async (request: SaveServerCheckAssignmentDto) => {
        const response = await api.put<ApiResponse<ServerCheckAssignmentDto>>(ENDPOINTS.ASSIGNMENT.base, request);
        return response.data;
    },
    remove: async (id: number) => {
        const response = await api.delete<ApiResponse<boolean>>(ENDPOINTS.ASSIGNMENT.byId(id));
        return response.data;
    },
};
