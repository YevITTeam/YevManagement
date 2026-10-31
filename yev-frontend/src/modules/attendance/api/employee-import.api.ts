import { api, getForBlob, type BlobDownloadResult } from "@/lib/client";
import type {
    EmployeeExportFilter,
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
        export: "/EmployeeImport/export",
        otHourLimitsExport: "/EmployeeImport/ot-hour-limits/export",
        monthlyAccumulationExport: "/EmployeeImport/monthly-accumulation/export",
    },
} as const;

export const toExportQuery = (filter: EmployeeExportFilter, extra: Record<string, number> = {}) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...filter, ...extra })) {
        if (value !== undefined && value !== "") query.set(key, String(value));
    }
    const queryString = query.toString();
    return queryString ? `?${queryString}` : "";
};

export const EmployeeImportApi = {
    // Read-only, no DB writes.
    previewImport: async (file: File) => {
        const formData = new FormData();
        formData.append("file", file);
        const response = await api.postForm<ApiResponse<EmployeeImportPreviewResultDto>>(
            ENDPOINTS.EMPLOYEE_IMPORT.preview,
            formData
        );
        return response.data;
    },
    // Re-send the preview rows unchanged (including Resolved*/isNew*); BE re-validates from scratch.
    confirmImport: async (rows: EmployeeImportPreviewRowDto[]) => {
        const response = await api.post<ApiResponse<EmployeeImportConfirmResultDto>>(ENDPOINTS.EMPLOYEE_IMPORT.confirm, {
            rows,
        });
        return response.data;
    },
    // Applied directly, no preview step.
    importOtHourLimits: async (file: File) => {
        const formData = new FormData();
        formData.append("file", file);
        const response = await api.postForm<ApiResponse<EmployeeOtHourLimitImportResultDto>>(
            ENDPOINTS.EMPLOYEE_IMPORT.otHourLimits,
            formData
        );
        return response.data;
    },
    // Applied directly, no preview step; works for any department, unlike the production-only applyAccumulation.
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
    exportEmployees: (filter: EmployeeExportFilter): Promise<BlobDownloadResult> =>
        getForBlob(ENDPOINTS.EMPLOYEE_IMPORT.export + toExportQuery(filter)),
    exportOtHourLimits: (filter: EmployeeExportFilter): Promise<BlobDownloadResult> =>
        getForBlob(ENDPOINTS.EMPLOYEE_IMPORT.otHourLimitsExport + toExportQuery(filter)),
    exportMonthlyAccumulation: (filter: EmployeeExportFilter, year: number, month: number): Promise<BlobDownloadResult> =>
        getForBlob(ENDPOINTS.EMPLOYEE_IMPORT.monthlyAccumulationExport + toExportQuery(filter, { year, month })),
};

export { ENDPOINTS };
