import { api, getForBlob, type BlobDownloadResult } from "@/lib/client";
import type {
    EmployeeImportConfirmResultDto,
    EmployeeImportPreviewResultDto,
    EmployeeImportPreviewRowDto,
    EmployeeOtHourLimitImportResultDto,
} from "@/modules/attendance/types/employee-import.dto";
import type { ProductionEmployeeAccumulationResultDto } from "@/modules/attendance/types/production-employee-import.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
    EMPLOYEE_IMPORT: {
        preview: "/EmployeeImport/preview",
        confirm: "/EmployeeImport/confirm",
        otHourLimits: "/EmployeeImport/ot-hour-limits",
        template: "/EmployeeImport/template",
        otHourLimitsTemplate: "/EmployeeImport/ot-hour-limits/template",
        monthlyAccumulation: "/EmployeeImport/monthly-accumulation",
        monthlyAccumulationTemplate: "/EmployeeImport/monthly-accumulation/template",
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
    // multipart/form-data — field "file" + query Year/Month. Áp dụng thẳng, không có Preview riêng
    // (2026-09-03) — tổng quát cho MỌI Phòng ban (Coordinator của bất kỳ Phòng ban nào cũng gọi được,
    // không hardcode "Chế tạo" như ProductionEmployeeImportApi.applyAccumulation).
    importMonthlyAccumulation: async (year: number, month: number, file: File) => {
        const formData = new FormData();
        formData.append("file", file);
        const response = await api.postForm<ApiResponse<ProductionEmployeeAccumulationResultDto>>(
            `${ENDPOINTS.EMPLOYEE_IMPORT.monthlyAccumulation}?year=${year}&month=${month}`,
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
    downloadMonthlyAccumulationTemplate: async (): Promise<BlobDownloadResult> => {
        return getForBlob(ENDPOINTS.EMPLOYEE_IMPORT.monthlyAccumulationTemplate);
    },
};

export { ENDPOINTS };
