import { api } from "@/lib/client";
import type {
    ApproveOtFormDto,
    BulkApproveOtFormDto,
    BulkOtFormActionResultItemDto,
    BulkRejectOtFormDto,
    CheckOtFormOverlapDto,
    CreateOtFormDto,
    DeleteOtFormDto,
    MyCreateScopeItemDto,
    OtFormDto,
    OtFormListItemDto,
    PendingApprovalDateCountDto,
    RejectOtFormDto,
    RemoveOtFormEmployeeByEmailTokenDto,
    UpdateOtFormDto,
} from "@/modules/attendance/types/ot-form.dto";
import { ApiResponse, ApiResponseWithPageNation } from "@/types/api";

// Route /OtForm — docs/attendance-api-fe.md §4 (đã cập nhật 2026-07-16: thêm PUT sửa đơn + email-confirm public).
const ENDPOINTS = {
    OT_FORM: {
        getMyCreateScopes: "/OtForm/my-create-scopes",
        checkOverlap: "/OtForm/check-overlap",
        createOtForm: "/OtForm",
        getMyForms: "/OtForm/my-forms",
        getPendingApprovals: "/OtForm/pending-approvals",
        getPendingApprovalsCount: "/OtForm/pending-approvals/count",
        getPendingApprovalDates: "/OtForm/pending-approvals/dates",
        getMyActions: "/OtForm/my-actions",
        getMyParticipations: "/OtForm/my-participations",
        getOtFormById: (id: number) => `/OtForm/${id}`,
        updateOtForm: (id: number) => `/OtForm/${id}`,
        approveOtForm: (id: number) => `/OtForm/${id}/approve`,
        rejectOtForm: (id: number) => `/OtForm/${id}/reject`,
        bulkApprove: "/OtForm/bulk-approve",
        bulkReject: "/OtForm/bulk-reject",
        deleteOtForm: (id: number) => `/OtForm/${id}/delete`,
        emailConfirmGet: (token: string) => `/OtForm/email-confirm/${encodeURIComponent(token)}`,
        emailConfirmApprove: (token: string) => `/OtForm/email-confirm/${encodeURIComponent(token)}/approve`,
        emailConfirmReject: (token: string) => `/OtForm/email-confirm/${encodeURIComponent(token)}/reject`,
        emailConfirmRemoveEmployee: (token: string) => `/OtForm/email-confirm/${encodeURIComponent(token)}/employees/remove`,
    },
} as const;

export interface GetOtFormListParams {
    pageIndex?: number;
    pageSize?: number;
    // Lọc theo OtForm.date (bao gồm cả 2 đầu mút, chuỗi "yyyy-MM-dd") và status (giá trị enum
    // OtFormStatus) — cả 3 optional, dùng chung cho các hàm danh sách bên dưới (2026-08-06).
    fromDate?: string;
    toDate?: string;
    status?: number;
    // Lọc theo Line/Team/Nhóm ca cho đơn dưới chuyền (2026-09-04) — chỉ getPendingApprovals dùng, các
    // hàm danh sách khác bỏ qua nếu có truyền (BE không nhận tham số này ở endpoint khác).
    productionLineId?: number;
    productionTeamId?: number;
    productionShiftTeamId?: number;
}

function appendOtFormListParams(query: URLSearchParams, params?: GetOtFormListParams) {
    if (params?.pageIndex) query.set("PageIndex", String(params.pageIndex));
    if (params?.pageSize) query.set("PageSize", String(params.pageSize));
    if (params?.fromDate) query.set("FromDate", params.fromDate);
    if (params?.toDate) query.set("ToDate", params.toDate);
    // status=0 (Pending) là giá trị hợp lệ — không được dùng truthy check kẻo rớt mất (CLAUDE.md §4.4).
    if (params?.status !== undefined) query.set("Status", String(params.status));
    if (params?.productionLineId !== undefined) query.set("ProductionLineId", String(params.productionLineId));
    if (params?.productionTeamId !== undefined) query.set("ProductionTeamId", String(params.productionTeamId));
    if (params?.productionShiftTeamId !== undefined) query.set("ProductionShiftTeamId", String(params.productionShiftTeamId));
}

export const OtFormApi = {
    // (Các) Bộ phận/Phòng ban CHÍNH user được phép tạo đơn — gọi TRƯỚC khi mở màn "Tạo đơn tăng ca"
    // để tự điền sẵn/khoá dropdown thay vì bắt chọn lại từ toàn bộ danh sách (docs §4.0a).
    getMyCreateScopes: async () => {
        const response = await api.get<ApiResponse<MyCreateScopeItemDto[]>>(ENDPOINTS.OT_FORM.getMyCreateScopes);
        return response.data;
    },
    // Frontend proactive conflict check
    checkOverlap: async (data: CheckOtFormOverlapDto) => {
        const response = await api.post<ApiResponse<number[]>>(ENDPOINTS.OT_FORM.checkOverlap, data);
        return response.data;
    },
    // Response 201, data trả về OtFormDto đầy đủ luôn — không cần gọi lại getOtFormById (docs §4.1).
    createOtForm: async (data: CreateOtFormDto) => {
        const response = await api.post<ApiResponse<OtFormDto>>(ENDPOINTS.OT_FORM.createOtForm, data);
        return response.data;
    },
    // Chỉ chính người tạo, chỉ khi còn Pending — data trả về OtFormDto đầy đủ (docs §4.1b).
    updateOtForm: async (id: number, data: UpdateOtFormDto) => {
        const response = await api.put<ApiResponse<OtFormDto>>(ENDPOINTS.OT_FORM.updateOtForm(id), data);
        return response.data;
    },
    getMyForms: async (params?: GetOtFormListParams) => {
        const query = new URLSearchParams();
        appendOtFormListParams(query, params);
        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.OT_FORM.getMyForms}?${queryString}` : ENDPOINTS.OT_FORM.getMyForms;
        const response = await api.get<ApiResponseWithPageNation<OtFormListItemDto>>(url);
        return response.data;
    },
    // BE tự lọc theo bước hiện tại (StepOrder nhỏ nhất còn Pending) mà user gọi API là candidate —
    // FE không truyền tham số lọc cấp (docs §4.2).
    getPendingApprovals: async (params?: GetOtFormListParams) => {
        const query = new URLSearchParams();
        appendOtFormListParams(query, params);
        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.OT_FORM.getPendingApprovals}?${queryString}` : ENDPOINTS.OT_FORM.getPendingApprovals;
        const response = await api.get<ApiResponseWithPageNation<OtFormListItemDto>>(url);
        return response.data;
    },
    // Đếm nhanh số đơn đang chờ CHÍNH user gọi duyệt — dùng cho badge sidebar (2026-08-19), không
    // phân trang/không tải danh sách, chỉ 1 số nguyên.
    getPendingApprovalsCount: async () => {
        const response = await api.get<ApiResponse<number>>(ENDPOINTS.OT_FORM.getPendingApprovalsCount);
        return response.data;
    },
    // Lịch mini ở màn Duyệt hàng loạt — số đơn chưa duyệt theo TỪNG ngày (2026-09-04).
    getPendingApprovalDates: async (fromDate: string, toDate: string) => {
        const query = new URLSearchParams({ fromDate, toDate });
        const response = await api.get<ApiResponse<PendingApprovalDateCountDto[]>>(
            `${ENDPOINTS.OT_FORM.getPendingApprovalDates}?${query.toString()}`
        );
        return response.data;
    },
    // Lịch sử đơn CHÍNH user gọi đã Ký/Duyệt/Từ chối ở bất kỳ cấp nào — dùng chung cho cả 4 Role,
    // vá lỗ hổng UX đơn biến mất khỏi pending-submissions/pending-approvals sau khi xử lý (docs §4.2b).
    getMyActions: async (params?: GetOtFormListParams) => {
        const query = new URLSearchParams();
        appendOtFormListParams(query, params);
        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.OT_FORM.getMyActions}?${queryString}` : ENDPOINTS.OT_FORM.getMyActions;
        const response = await api.get<ApiResponseWithPageNation<OtFormListItemDto>>(url);
        return response.data;
    },
    // Đơn mà chính user gọi API CÓ TÊN trong danh sách tăng ca (OtFormEmployee), bất kể có phải người
    // tạo/ký/duyệt hay không — trả rỗng (không lỗi) nếu account chưa được gán Employee.userName (§4.2c).
    getMyParticipations: async (params?: GetOtFormListParams) => {
        const query = new URLSearchParams();
        appendOtFormListParams(query, params);
        const queryString = query.toString();
        const url = queryString
            ? `${ENDPOINTS.OT_FORM.getMyParticipations}?${queryString}`
            : ENDPOINTS.OT_FORM.getMyParticipations;
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
    bulkApprove: async (data: BulkApproveOtFormDto) => {
        const response = await api.post<ApiResponse<BulkOtFormActionResultItemDto[]>>(ENDPOINTS.OT_FORM.bulkApprove, data);
        return response.data;
    },
    bulkReject: async (data: BulkRejectOtFormDto) => {
        const response = await api.post<ApiResponse<BulkOtFormActionResultItemDto[]>>(ENDPOINTS.OT_FORM.bulkReject, data);
        return response.data;
    },
    // Admin xoá đơn kẹt vĩnh viễn trong chuỗi duyệt — chặn ở BE nếu đơn đã Completed (2026-08-08).
    deleteOtForm: async (id: number, data: DeleteOtFormDto) => {
        const response = await api.post<ApiResponse<boolean>>(ENDPOINTS.OT_FORM.deleteOtForm(id), data);
        return response.data;
    },
    // Duyệt/Từ chối qua link email — public, [AllowAnonymous] (docs §4.6).
    getOtFormByEmailToken: async (token: string) => {
        const response = await api.get<ApiResponse<OtFormDto>>(ENDPOINTS.OT_FORM.emailConfirmGet(token));
        return response.data;
    },
    approveOtFormByEmailToken: async (token: string, data: ApproveOtFormDto) => {
        const response = await api.post<ApiResponse<boolean>>(ENDPOINTS.OT_FORM.emailConfirmApprove(token), data);
        return response.data;
    },
    rejectOtFormByEmailToken: async (token: string, data: RejectOtFormDto) => {
        const response = await api.post<ApiResponse<boolean>>(ENDPOINTS.OT_FORM.emailConfirmReject(token), data);
        return response.data;
    },
    // Loại nhân viên khỏi đơn qua link email — KHÔNG có secondaryPassword (token là thông tin xác
    // thực duy nhất, khác approve/reject qua email vẫn giữ mật khẩu cấp 2, docs §4.5a). Trả OtFormDto
    // đầy đủ đã cập nhật, không cần gọi lại getOtFormByEmailToken.
    removeOtFormEmployeeByEmailToken: async (token: string, data: RemoveOtFormEmployeeByEmailTokenDto) => {
        const response = await api.post<ApiResponse<OtFormDto>>(ENDPOINTS.OT_FORM.emailConfirmRemoveEmployee(token), data);
        return response.data;
    },
};

export { ENDPOINTS };
