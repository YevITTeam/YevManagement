import { api } from "@/lib/client";
import type { FormCategoryDto, CreateUpdateFormCategoryDto } from "@/modules/workflow/types/form-category.dto";
import type { FormCategoryCoordinatorDto } from "@/modules/workflow/types/form-category-coordinator.dto";
import { ApiResponse, ApiResponseWithPageNation } from "@/types/api";

// Tiền tố "/Workflow" bắt buộc (workflow-module.md §1.7).
const ENDPOINTS = {
    FORM_CATEGORY: {
        getFormCategoryPageNation: "/Workflow/FormCategory/grid-list",
        getAllFormCategories: "/Workflow/FormCategory/all",
        getFormCategoryById: (id: number) => `/Workflow/FormCategory/${id}`,
        createFormCategory: "/Workflow/FormCategory",
        updateFormCategory: (id: number) => `/Workflow/FormCategory/${id}`,
        deleteFormCategory: (id: number) => `/Workflow/FormCategory/${id}`,
        getCoordinators: (id: number) => `/Workflow/FormCategory/${id}/coordinators`,
        replaceCoordinators: (id: number) => `/Workflow/FormCategory/${id}/coordinators`,
    },
} as const;

export interface GetFormCategoryPageNationParams {
    pageIndex?: number;
    pageSize?: number;
    keyword?: string;
}

export const FormCategoryApi = {
    getFormCategoryPageNation: async (params?: GetFormCategoryPageNationParams) => {
        const query = new URLSearchParams();
        if (params?.pageIndex) query.set("PageIndex", String(params.pageIndex));
        if (params?.pageSize) query.set("PageSize", String(params.pageSize));
        if (params?.keyword) query.set("Keyword", params.keyword);

        const queryString = query.toString();
        const url = queryString
            ? `${ENDPOINTS.FORM_CATEGORY.getFormCategoryPageNation}?${queryString}`
            : ENDPOINTS.FORM_CATEGORY.getFormCategoryPageNation;

        const response = await api.get<ApiResponseWithPageNation<FormCategoryDto>>(url);
        return response.data;
    },

    getAllFormCategories: async () => {
        const response = await api.get<ApiResponse<FormCategoryDto[]>>(ENDPOINTS.FORM_CATEGORY.getAllFormCategories);
        return response.data;
    },

    getFormCategoryById: async (id: number) => {
        const response = await api.get<ApiResponse<FormCategoryDto>>(ENDPOINTS.FORM_CATEGORY.getFormCategoryById(id));
        return response.data;
    },

    createFormCategory: async (data: CreateUpdateFormCategoryDto) => {
        const response = await api.post<ApiResponse<FormCategoryDto>>(ENDPOINTS.FORM_CATEGORY.createFormCategory, data);
        return response.data;
    },

    updateFormCategory: async (id: number, data: CreateUpdateFormCategoryDto) => {
        const response = await api.put<ApiResponse<boolean>>(ENDPOINTS.FORM_CATEGORY.updateFormCategory(id), { id, ...data });
        return response.data;
    },

    deleteFormCategory: async (id: number) => {
        const response = await api.delete<ApiResponse<boolean>>(ENDPOINTS.FORM_CATEGORY.deleteFormCategory(id));
        return response.data;
    },

    getCoordinators: async (id: number) => {
        const response = await api.get<ApiResponse<FormCategoryCoordinatorDto[]>>(ENDPOINTS.FORM_CATEGORY.getCoordinators(id));
        return response.data;
    },

    replaceCoordinators: async (id: number, employeeIds: number[]) => {
        const response = await api.put<ApiResponse<FormCategoryCoordinatorDto[]>>(
            ENDPOINTS.FORM_CATEGORY.replaceCoordinators(id),
            { employeeIds }
        );
        return response.data;
    },
};

export { ENDPOINTS };
