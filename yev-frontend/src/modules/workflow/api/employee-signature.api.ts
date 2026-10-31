import { api } from "@/lib/client";
import type {
    EmployeeSignatureDto,
    SignatureConfirmationPreviewDto,
    UpsertEmployeeSignatureDto,
} from "@/modules/workflow/types/employee-signature.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
    EMPLOYEE_SIGNATURE: {
        getMine: "/Workflow/EmployeeSignature/me",
        upsertMine: "/Workflow/EmployeeSignature/me",
        confirmGet: (token: string) => `/Workflow/EmployeeSignature/confirm/${encodeURIComponent(token)}`,
        confirmPost: (token: string) => `/Workflow/EmployeeSignature/confirm/${encodeURIComponent(token)}`,
    },
} as const;

export const EmployeeSignatureApi = {
    getMine: async () => {
        const response = await api.get<ApiResponse<EmployeeSignatureDto>>(ENDPOINTS.EMPLOYEE_SIGNATURE.getMine);
        return response.data;
    },
    // Does not apply the signature: only emails a confirmation link; it changes after confirmSignature().
    upsertMine: async (data: UpsertEmployeeSignatureDto) => {
        const response = await api.put<ApiResponse<boolean>>(ENDPOINTS.EMPLOYEE_SIGNATURE.upsertMine, data);
        return response.data;
    },
    // Anonymous: opened from the email link.
    getSignatureConfirmation: async (token: string) => {
        const response = await api.get<ApiResponse<SignatureConfirmationPreviewDto>>(ENDPOINTS.EMPLOYEE_SIGNATURE.confirmGet(token));
        return response.data;
    },
    confirmSignature: async (token: string) => {
        const response = await api.post<ApiResponse<EmployeeSignatureDto>>(ENDPOINTS.EMPLOYEE_SIGNATURE.confirmPost(token));
        return response.data;
    },
};

export { ENDPOINTS };
