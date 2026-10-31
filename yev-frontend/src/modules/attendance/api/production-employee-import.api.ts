import { api, getForBlob, type BlobDownloadResult } from "@/lib/client";
import type {
    ProductionEmployeeAccumulationResultDto,
    ProductionEmployeeImportConfirmResultDto,
    ProductionEmployeeImportPreviewResultDto,
    ProductionEmployeeImportRowDto,
} from "@/modules/attendance/types/production-employee-import.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
    PRODUCTION_EMPLOYEE_IMPORT: {
        preview: "/ProductionEmployeeImport/preview",
        confirm: "/ProductionEmployeeImport/confirm",
        applyAccumulation: "/ProductionEmployeeImport/apply-accumulation",
        template: "/ProductionEmployeeImport/template",
    },
    PRODUCTION_EMPLOYEE_EXPORT: {
        export: "/ProductionEmployeeExport/export",
    },
} as const;

export const ProductionEmployeeImportApi = {
    // Read-only, no DB writes.
    previewImport: async (file: File) => {
        const formData = new FormData();
        formData.append("file", file);
        const response = await api.postForm<ApiResponse<ProductionEmployeeImportPreviewResultDto>>(
            ENDPOINTS.PRODUCTION_EMPLOYEE_IMPORT.preview,
            formData
        );
        return response.data;
    },
    // Re-send the preview rows unchanged; BE re-validates from scratch.
    confirmImport: async (rows: ProductionEmployeeImportRowDto[]) => {
        const response = await api.post<ApiResponse<ProductionEmployeeImportConfirmResultDto>>(
            ENDPOINTS.PRODUCTION_EMPLOYEE_IMPORT.confirm,
            { rows }
        );
        return response.data;
    },
    // Separate step gated by Attendance.EmployeeAccumulation.Import, since accumulation affects payroll.
    applyAccumulation: async (year: number, month: number, rows: ProductionEmployeeImportRowDto[]) => {
        const response = await api.post<ApiResponse<ProductionEmployeeAccumulationResultDto>>(
            ENDPOINTS.PRODUCTION_EMPLOYEE_IMPORT.applyAccumulation,
            { year, month, rows }
        );
        return response.data;
    },
    downloadTemplate: async (): Promise<BlobDownloadResult> => {
        return getForBlob(ENDPOINTS.PRODUCTION_EMPLOYEE_IMPORT.template);
    },
};

export const ProductionEmployeeExportApi = {
    exportExcel: async (): Promise<BlobDownloadResult> => {
        return getForBlob(ENDPOINTS.PRODUCTION_EMPLOYEE_EXPORT.export);
    },
};

export { ENDPOINTS };
