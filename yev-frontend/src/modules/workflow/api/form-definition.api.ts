import { api } from "@/lib/client";
import type { FormDefinitionDto, CreateFormDefinitionDto, UpdateFormDefinitionDto, CloneFormDefinitionDto } from "@/modules/workflow/types/form-definition.dto";
import type { FormFieldDto, ReplaceFormFieldItemDto } from "@/modules/workflow/types/form-field.dto";
import type { FormFieldConditionDto, ReplaceFormFieldConditionItemDto } from "@/modules/workflow/types/form-field-condition.dto";
import type { FormAccessDto, ReplaceFormAccessItemDto } from "@/modules/workflow/types/form-access.dto";
import type { FormRouteDto, ReplaceFormRouteItemDto } from "@/modules/workflow/types/form-route.dto";
import { ApiResponse, ApiResponseWithPageNation } from "@/types/api";

const ENDPOINTS = {
    FORM_DEFINITION: {
        getFormDefinitionPageNation: "/Workflow/FormDefinition/grid-list",
        getFormDefinitionById: (id: number) => `/Workflow/FormDefinition/${id}`,
        createFormDefinition: "/Workflow/FormDefinition",
        updateFormDefinition: (id: number) => `/Workflow/FormDefinition/${id}`,
        deleteFormDefinition: (id: number) => `/Workflow/FormDefinition/${id}`,
        getFields: (id: number) => `/Workflow/FormDefinition/${id}/fields`,
        replaceFields: (id: number) => `/Workflow/FormDefinition/${id}/fields`,
        updateLayout: (id: number) => `/Workflow/FormDefinition/${id}/layout`,
        getConditions: (id: number) => `/Workflow/FormDefinition/${id}/conditions`,
        replaceConditions: (id: number) => `/Workflow/FormDefinition/${id}/conditions`,
        getAccesses: (id: number) => `/Workflow/FormDefinition/${id}/accesses`,
        replaceAccesses: (id: number) => `/Workflow/FormDefinition/${id}/accesses`,
        publish: (id: number) => `/Workflow/FormDefinition/${id}/publish`,
        clone: (id: number) => `/Workflow/FormDefinition/${id}/clone`,
        getRoutes: (id: number) => `/Workflow/FormDefinition/${id}/routes`,
        replaceRoutes: (id: number) => `/Workflow/FormDefinition/${id}/routes`,
    },
} as const;

export interface GetFormDefinitionPageNationParams {
    pageIndex?: number;
    pageSize?: number;
    keyword?: string;
}

export const FormDefinitionApi = {
    getFormDefinitionPageNation: async (params?: GetFormDefinitionPageNationParams) => {
        const query = new URLSearchParams();
        if (params?.pageIndex) query.set("PageIndex", String(params.pageIndex));
        if (params?.pageSize) query.set("PageSize", String(params.pageSize));
        if (params?.keyword) query.set("Keyword", params.keyword);

        const queryString = query.toString();
        const url = queryString
            ? `${ENDPOINTS.FORM_DEFINITION.getFormDefinitionPageNation}?${queryString}`
            : ENDPOINTS.FORM_DEFINITION.getFormDefinitionPageNation;

        const response = await api.get<ApiResponseWithPageNation<FormDefinitionDto>>(url);
        return response.data;
    },

    getFormDefinitionById: async (id: number) => {
        const response = await api.get<ApiResponse<FormDefinitionDto>>(ENDPOINTS.FORM_DEFINITION.getFormDefinitionById(id));
        return response.data;
    },

    createFormDefinition: async (data: CreateFormDefinitionDto) => {
        const response = await api.post<ApiResponse<FormDefinitionDto>>(ENDPOINTS.FORM_DEFINITION.createFormDefinition, data);
        return response.data;
    },

    updateFormDefinition: async (id: number, data: UpdateFormDefinitionDto) => {
        const response = await api.put<ApiResponse<boolean>>(ENDPOINTS.FORM_DEFINITION.updateFormDefinition(id), { id, ...data });
        return response.data;
    },

    deleteFormDefinition: async (id: number) => {
        const response = await api.delete<ApiResponse<boolean>>(ENDPOINTS.FORM_DEFINITION.deleteFormDefinition(id));
        return response.data;
    },

    getFields: async (id: number) => {
        const response = await api.get<ApiResponse<FormFieldDto[]>>(ENDPOINTS.FORM_DEFINITION.getFields(id));
        return response.data;
    },

    replaceFields: async (id: number, items: ReplaceFormFieldItemDto[]) => {
        const response = await api.put<ApiResponse<FormFieldDto[]>>(ENDPOINTS.FORM_DEFINITION.replaceFields(id), { items });
        return response.data;
    },

    updateLayout: async (id: number, layoutHtml: string | null) => {
        const response = await api.put<ApiResponse<FormDefinitionDto>>(ENDPOINTS.FORM_DEFINITION.updateLayout(id), { layoutHtml });
        return response.data;
    },

    getConditions: async (id: number) => {
        const response = await api.get<ApiResponse<FormFieldConditionDto[]>>(ENDPOINTS.FORM_DEFINITION.getConditions(id));
        return response.data;
    },

    replaceConditions: async (id: number, items: ReplaceFormFieldConditionItemDto[]) => {
        const response = await api.put<ApiResponse<FormFieldConditionDto[]>>(ENDPOINTS.FORM_DEFINITION.replaceConditions(id), { items });
        return response.data;
    },

    getAccesses: async (id: number) => {
        const response = await api.get<ApiResponse<FormAccessDto[]>>(ENDPOINTS.FORM_DEFINITION.getAccesses(id));
        return response.data;
    },

    replaceAccesses: async (id: number, items: ReplaceFormAccessItemDto[]) => {
        const response = await api.put<ApiResponse<FormAccessDto[]>>(ENDPOINTS.FORM_DEFINITION.replaceAccesses(id), { items });
        return response.data;
    },

    publish: async (id: number) => {
        const response = await api.post<ApiResponse<FormDefinitionDto>>(ENDPOINTS.FORM_DEFINITION.publish(id), {});
        return response.data;
    },

    clone: async (id: number, data: CloneFormDefinitionDto) => {
        const response = await api.post<ApiResponse<FormDefinitionDto>>(ENDPOINTS.FORM_DEFINITION.clone(id), data);
        return response.data;
    },

    getRoutes: async (id: number) => {
        const response = await api.get<ApiResponse<FormRouteDto[]>>(ENDPOINTS.FORM_DEFINITION.getRoutes(id));
        return response.data;
    },

    replaceRoutes: async (id: number, items: ReplaceFormRouteItemDto[]) => {
        const response = await api.put<ApiResponse<FormRouteDto[]>>(ENDPOINTS.FORM_DEFINITION.replaceRoutes(id), { items });
        return response.data;
    },
};

export { ENDPOINTS };
