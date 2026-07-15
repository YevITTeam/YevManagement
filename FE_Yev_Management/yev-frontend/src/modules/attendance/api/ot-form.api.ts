import { api } from "@/lib/client";
import type {
    ApproveOtFormDto,
    CreateOtFormDto,
    OtFormDto,
    OtFormListItemDto,
    RejectOtFormDto,
} from "@/modules/attendance/types/ot-form.dto";
import { ApiResponse, ApiResponseWithPageNation } from "@/types/api";

// Route /OtForm — không có /all, không PUT/DELETE (docs/attendance-api-fe.md §4).
const ENDPOINTS = {
    OT_FORM: {
        createOtForm: "/OtForm",
        getMyForms: "/OtForm/my-forms",
        getPendingApprovals: "/OtForm/pending-approvals",
        getOtFormById: (id: number) => `/OtForm/${id}`,
        approveOtForm: (id: number) => `/OtForm/${id}/approve`,
        rejectOtForm: (id: number) => `/OtForm/${id}/reject`,
    },
} as const;

export interface GetOtFormListParams {
    pageIndex?: number;
    pageSize?: number;
}

export const OtFormApi = {
    // Response 201, data trả về OtFormDto đầy đủ luôn — không cần gọi lại getOtFormById (docs §4.1).
    createOtForm: async (data: CreateOtFormDto) => {
        const response = await api.post<ApiResponse<OtFormDto>>(ENDPOINTS.OT_FORM.createOtForm, data);
        return response.data;
    },
    getMyForms: async (params?: GetOtFormListParams) => {
        const query = new URLSearchParams();
        if (params?.pageIndex) query.set("PageIndex", String(params.pageIndex));
        if (params?.pageSize) query.set("PageSize", String(params.pageSize));
        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.OT_FORM.getMyForms}?${queryString}` : ENDPOINTS.OT_FORM.getMyForms;
        const response = await api.get<ApiResponseWithPageNation<OtFormListItemDto>>(url);
        return response.data;
    },
    // BE tự lọc theo cấp/scope của user gọi API — FE không truyền tham số lọc cấp (docs §4.2).
    getPendingApprovals: async (params?: GetOtFormListParams) => {
        const query = new URLSearchParams();
        if (params?.pageIndex) query.set("PageIndex", String(params.pageIndex));
        if (params?.pageSize) query.set("PageSize", String(params.pageSize));
        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.OT_FORM.getPendingApprovals}?${queryString}` : ENDPOINTS.OT_FORM.getPendingApprovals;
        const response = await api.get<ApiResponseWithPageNation<OtFormListItemDto>>(url);
        return response.data;
    },
    getOtFormById: async (id: number) => {
        const response = await api.get<ApiResponse<OtFormDto>>(ENDPOINTS.OT_FORM.getOtFormById(id));
        return response.data;
    },
    approveOtForm: async (id: number, data: ApproveOtFormDto) => {
        const response = await api.post<ApiResponse<boolean>>(ENDPOINTS.OT_FORM.approveOtForm(id), data);
        return response.data;
    },
    rejectOtForm: async (id: number, data: RejectOtFormDto) => {
        const response = await api.post<ApiResponse<boolean>>(ENDPOINTS.OT_FORM.rejectOtForm(id), data);
        return response.data;
    },
};

export { ENDPOINTS };
