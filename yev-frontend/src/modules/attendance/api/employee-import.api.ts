import { api, getForBlob, type BlobDownloadResult } from "@/lib/client";
import type {
    EmployeeImportConfirmResultDto,
    EmployeeImportPreviewResultDto,
    EmployeeImportPreviewRowDto,
    EmployeeOtHourLimitImportResultDto,
} from "@/modules/attendance/types/employee-import.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
    EMPLOYEE_IMPORT: {
        preview: "/EmployeeImport/preview",
        confirm: "/EmployeeImport/confirm",
        otHourLimits: "/EmployeeImport/ot-hour-limits",
        template: "/EmployeeImport/template",
        otHourLimitsTemplate: "/EmployeeImport/ot-hour-limits/template",
    },
} as const;

export const EmployeeImportApi = {
    // multipart/form-data — field "file". Chỉ đọc, không ghi DB (docs/attendance-api-fe.md §3.7).
    previewImport: async (file: File) => {
        const formData = new FormData();
        formData.append("file", file);
        const response = await api.postForm<ApiResponse<EmployeeImportPreviewResultDto>>(
            ENDPOINTS.EMPLOYEE_IMPORT.preview,
            formData
        );
        return response.data;
    },
    // Gửi lại NGUYÊN "rows" từ Preview (kể cả Resolved*/isNew*) — BE tự re-validate lại từ đầu.
    confirmImport: async (rows: EmployeeImportPreviewRowDto[]) => {
        const response = await api.post<ApiResponse<EmployeeImportConfirmResultDto>>(ENDPOINTS.EMPLOYEE_IMPORT.confirm, {
            rows,
        });
        return response.data;
    },
    // multipart/form-data — field "file". Áp dụng thẳng, không có Preview riêng (mục 5, 2026-08-27).
    importOtHourLimits: async (file: File) => {
        const formData = new FormData();
        formData.append("file", file);
        const response = await api.postForm<ApiResponse<EmployeeOtHourLimitImportResultDto>>(
            ENDPOINTS.EMPLOYEE_IMPORT.otHourLimits,
            formData
        );
        return response.data;
    },
    downloadTemplate: async (): Promise<BlobDownloadResult> => {
        return getForBlob(ENDPOINTS.EMPLOYEE_IMPORT.template);
    },
    downloadOtHourLimitTemplate: async (): Promise<BlobDownloadResult> => {
        return getForBlob(ENDPOINTS.EMPLOYEE_IMPORT.otHourLimitsTemplate);
    },
};

export { ENDPOINTS };
