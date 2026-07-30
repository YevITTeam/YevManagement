import { api } from "@/lib/client";
import type {
    SecondaryPasswordConfirmationPreviewDto,
    SecondaryPasswordStatusDto,
    UpsertSecondaryPasswordDto,
} from "@/modules/attendance/types/secondary-password.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
    SECONDARY_PASSWORD: {
        getMyStatus: "/SecondaryPassword/me",
        upsertMine: "/SecondaryPassword/me",
        confirmGet: (token: string) => `/SecondaryPassword/confirm/${encodeURIComponent(token)}`,
        confirmPost: (token: string) => `/SecondaryPassword/confirm/${encodeURIComponent(token)}`,
    },
} as const;

export const SecondaryPasswordApi = {
    getMyStatus: async () => {
        const response = await api.get<ApiResponse<SecondaryPasswordStatusDto>>(ENDPOINTS.SECONDARY_PASSWORD.getMyStatus);
        return response.data;
    },
    // KHÔNG áp dụng ngay — chỉ gửi email xác nhận, data=true là đã gửi mail thành công. Mật khẩu thật
    // sự đổi sau khi user tự bấm xác nhận qua confirmMine() (mirror UserSignatureApi.upsertMySignature).
    upsertMine: async (data: UpsertSecondaryPasswordDto) => {
        const response = await api.put<ApiResponse<boolean>>(ENDPOINTS.SECONDARY_PASSWORD.upsertMine, data);
        return response.data;
    },
    // Public, [AllowAnonymous] — trang "Xác nhận thiết lập mật khẩu cấp 2" mở qua link email.
    getConfirmation: async (token: string) => {
        const response = await api.get<ApiResponse<SecondaryPasswordConfirmationPreviewDto>>(
            ENDPOINTS.SECONDARY_PASSWORD.confirmGet(token)
        );
        return response.data;
    },
    confirmMine: async (token: string) => {
        const response = await api.post<ApiResponse<boolean>>(ENDPOINTS.SECONDARY_PASSWORD.confirmPost(token));
        return response.data;
    },
};

export { ENDPOINTS };
