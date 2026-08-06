import { api } from "@/lib/client";
import type {
    OtFormBatchDto,
    OtFormBatchListItemDto,
    ProcessOtFormBatchDto,
} from "@/modules/attendance/types/ot-form-batch.dto";
import { ApiResponse, ApiResponseWithPageNation } from "@/types/api";

// Route /OtFormBatch — docs/attendance-api-fe.md §Đơn tổng.
const ENDPOINTS = {
    OT_FORM_BATCH: {
        gridList: "/OtFormBatch/grid-list",
        getById: (id: number) => `/OtFormBatch/${id}`,
        approve: (id: number) => `/OtFormBatch/${id}/approve`,
        emailConfirmGet: (token: string) => `/OtFormBatch/email-confirm/${encodeURIComponent(token)}`,
        emailConfirmApprove: (token: string) => `/OtFormBatch/email-confirm/${encodeURIComponent(token)}/approve`,
    },
} as const;

export interface GetOtFormBatchListParams {
    pageIndex?: number;
    pageSize?: number;
}

export const OtFormBatchApi = {
    getGridList: async (params?: GetOtFormBatchListParams) => {
        const query = new URLSearchParams();
        if (params?.pageIndex) query.set("PageIndex", String(params.pageIndex));
        if (params?.pageSize) query.set("PageSize", String(params.pageSize));
        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.OT_FORM_BATCH.gridList}?${queryString}` : ENDPOINTS.OT_FORM_BATCH.gridList;
        const response = await api.get<ApiResponseWithPageNation<OtFormBatchListItemDto>>(url);
        return response.data;
    },
    getById: async (id: number) => {
        const response = await api.get<ApiResponse<OtFormBatchDto>>(ENDPOINTS.OT_FORM_BATCH.getById(id));
        return response.data;
    },
    approve: async (id: number, data: ProcessOtFormBatchDto) => {
        const response = await api.post<ApiResponse<OtFormBatchDto>>(ENDPOINTS.OT_FORM_BATCH.approve(id), data);
        return response.data;
    },
    // Kênh public qua email — [AllowAnonymous], token là thông tin xác thực duy nhất.
    getByEmailToken: async (token: string) => {
        const response = await api.get<ApiResponse<OtFormBatchDto>>(ENDPOINTS.OT_FORM_BATCH.emailConfirmGet(token));
        return response.data;
    },
    approveByEmailToken: async (token: string, data: ProcessOtFormBatchDto) => {
        const response = await api.post<ApiResponse<OtFormBatchDto>>(ENDPOINTS.OT_FORM_BATCH.emailConfirmApprove(token), data);
        return response.data;
    },
};

export { ENDPOINTS };
