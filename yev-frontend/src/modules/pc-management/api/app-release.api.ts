import { api } from "@/lib/client";
import type { AppReleaseDto, CreateUpdateAppReleaseDto } from "@/modules/pc-management/types/app-release.dto";
import { ApiResponse, ApiResponseWithPageNation } from "@/types/api";

const ENDPOINTS = {
    APP_RELEASE: {
        getLatest: "/AppRelease/latest",
        getAppReleasePageNation: "/AppRelease/grid-list",
        createAppRelease: "/AppRelease",
        updateAppRelease: (id: number) => `/AppRelease/${id}`,
        deleteAppRelease: (id: number) => `/AppRelease/${id}`,
        uploadApk: "/AppRelease/upload",
    },
} as const;

export interface GetAppReleasePageNationParams {
    pageIndex?: number;
    pageSize?: number;
    keyword?: string;
}

export const AppReleaseApi = {
    // [AllowAnonymous] on BE; an attached Bearer token is harmless.
    getLatest: async () => {
        const response = await api.get<ApiResponse<AppReleaseDto | null>>(ENDPOINTS.APP_RELEASE.getLatest);
        return response.data;
    },
    getAppReleasePageNation: async (params?: GetAppReleasePageNationParams) => {
        const query = new URLSearchParams();
        if (params?.pageIndex) query.set("PageIndex", String(params.pageIndex));
        if (params?.pageSize) query.set("PageSize", String(params.pageSize));
        if (params?.keyword) query.set("Keyword", params.keyword);

        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.APP_RELEASE.getAppReleasePageNation}?${queryString}` : ENDPOINTS.APP_RELEASE.getAppReleasePageNation;
        const response = await api.get<ApiResponseWithPageNation<AppReleaseDto>>(url);
        return response.data;
    },
    createAppRelease: async (data: Omit<CreateUpdateAppReleaseDto, "id">) => {
        const response = await api.post<ApiResponse<AppReleaseDto>>(ENDPOINTS.APP_RELEASE.createAppRelease, data);
        return response.data;
    },
    updateAppRelease: async (id: number, data: Omit<CreateUpdateAppReleaseDto, "id">) => {
        const response = await api.put<ApiResponse<boolean>>(ENDPOINTS.APP_RELEASE.updateAppRelease(id), { id, ...data });
        return response.data;
    },
    deleteAppRelease: async (id: number) => {
        const response = await api.delete<ApiResponse<boolean>>(ENDPOINTS.APP_RELEASE.deleteAppRelease(id));
        return response.data;
    },
    // Only uploads and returns the internal download URL; the caller must still create/update the AppRelease with it.
    uploadApk: async (file: File) => {
        const formData = new FormData();
        formData.append("file", file);
        const response = await api.postForm<ApiResponse<string>>(ENDPOINTS.APP_RELEASE.uploadApk, formData);
        return response.data;
    },
};

export { ENDPOINTS };
