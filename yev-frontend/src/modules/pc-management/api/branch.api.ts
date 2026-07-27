import { api } from "@/lib/client";
import type { BranchDto } from "@/modules/pc-management/types/branch.dto";
import { ApiResponse, ApiResponseWithPageNation } from "@/types/api";


const ENDPOINTS = {
    BRANCH: {
        getBranchPageNation: "/Branch/grid-list",
        getAllBranches: "/Branch/all",
        getBranchById: (branchId: number) => `/Branch/${branchId}`,
        updateBranch: (branchId: number) => `/Branch/${branchId}`,
        deleteBranch: (branchId: number) => `/Branch/${branchId}`,
        createBranch: "/Branch"
    }
} as const;

export interface GetBranchPageNationParams {
    pageIndex?: number;
    pageSize?: number;
    keyword?: string;
}

export const BranchApi = {
    getBranchPageNation: async (params?: GetBranchPageNationParams) => {
        const query = new URLSearchParams();
        if (params?.pageIndex) query.set("PageIndex", String(params.pageIndex));
        if (params?.pageSize) query.set("PageSize", String(params.pageSize));
        if (params?.keyword) query.set("Keyword", params.keyword);

        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.BRANCH.getBranchPageNation}?${queryString}` : ENDPOINTS.BRANCH.getBranchPageNation;
        const response = await api.get<ApiResponseWithPageNation<BranchDto>>(url);
        return response.data;
    },
    getAllBranches: async () => {
        const response = await api.get<ApiResponse<BranchDto[]>>(ENDPOINTS.BRANCH.getAllBranches);
        return response.data;
    },
    getBranchById: async (branchId: number) => {
        const response = await api.get<ApiResponse<BranchDto>>(ENDPOINTS.BRANCH.getBranchById(branchId));
        return response.data;
    },
    updateBranch: async (branchId: number, branchData: Partial<BranchDto>) => {
        const response = await api.put<ApiResponse<BranchDto>>(ENDPOINTS.BRANCH.updateBranch(branchId),
            {
                id: branchId,
                ...branchData
            });
        return response.data;
    },
    deleteBranch: async (branchId: number) => {
        const response = await api.delete<ApiResponse<void>>(ENDPOINTS.BRANCH.deleteBranch(branchId));
        return response.data;
    },
    createBranch: async (branchData: Omit<BranchDto, "id">) => {
        const response = await api.post<ApiResponse<BranchDto>>(ENDPOINTS.BRANCH.createBranch, branchData);
        return response.data;
    }

}

export { ENDPOINTS };   