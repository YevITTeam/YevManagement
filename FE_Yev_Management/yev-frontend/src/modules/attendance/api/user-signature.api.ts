import { api } from "@/lib/client";
import type { UpsertUserSignatureDto, UserSignatureDto } from "@/modules/attendance/types/user-signature.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
    USER_SIGNATURE: {
        getMySignature: "/UserSignature/me",
        upsertMySignature: "/UserSignature/me",
        getUserSignature: (userName: string) => `/UserSignature/${encodeURIComponent(userName)}`,
    },
} as const;

export const UserSignatureApi = {
    // data = null nếu user chưa đăng ký chữ ký (chưa thấy docs nói rõ 404 hay data null — xử lý cả 2 phía component).
    getMySignature: async () => {
        const response = await api.get<ApiResponse<UserSignatureDto | null>>(ENDPOINTS.USER_SIGNATURE.getMySignature);
        return response.data;
    },
    upsertMySignature: async (data: UpsertUserSignatureDto) => {
        const response = await api.put<ApiResponse<UserSignatureDto>>(ENDPOINTS.USER_SIGNATURE.upsertMySignature, data);
        return response.data;
    },
    // Admin xem chữ ký người khác — permission Attendance.UserSignature.View.
    getUserSignature: async (userName: string) => {
        const response = await api.get<ApiResponse<UserSignatureDto | null>>(
            ENDPOINTS.USER_SIGNATURE.getUserSignature(userName)
        );
        return response.data;
    },
};

export { ENDPOINTS };
