import { api } from "@/lib/client";
import type {
    EmployeeImportConfirmResultDto,
    EmployeeImportPreviewResultDto,
    EmployeeImportPreviewRowDto,
} from "@/modules/attendance/types/employee-import.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
    EMPLOYEE_IMPORT: {
        preview: "/EmployeeImport/preview",
        confirm: "/EmployeeImport/confirm",
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
};

export { ENDPOINTS };
