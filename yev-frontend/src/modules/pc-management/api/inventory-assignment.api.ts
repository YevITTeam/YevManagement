import { api } from "@/lib/client";
import type { InventoryAssignmentDto, SaveInventoryAssignmentDto } from "@/modules/pc-management/types/inventory.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
    ASSIGNMENT: {
        base: "/InventoryAssignment",
        me: "/InventoryAssignment/me",
        byId: (id: number) => `/InventoryAssignment/${id}`,
    },
} as const;

export const InventoryAssignmentApi = {
    getAll: async () => {
        const response = await api.get<ApiResponse<InventoryAssignmentDto[]>>(ENDPOINTS.ASSIGNMENT.base);
        return response.data;
    },
    // Xưởng của chính user đang đăng nhập; data = null nếu chưa được phân công.
    getMine: async () => {
        const response = await api.get<ApiResponse<InventoryAssignmentDto | null>>(ENDPOINTS.ASSIGNMENT.me);
        return response.data;
    },
    // Upsert theo userId — đổi xưởng nếu user đã có phân công.
    save: async (request: SaveInventoryAssignmentDto) => {
        const response = await api.put<ApiResponse<InventoryAssignmentDto>>(ENDPOINTS.ASSIGNMENT.base, request);
        return response.data;
    },
    remove: async (id: number) => {
        const response = await api.delete<ApiResponse<boolean>>(ENDPOINTS.ASSIGNMENT.byId(id));
        return response.data;
    },
};
