// Must match BE enums (Workflow.Domain.Enums).
export const RequestStatus = {
    Draft: 1,
    Submitted: 2,
    InProgress: 3,
    Approved: 4,
    Rejected: 5,
    SentBack: 6,
    Cancelled: 7,
} as const;
export type RequestStatus = (typeof RequestStatus)[keyof typeof RequestStatus];

export const StepStatus = {
    Waiting: 1,
    Current: 2,
    Approved: 3,
    Rejected: 4,
    Skipped: 5,
} as const;
export type StepStatus = (typeof StepStatus)[keyof typeof StepStatus];

export const RequestAction = {
    Submit: 1,
    Approve: 2,
    Reject: 3,
    SendBack: 4,
    Cancel: 5,
    AddApprover: 6,
    Comment: 7,
    Resubmit: 8,
} as const;
export type RequestAction = (typeof RequestAction)[keyof typeof RequestAction];

// BE returns DataJson/FormSchemaJson already parsed, not as strings.
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface AvailableFormDto {
    id: number;
    code: string;
    nameVn: string;
    nameJp: string | null;
    formCategoryNameVn: string | null;
    allowAttachment: boolean;
    requireAttachment: boolean;
}

export interface MyEmployeeDto {
    id: number;
    employeeCode: string;
    fullName: string;
}

export interface WorkflowRequestStepParticipantDto {
    id: number;
    employeeId: number;
    employeeFullName: string | null;
    participantRole: number;
    resolvedFromJobTitle: string | null;
    actedAt: string | null;
}

export interface WorkflowRequestStepDto {
    id: number;
    stepOrder: number;
    stepNameSnapshot: string;
    stepTypeSnapshot: number;
    orgUnitNameSnapshot: string | null;
    approverModeSnapshot: number;
    requireSignatureSnapshot: boolean;
    allowSendBackSnapshot: boolean;
    allowAddApproverSnapshot: boolean;
    status: StepStatus;
    isAdHoc: boolean;
    insertedByEmployeeId: number | null;
    insertedByEmployeeName: string | null;
    actedByEmployeeId: number | null;
    actedByEmployeeName: string | null;
    actedAt: string | null;
    participants: WorkflowRequestStepParticipantDto[];
}

export interface WorkflowRequestHistoryDto {
    id: number;
    stepOrder: number;
    actorEmployeeId: number;
    actorNameSnapshot: string;
    onBehalfOfEmployeeId: number | null;
    onBehalfOfEmployeeName: string | null;
    action: RequestAction;
    sentBackToStepOrder: number | null;
    comment: string | null;
    signatureImageBase64: string | null;
    actionAt: string;
}

export interface WorkflowAttachmentDto {
    id: number;
    originalFileName: string;
    contentType: string;
    fileSizeBytes: number;
    uploadedByEmployeeId: number;
    uploadedByEmployeeName: string;
    uploadedAt: string;
}

export interface WorkflowRequestDto {
    id: number;
    requestCode: string | null;
    formDefinitionId: number;
    formDefinitionNameVn: string;
    formRouteId: number | null;
    routeConditionSnapshot: string | null;
    formVersion: number;
    dataJson: Record<string, JsonValue> | null;
    formSchemaJson: FormSchemaSnapshot | null;
    status: RequestStatus;
    currentStepOrder: number;
    createdByEmployeeId: number;
    createdByEmployeeName: string;
    createdByOrgUnitId: number | null;
    createdByOrgUnitNameVn: string | null;
    createdAt: string;
    submittedAt: string | null;
    completedAt: string | null;
    steps: WorkflowRequestStepDto[];
    histories: WorkflowRequestHistoryDto[];
    attachments: WorkflowAttachmentDto[];
}

// Must match WorkflowRequestService.BuildFormSchemaJson exactly. Submitted (read-only) requests only;
// Drafts use the live FormFieldDto instead.
export interface FormSchemaFieldSnapshot {
    fieldKey: string;
    labelVn: string;
    labelJp: string | null;
    dataType: number;
    isRequired: boolean;
    sortOrder: number;
    columnSpan: number;
    optionsJson: string | null;
    formDataSourceId: number | null;
    defaultVisible: boolean;
}

export interface FormSchemaConditionSnapshot {
    targetFieldKey: string;
    sourceFieldKey: string;
    operator: number;
    compareValue: string | null;
    compareValue2: string | null;
    effect: number;
    logicGroup: number;
}

export interface FormSchemaSnapshot {
    fields: FormSchemaFieldSnapshot[];
    conditions: FormSchemaConditionSnapshot[];
    // .docx layout snapshotted at submit; null in grid mode.
    layoutHtml: string | null;
}

export interface WorkflowRequestListItemDto {
    id: number;
    requestCode: string | null;
    formDefinitionId: number;
    formDefinitionNameVn: string;
    status: RequestStatus;
    currentStepOrder: number;
    createdByEmployeeId: number;
    createdByEmployeeName: string;
    createdAt: string;
    submittedAt: string | null;
    completedAt: string | null;
}

export interface CreateWorkflowRequestDraftDto {
    formDefinitionId: number;
    dataJson: Record<string, JsonValue>;
}

export interface UpdateWorkflowRequestDraftDto {
    dataJson: Record<string, JsonValue>;
}

export interface ApproveRequestDto {
    comment: string | null;
    signatureImageBase64: string | null;
    onBehalfOfEmployeeId: number | null;
}

export interface RejectRequestDto {
    comment: string;
    onBehalfOfEmployeeId: number | null;
}

export interface SendBackRequestDto {
    targetStepOrder: number;
    comment: string | null;
    onBehalfOfEmployeeId: number | null;
}

export interface AddApproverRequestDto {
    employeeId: number;
    insertAfterStepOrder: number;
    nameVn: string | null;
    onBehalfOfEmployeeId: number | null;
}

export interface CancelRequestDto {
    reason: string | null;
}

export interface ResubmitRequestDto {
    comment: string | null;
}

// Email approval: no OnBehalfOfEmployeeId (no delegation via email) and no signature image (BE uses EmployeeSignatures).
export interface EmailApproveRequestDto {
    comment: string | null;
}

export interface EmailRejectRequestDto {
    comment: string;
}
