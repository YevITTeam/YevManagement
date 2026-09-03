import { api, getForBlob, type BlobDownloadResult } from "@/lib/client";
import type {
    EmployeeIdentityLinkImportConfirmResultDto,
    EmployeeIdentityLinkImportPreviewResultDto,
} from "@/modules/attendance/types/employee-identity-link-import.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
    EMPLOYEE_IDENTITY_LINK_IMPORT: {
        preview: "/EmployeeIdentityLinkImport/preview",
        confirm: "/EmployeeIdentityLinkImport/confirm",
        template: "/EmployeeIdentityLinkImport/template",
    },
} as const;

export const EmployeeIdentityLinkImportApi = {
    // multipart/form-data — field "file". Confirm nhận lại NGUYÊN file (không phải rows đã Preview) vì
    // mỗi dòng có thể kèm 1 ảnh chữ ký nhúng — BE tự re-đọc + re-validate lại từ đầu.
    preview: async (file: File) => {
        const formData = new FormData();
        formData.append("file", file);
        const response = await api.postForm<ApiResponse<EmployeeIdentityLinkImportPreviewResultDto>>(
            ENDPOINTS.EMPLOYEE_IDENTITY_LINK_IMPORT.preview,
            formData
        );
        return response.data;
    },
    confirm: async (file: File) => {
        const formData = new FormData();
        formData.append("file", file);
        const response = await api.postForm<ApiResponse<EmployeeIdentityLinkImportConfirmResultDto>>(
            ENDPOINTS.EMPLOYEE_IDENTITY_LINK_IMPORT.confirm,
            formData
        );
        return response.data;
    },
    downloadTemplate: async (): Promise<BlobDownloadResult> => {
        return getForBlob(ENDPOINTS.EMPLOYEE_IDENTITY_LINK_IMPORT.template);
    },
};
