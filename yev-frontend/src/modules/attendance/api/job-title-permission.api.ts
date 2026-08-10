import { api } from "@/lib/client";
import type { JobTitlePermissionDto } from "@/modules/attendance/types/job-title-permission.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
    JOB_TITLE_PERMISSION: {
        getByJobTitle: (jobTitleId: number) => `/JobTitlePermission/by-job-title/${jobTitleId}`,
        getAllowedCodes: "/JobTitlePermission/allowed-codes",
        replaceByJobTitle: (jobTitleId: number) => `/JobTitlePermission/by-job-title/${jobTitleId}`,
    },
} as const;

export const JobTitlePermissionApi = {
    getByJobTitle: async (jobTitleId: number) => {
        const response = await api.get<ApiResponse<JobTitlePermissionDto[]>>(ENDPOINTS.JOB_TITLE_PERMISSION.getByJobTitle(jobTitleId));
        return response.data;
    },
    // Danh sách permission code được phép chọn (nhóm "tham gia quy trình") — BE là nguồn chân lý
    // duy nhất, FE không tự liệt kê song song để tránh lệch danh sách.
    getAllowedCodes: async () => {
        const response = await api.get<ApiResponse<string[]>>(ENDPOINTS.JOB_TITLE_PERMISSION.getAllowedCodes);
        return response.data;
    },
    replaceByJobTitle: async (jobTitleId: number, permissionCodes: string[]) => {
        const response = await api.put<ApiResponse<JobTitlePermissionDto[]>>(
            ENDPOINTS.JOB_TITLE_PERMISSION.replaceByJobTitle(jobTitleId),
            { permissionCodes }
        );
        return response.data;
    },
};

export { ENDPOINTS as JOB_TITLE_PERMISSION_ENDPOINTS };
