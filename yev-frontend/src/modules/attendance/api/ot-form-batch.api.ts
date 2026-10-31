import { api } from "@/lib/client";
import type {
    OtFormBatchDto,
    ProcessOtFormBatchDto,
} from "@/modules/attendance/types/ot-form-batch.dto";
import { ApiResponse } from "@/types/api";

const ENDPOINTS = {
    OT_FORM_BATCH: {
        emailConfirmGet: (token: string) => `/OtFormBatch/email-confirm/${encodeURIComponent(token)}`,
        emailConfirmApprove: (token: string) => `/OtFormBatch/email-confirm/${encodeURIComponent(token)}/approve`,
        runNow: "/OtFormBatch/run-now",
    },
} as const;

export const OtFormBatchApi = {
    // Public [AllowAnonymous]: the token is the only credential.
    getByEmailToken: async (token: string) => {
        const response = await api.get<ApiResponse<OtFormBatchDto>>(ENDPOINTS.OT_FORM_BATCH.emailConfirmGet(token));
        return response.data;
    },
    approveByEmailToken: async (token: string, data: ProcessOtFormBatchDto) => {
        const response = await api.post<ApiResponse<OtFormBatchDto>>(ENDPOINTS.OT_FORM_BATCH.emailConfirmApprove(token), data);
        return response.data;
    },
    // Runs the scheduled batch immediately; requires Attendance.Setting.Update.
    runNow: async () => {
        const response = await api.post<ApiResponse<boolean>>(ENDPOINTS.OT_FORM_BATCH.runNow);
        return response.data;
    },
};

export { ENDPOINTS };
