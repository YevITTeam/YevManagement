import { api } from "@/lib/client";
import type { JobTitleDto, CreateUpdateJobTitleDto } from "@/modules/workflow/types/job-title.dto";
import { ApiResponse, ApiResponseWithPageNation } from "@/types/api";

const ENDPOINTS = {
    JOB_TITLE: {
        getJobTitlePageNation: "/Workflow/JobTitle/grid-list",
        getAllJobTitles: "/Workflow/JobTitle/all",
        getJobTitleById: (id: number) => `/Workflow/JobTitle/${id}`,
        createJobTitle: "/Workflow/JobTitle",
        updateJobTitle: (id: number) => `/Workflow/JobTitle/${id}`,
        deleteJobTitle: (id: number) => `/Workflow/JobTitle/${id}`,
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
        const url = queryString
            ? `${ENDPOINTS.JOB_TITLE.getJobTitlePageNation}?${queryString}`
            : ENDPOINTS.JOB_TITLE.getJobTitlePageNation;

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

    createJobTitle: async (data: CreateUpdateJobTitleDto) => {
        const response = await api.post<ApiResponse<JobTitleDto>>(ENDPOINTS.JOB_TITLE.createJobTitle, data);
        return response.data;
    },

    updateJobTitle: async (id: number, data: CreateUpdateJobTitleDto) => {
        const response = await api.put<ApiResponse<boolean>>(ENDPOINTS.JOB_TITLE.updateJobTitle(id), { id, ...data });
        return response.data;
    },

    deleteJobTitle: async (id: number) => {
        const response = await api.delete<ApiResponse<boolean>>(ENDPOINTS.JOB_TITLE.deleteJobTitle(id));
        return response.data;
    },
};

export { ENDPOINTS };
