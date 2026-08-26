import { api, getForBlob, type BlobDownloadResult } from "@/lib/client";
import type {
    AvailableFormDto,
    MyEmployeeDto,
    WorkflowRequestDto,
    WorkflowRequestListItemDto,
    CreateWorkflowRequestDraftDto,
    UpdateWorkflowRequestDraftDto,
    ApproveRequestDto,
    RejectRequestDto,
    SendBackRequestDto,
    AddApproverRequestDto,
    CancelRequestDto,
} from "@/modules/workflow/types/workflow-request.dto";
import type { FormFieldDto } from "@/modules/workflow/types/form-field.dto";
import type { FormFieldConditionDto } from "@/modules/workflow/types/form-field-condition.dto";
import { ApiResponse, ApiResponseWithPageNation } from "@/types/api";

const ENDPOINTS = {
    WORKFLOW_REQUEST: {
        availableForms: "/Workflow/WorkflowRequest/available-forms",
        formSchema: (formDefinitionId: number) => `/Workflow/WorkflowRequest/form-schema/${formDefinitionId}`,
        myEmployee: "/Workflow/WorkflowRequest/my-employee",
        createDraft: "/Workflow/WorkflowRequest",
        updateDraft: (id: number) => `/Workflow/WorkflowRequest/${id}`,
        getById: (id: number) => `/Workflow/WorkflowRequest/${id}`,
        myRequests: "/Workflow/WorkflowRequest/my-requests",
        pendingMyApproval: "/Workflow/WorkflowRequest/pending-my-approval",
        visibleToMe: "/Workflow/WorkflowRequest/visible-to-me",
        submit: (id: number) => `/Workflow/WorkflowRequest/${id}/submit`,
        cancel: (id: number) => `/Workflow/WorkflowRequest/${id}/cancel`,
        approve: (id: number) => `/Workflow/WorkflowRequest/${id}/approve`,
        reject: (id: number) => `/Workflow/WorkflowRequest/${id}/reject`,
        sendBack: (id: number) => `/Workflow/WorkflowRequest/${id}/send-back`,
        addApprover: (id: number) => `/Workflow/WorkflowRequest/${id}/add-approver`,
        uploadAttachment: (id: number) => `/Workflow/WorkflowRequest/${id}/attachments`,
        deleteAttachment: (attachmentId: number) => `/Workflow/WorkflowRequest/attachments/${attachmentId}`,
        downloadAttachment: (attachmentId: number) => `/Workflow/WorkflowRequest/attachments/${attachmentId}/download`,
    },
} as const;

export interface WorkflowRequestFormSchemaDto {
    formDefinitionId: number;
    code: string;
    nameVn: string;
    nameJp: string | null;
    description: string | null;
    allowAttachment: boolean;
    requireAttachment: boolean;
    fields: FormFieldDto[];
    conditions: FormFieldConditionDto[];
}

export interface GetWorkflowRequestListParams {
    pageIndex?: number;
    pageSize?: number;
    status?: number;
}

function buildListQuery(params?: GetWorkflowRequestListParams) {
    const query = new URLSearchParams();
    if (params?.pageIndex) query.set("PageIndex", String(params.pageIndex));
    if (params?.pageSize) query.set("PageSize", String(params.pageSize));
    if (params?.status !== undefined) query.set("Status", String(params.status));
    const queryString = query.toString();
    return queryString ? `?${queryString}` : "";
}

export const WorkflowRequestApi = {
    getAvailableForms: async () => {
        const response = await api.get<ApiResponse<AvailableFormDto[]>>(ENDPOINTS.WORKFLOW_REQUEST.availableForms);
        return response.data;
    },

    getFormSchema: async (formDefinitionId: number) => {
        const response = await api.get<ApiResponse<WorkflowRequestFormSchemaDto>>(ENDPOINTS.WORKFLOW_REQUEST.formSchema(formDefinitionId));
        return response.data;
    },

    getMyEmployee: async () => {
        const response = await api.get<ApiResponse<MyEmployeeDto>>(ENDPOINTS.WORKFLOW_REQUEST.myEmployee);
        return response.data;
    },

    createDraft: async (data: CreateWorkflowRequestDraftDto) => {
        const response = await api.post<ApiResponse<WorkflowRequestDto>>(ENDPOINTS.WORKFLOW_REQUEST.createDraft, data);
        return response.data;
    },

    updateDraft: async (id: number, data: UpdateWorkflowRequestDraftDto) => {
        const response = await api.put<ApiResponse<WorkflowRequestDto>>(ENDPOINTS.WORKFLOW_REQUEST.updateDraft(id), data);
        return response.data;
    },

    getById: async (id: number) => {
        const response = await api.get<ApiResponse<WorkflowRequestDto>>(ENDPOINTS.WORKFLOW_REQUEST.getById(id));
        return response.data;
    },

    getMyRequests: async (params?: GetWorkflowRequestListParams) => {
        const response = await api.get<ApiResponseWithPageNation<WorkflowRequestListItemDto>>(
            ENDPOINTS.WORKFLOW_REQUEST.myRequests + buildListQuery(params)
        );
        return response.data;
    },

    getPendingMyApproval: async (params?: GetWorkflowRequestListParams) => {
        const response = await api.get<ApiResponseWithPageNation<WorkflowRequestListItemDto>>(
            ENDPOINTS.WORKFLOW_REQUEST.pendingMyApproval + buildListQuery(params)
        );
        return response.data;
    },

    getVisibleToMe: async (params?: GetWorkflowRequestListParams) => {
        const response = await api.get<ApiResponseWithPageNation<WorkflowRequestListItemDto>>(
            ENDPOINTS.WORKFLOW_REQUEST.visibleToMe + buildListQuery(params)
        );
        return response.data;
    },

    submit: async (id: number) => {
        const response = await api.post<ApiResponse<WorkflowRequestDto>>(ENDPOINTS.WORKFLOW_REQUEST.submit(id), {});
        return response.data;
    },

    cancel: async (id: number, data: CancelRequestDto) => {
        const response = await api.post<ApiResponse<WorkflowRequestDto>>(ENDPOINTS.WORKFLOW_REQUEST.cancel(id), data);
        return response.data;
    },

    approve: async (id: number, data: ApproveRequestDto) => {
        const response = await api.post<ApiResponse<WorkflowRequestDto>>(ENDPOINTS.WORKFLOW_REQUEST.approve(id), data);
        return response.data;
    },

    reject: async (id: number, data: RejectRequestDto) => {
        const response = await api.post<ApiResponse<WorkflowRequestDto>>(ENDPOINTS.WORKFLOW_REQUEST.reject(id), data);
        return response.data;
    },

    sendBack: async (id: number, data: SendBackRequestDto) => {
        const response = await api.post<ApiResponse<WorkflowRequestDto>>(ENDPOINTS.WORKFLOW_REQUEST.sendBack(id), data);
        return response.data;
    },

    addApprover: async (id: number, data: AddApproverRequestDto) => {
        const response = await api.post<ApiResponse<WorkflowRequestDto>>(ENDPOINTS.WORKFLOW_REQUEST.addApprover(id), data);
        return response.data;
    },

    uploadAttachment: async (id: number, file: File) => {
        const formData = new FormData();
        formData.append("file", file);
        const response = await api.postForm<ApiResponse<WorkflowRequestDto>>(ENDPOINTS.WORKFLOW_REQUEST.uploadAttachment(id), formData);
        return response.data;
    },

    deleteAttachment: async (attachmentId: number) => {
        const response = await api.delete<ApiResponse<WorkflowRequestDto>>(ENDPOINTS.WORKFLOW_REQUEST.deleteAttachment(attachmentId));
        return response.data;
    },

    downloadAttachment: async (attachmentId: number): Promise<BlobDownloadResult> => {
        return getForBlob(ENDPOINTS.WORKFLOW_REQUEST.downloadAttachment(attachmentId));
    },
};

export { ENDPOINTS };
