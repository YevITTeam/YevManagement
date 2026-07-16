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
        getUserSignature: (userName: string) => `/UserSignature/${encodeURIComponent(userName)}`,
        confirmGet: (token: string) => `/UserSignature/confirm/${encodeURIComponent(token)}`,
        confirmPost: (token: string) => `/UserSignature/confirm/${encodeURIComponent(token)}`,
    },
} as const;

export const UserSignatureApi = {
    // data = null nếu user chưa đăng ký chữ ký (chưa thấy docs nói rõ 404 hay data null — xử lý cả 2 phía component).
    getMySignature: async () => {
        const response = await api.get<ApiResponse<UserSignatureDto | null>>(ENDPOINTS.USER_SIGNATURE.getMySignature);
        return response.data;
    },
    // ⚠️ 2026-07-16: KHÔNG còn áp dụng chữ ký ngay — chỉ gửi email xác nhận, data=true là đã gửi mail
    // thành công, chữ ký thật sự đổi sau khi user tự bấm xác nhận qua confirmSignature() (docs §6b).
    upsertMySignature: async (data: UpsertUserSignatureDto) => {
        const response = await api.put<ApiResponse<boolean>>(ENDPOINTS.USER_SIGNATURE.upsertMySignature, data);
        return response.data;
    },
    // Admin xem chữ ký người khác — permission Attendance.UserSignature.View.
    getUserSignature: async (userName: string) => {
        const response = await api.get<ApiResponse<UserSignatureDto | null>>(
            ENDPOINTS.USER_SIGNATURE.getUserSignature(userName)
        );
        return response.data;
    },
    // Public, [AllowAnonymous] — trang "Xác nhận cập nhật chữ ký" mở qua link email (docs §6b).
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
