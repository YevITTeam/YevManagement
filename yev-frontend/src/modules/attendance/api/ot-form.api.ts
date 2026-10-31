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
    MyProductionCreateScopeItemDto,
    OtFormDto,
    OtFormListItemDto,
    PendingApprovalDateCountDto,
    RejectOtFormDto,
    RemoveOtFormEmployeeByEmailTokenDto,
    RemoveOtFormEmployeeDto,
    UpdateOtFormDto,
} from "@/modules/attendance/types/ot-form.dto";
import { ApiResponse, ApiResponseWithPageNation } from "@/types/api";

const ENDPOINTS = {
    OT_FORM: {
        getMyCreateScopes: "/OtForm/my-create-scopes",
        getMyProductionCreateScopes: "/OtForm/my-production-create-scopes",
        checkOverlap: "/OtForm/check-overlap",
        createOtForm: "/OtForm",
        getMyForms: "/OtForm/my-forms",
        getPendingApprovals: "/OtForm/pending-approvals",
        getPendingApprovalsCount: "/OtForm/pending-approvals/count",
        getPendingApprovalDates: "/OtForm/pending-approvals/dates",
        getMyActions: "/OtForm/my-actions",
        getMyParticipations: "/OtForm/my-participations",
        getAllForms: "/OtForm/all-forms",
        getOtFormById: (id: number) => `/OtForm/${id}`,
        updateOtForm: (id: number) => `/OtForm/${id}`,
        approveOtForm: (id: number) => `/OtForm/${id}/approve`,
        rejectOtForm: (id: number) => `/OtForm/${id}/reject`,
        removeOtFormEmployee: (id: number) => `/OtForm/${id}/employees/remove`,
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
    // Date range is inclusive ("yyyy-MM-dd"); all filters are optional and shared by the list functions below.
    fromDate?: string;
    toDate?: string;
    status?: number;
    // Department/group for office forms, Line/Team/shift group for production forms.
    groupId?: number;
    departmentId?: number;
    productionLineId?: number;
    productionTeamId?: number;
    productionShiftTeamId?: number;
    workshopId?: number;
    isProductionForm?: boolean;
}

function appendOtFormListParams(query: URLSearchParams, params?: GetOtFormListParams) {
    if (params?.pageIndex) query.set("PageIndex", String(params.pageIndex));
    if (params?.pageSize) query.set("PageSize", String(params.pageSize));
    if (params?.fromDate) query.set("FromDate", params.fromDate);
    if (params?.toDate) query.set("ToDate", params.toDate);
    // status=0 (Pending) is valid — no truthy check.
    if (params?.status !== undefined) query.set("Status", String(params.status));
    if (params?.groupId !== undefined) query.set("GroupId", String(params.groupId));
    if (params?.departmentId !== undefined) query.set("DepartmentId", String(params.departmentId));
    if (params?.productionLineId !== undefined) query.set("ProductionLineId", String(params.productionLineId));
    if (params?.productionTeamId !== undefined) query.set("ProductionTeamId", String(params.productionTeamId));
    if (params?.productionShiftTeamId !== undefined) query.set("ProductionShiftTeamId", String(params.productionShiftTeamId));
    if (params?.workshopId !== undefined) query.set("WorkshopId", String(params.workshopId));
    if (params?.isProductionForm !== undefined) query.set("IsProductionForm", String(params.isProductionForm));
}

export const OtFormApi = {
    // Lets the create screen prefill/lock the department dropdowns.
    getMyCreateScopes: async () => {
        const response = await api.get<ApiResponse<MyCreateScopeItemDto[]>>(ENDPOINTS.OT_FORM.getMyCreateScopes);
        return response.data;
    },
    // Lets the production tab prefill/lock the Team/Line/shift-group dropdowns.
    getMyProductionCreateScopes: async () => {
        const response = await api.get<ApiResponse<MyProductionCreateScopeItemDto[]>>(ENDPOINTS.OT_FORM.getMyProductionCreateScopes);
        return response.data;
    },
    checkOverlap: async (data: CheckOtFormOverlapDto) => {
        const response = await api.post<ApiResponse<number[]>>(ENDPOINTS.OT_FORM.checkOverlap, data);
        return response.data;
    },
    // Returns the full OtFormDto; no need to refetch.
    createOtForm: async (data: CreateOtFormDto) => {
        const response = await api.post<ApiResponse<OtFormDto>>(ENDPOINTS.OT_FORM.createOtForm, data);
        return response.data;
    },
    // Creator only, while still Pending; returns the full OtFormDto.
    updateOtForm: async (id: number, data: UpdateOtFormDto) => {
        const response = await api.put<ApiResponse<OtFormDto>>(ENDPOINTS.OT_FORM.updateOtForm(id), data);
        return response.data;
    },
    // No secondary password; allowed for candidates of the current Pending step, unlike updateOtForm (creator only).
    removeOtFormEmployee: async (id: number, data: RemoveOtFormEmployeeDto) => {
        const response = await api.post<ApiResponse<OtFormDto>>(ENDPOINTS.OT_FORM.removeOtFormEmployee(id), data);
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
    // BE filters by the current step (lowest pending StepOrder) where the caller is a candidate.
    getPendingApprovals: async (params?: GetOtFormListParams) => {
        const query = new URLSearchParams();
        appendOtFormListParams(query, params);
        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.OT_FORM.getPendingApprovals}?${queryString}` : ENDPOINTS.OT_FORM.getPendingApprovals;
        const response = await api.get<ApiResponseWithPageNation<OtFormListItemDto>>(url);
        return response.data;
    },
    // Count only, for the sidebar badge.
    getPendingApprovalsCount: async () => {
        const response = await api.get<ApiResponse<number>>(ENDPOINTS.OT_FORM.getPendingApprovalsCount);
        return response.data;
    },
    getPendingApprovalDates: async (fromDate: string, toDate: string) => {
        const query = new URLSearchParams({ fromDate, toDate });
        const response = await api.get<ApiResponse<PendingApprovalDateCountDto[]>>(
            `${ENDPOINTS.OT_FORM.getPendingApprovalDates}?${query.toString()}`
        );
        return response.data;
    },
    // Forms the caller already signed/approved/rejected, which otherwise vanish from the pending lists.
    getMyActions: async (params?: GetOtFormListParams) => {
        const query = new URLSearchParams();
        appendOtFormListParams(query, params);
        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.OT_FORM.getMyActions}?${queryString}` : ENDPOINTS.OT_FORM.getMyActions;
        const response = await api.get<ApiResponseWithPageNation<OtFormListItemDto>>(url);
        return response.data;
    },
    // Forms listing the caller as an OT employee; empty (not an error) if the account has no linked Employee.
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
    // Unfiltered by caller; gated by Attendance.OTForm.ViewAll.
    getAllForms: async (params?: GetOtFormListParams) => {
        const query = new URLSearchParams();
        appendOtFormListParams(query, params);
        const queryString = query.toString();
        const url = queryString ? `${ENDPOINTS.OT_FORM.getAllForms}?${queryString}` : ENDPOINTS.OT_FORM.getAllForms;
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
    // For forms stuck in the approval chain; BE rejects Completed forms.
    deleteOtForm: async (id: number, data: DeleteOtFormDto) => {
        const response = await api.post<ApiResponse<boolean>>(ENDPOINTS.OT_FORM.deleteOtForm(id), data);
        return response.data;
    },
    // Public [AllowAnonymous] email-link approval.
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
    // Returns the updated OtFormDto, so the page does not need to reload the form.
    removeOtFormEmployeeByEmailToken: async (token: string, data: RemoveOtFormEmployeeByEmailTokenDto) => {
        const response = await api.post<ApiResponse<OtFormDto>>(ENDPOINTS.OT_FORM.emailConfirmRemoveEmployee(token), data);
        return response.data;
    },
};

export { ENDPOINTS };
