import { api } from "@/lib/client";
import type { FormDataSourceDto, CreateUpdateFormDataSourceDto } from "@/modules/workflow/types/form-data-source.dto";
import { ApiResponse, ApiResponseWithPageNation } from "@/types/api";

const ENDPOINTS = {
    FORM_DATA_SOURCE: {
        getFormDataSourcePageNation: "/Workflow/FormDataSource/grid-list",
        getAllFormDataSources: "/Workflow/FormDataSource/all",
        getFormDataSourceById: (id: number) => `/Workflow/FormDataSource/${id}`,
        createFormDataSource: "/Workflow/FormDataSource",
        updateFormDataSource: (id: number) => `/Workflow/FormDataSource/${id}`,
        deleteFormDataSource: (id: number) => `/Workflow/FormDataSource/${id}`,
    },
} as const;

export interface GetFormDataSourcePageNationParams {
    pageIndex?: number;
    pageSize?: number;
    keyword?: string;
}

export const FormDataSourceApi = {
    getFormDataSourcePageNation: async (params?: GetFormDataSourcePageNationParams) => {
        const query = new URLSearchParams();
        if (params?.pageIndex) query.set("PageIndex", String(params.pageIndex));
        if (params?.pageSize) query.set("PageSize", String(params.pageSize));
        if (params?.keyword) query.set("Keyword", params.keyword);

        const queryString = query.toString();
        const url = queryString
            ? `${ENDPOINTS.FORM_DATA_SOURCE.getFormDataSourcePageNation}?${queryString}`
            : ENDPOINTS.FORM_DATA_SOURCE.getFormDataSourcePageNation;

        const response = await api.get<ApiResponseWithPageNation<FormDataSourceDto>>(url);
        return response.data;
    },

    getAllFormDataSources: async () => {
        const response = await api.get<ApiResponse<FormDataSourceDto[]>>(ENDPOINTS.FORM_DATA_SOURCE.getAllFormDataSources);
        return response.data;
    },

    getFormDataSourceById: async (id: number) => {
        const response = await api.get<ApiResponse<FormDataSourceDto>>(ENDPOINTS.FORM_DATA_SOURCE.getFormDataSourceById(id));
        return response.data;
    },

    createFormDataSource: async (data: CreateUpdateFormDataSourceDto) => {
        const response = await api.post<ApiResponse<FormDataSourceDto>>(ENDPOINTS.FORM_DATA_SOURCE.createFormDataSource, data);
        return response.data;
    },

    updateFormDataSource: async (id: number, data: CreateUpdateFormDataSourceDto) => {
        const response = await api.put<ApiResponse<boolean>>(ENDPOINTS.FORM_DATA_SOURCE.updateFormDataSource(id), { id, ...data });
        return response.data;
    },

    deleteFormDataSource: async (id: number) => {
        const response = await api.delete<ApiResponse<boolean>>(ENDPOINTS.FORM_DATA_SOURCE.deleteFormDataSource(id));
        return response.data;
    },
};

export { ENDPOINTS };
