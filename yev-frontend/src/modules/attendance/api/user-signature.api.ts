import { api } from "@/lib/client";
import type {
    SignatureConfirmationPreviewDto,
    UpsertUserSignatureDto,
    UserSignatureDto,
} from "@/modules/attendance/types/user-signature.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
    USER_SIGNATURE: {
        getMySignature: "/UserSignature/me",
        upsertMySignature: "/UserSignature/me",
        getUserSignature: (userName: string) => `/UserSignature/user?userName=${encodeURIComponent(userName)}`,
        confirmGet: (token: string) => `/UserSignature/confirm/${encodeURIComponent(token)}`,
        confirmPost: (token: string) => `/UserSignature/confirm/${encodeURIComponent(token)}`,
    },
} as const;

export const UserSignatureApi = {
    // data is null when no signature is registered; components handle both null and 404.
    getMySignature: async () => {
        const response = await api.get<ApiResponse<UserSignatureDto | null>>(ENDPOINTS.USER_SIGNATURE.getMySignature);
        return response.data;
    },
    // Not applied immediately: only sends a confirmation email (data=true = sent); the change happens on confirmSignature().
    upsertMySignature: async (data: UpsertUserSignatureDto) => {
        const response = await api.put<ApiResponse<boolean>>(ENDPOINTS.USER_SIGNATURE.upsertMySignature, data);
        return response.data;
    },
    // Requires Attendance.UserSignature.View.
    getUserSignature: async (userName: string) => {
        const response = await api.get<ApiResponse<UserSignatureDto | null>>(
            ENDPOINTS.USER_SIGNATURE.getUserSignature(userName)
        );
        return response.data;
    },
    // Admin role only; applies immediately, no confirmation email.
    adminSetSignature: async (userName: string, data: UpsertUserSignatureDto) => {
        const response = await api.put<ApiResponse<UserSignatureDto>>(ENDPOINTS.USER_SIGNATURE.getUserSignature(userName), data);
        return response.data;
    },
    // Public [AllowAnonymous], opened from the email link.
    getSignatureConfirmation: async (token: string) => {
        const response = await api.get<ApiResponse<SignatureConfirmationPreviewDto>>(
            ENDPOINTS.USER_SIGNATURE.confirmGet(token)
        );
        return response.data;
    },
    confirmSignature: async (token: string) => {
        const response = await api.post<ApiResponse<UserSignatureDto>>(ENDPOINTS.USER_SIGNATURE.confirmPost(token));
        return response.data;
    },
};

export { ENDPOINTS };
