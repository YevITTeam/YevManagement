import { api } from "@/lib/client";
import type { JobTitleDto, ResolveApprovalChainResultDto } from "@/modules/attendance/types/job-title.dto";
import { ApiResponse, ApiResponseWithPageNation } from "@/types/api";

const ENDPOINTS = {
    JOB_TITLE: {
        getJobTitlePageNation: "/JobTitle/grid-list",
        getAllJobTitles: "/JobTitle/all",
        getJobTitleById: (id: number) => `/JobTitle/${id}`,
        createJobTitle: "/JobTitle",
        updateJobTitle: (id: number) => `/JobTitle/${id}`,
        deleteJobTitle: (id: number) => `/JobTitle/${id}`,
        reorderJobTitles: "/JobTitle/reorder",
        resolveChain: "/JobTitle/resolve-chain",
    },
} as const;

export interface GetJobTitlePageNationParams {
    pageIndex?: number;
    pageSize?: number;
    keyword?: string;
}

export const JobTitleApi = {
    getJobTitlePageNation: async (params?: GetJobTitlePageNationParams) => {
        const query = new URLSearchParams();
        if (params?.pageIndex) query.set("PageIndex", String(params.pageIndex));
        if (params?.pageSize) query.set("PageSize", String(params.pageSize));
        if (params?.keyword) query.set("Keyword", params.keyword);

        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.JOB_TITLE.getJobTitlePageNation}?${queryString}` : ENDPOINTS.JOB_TITLE.getJobTitlePageNation;
        const response = await api.get<ApiResponseWithPageNation<JobTitleDto>>(url);
        return response.data;
    },
    getAllJobTitles: async () => {
        const response = await api.get<ApiResponse<JobTitleDto[]>>(ENDPOINTS.JOB_TITLE.getAllJobTitles);
        return response.data;
    },
    getJobTitleById: async (id: number) => {
        const response = await api.get<ApiResponse<JobTitleDto>>(ENDPOINTS.JOB_TITLE.getJobTitleById(id));
        return response.data;
    },
    // rankOrder không còn nhập tay — BE tự gán khi tạo (xếp cuối), chỉnh vị trí qua reorderJobTitles.
    createJobTitle: async (data: Omit<JobTitleDto, "id" | "rankOrder">) => {
        const response = await api.post<ApiResponse<JobTitleDto>>(ENDPOINTS.JOB_TITLE.createJobTitle, data);
        return response.data;
    },
    updateJobTitle: async (id: number, data: Omit<Partial<JobTitleDto>, "rankOrder">) => {
        const response = await api.put<ApiResponse<JobTitleDto>>(ENDPOINTS.JOB_TITLE.updateJobTitle(id), { id, ...data });
        return response.data;
    },
    deleteJobTitle: async (id: number) => {
        const response = await api.delete<ApiResponse<void>>(ENDPOINTS.JOB_TITLE.deleteJobTitle(id));
        return response.data;
    },
    // jobTitleIds: TOÀN BỘ id chức vụ active theo đúng thứ tự mới sau khi kéo-thả (không phải danh
    // sách con) — BE validate khớp đúng tập hợp đang có rồi gán lại rankOrder = 1..N tuần tự.
    reorderJobTitles: async (jobTitleIds: number[]) => {
        const response = await api.put<ApiResponse<JobTitleDto[]>>(ENDPOINTS.JOB_TITLE.reorderJobTitles, { jobTitleIds });
        return response.data;
    },
    resolveChain: async (employeeId: number, otCaseId: number) => {
        const query = new URLSearchParams({ employeeId: String(employeeId), otCaseId: String(otCaseId) });
        const response = await api.get<ApiResponse<ResolveApprovalChainResultDto>>(`${ENDPOINTS.JOB_TITLE.resolveChain}?${query.toString()}`);
        return response.data;
    },
};

export { ENDPOINTS };
