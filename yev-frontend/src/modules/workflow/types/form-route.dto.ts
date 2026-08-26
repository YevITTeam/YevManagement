// workflow-module.md §4 — khớp enum ở BE (Workflow.Domain.Enums).
export const OrgUnitScope = {
    Fixed: 1,
    ApplicantUnit: 2,
} as const;
export type OrgUnitScope = (typeof OrgUnitScope)[keyof typeof OrgUnitScope];

export const StepType = {
    Approve: 1,
    Confirm: 2,
} as const;
export type StepType = (typeof StepType)[keyof typeof StepType];

export const ApproverMode = {
    Any: 1,
    All: 2,
} as const;
export type ApproverMode = (typeof ApproverMode)[keyof typeof ApproverMode];

export const ParticipantSource = {
    Employee: 1,
    JobTitle: 2,
} as const;
export type ParticipantSource = (typeof ParticipantSource)[keyof typeof ParticipantSource];

export const ParticipantRole = {
    Approver: 1,
    Viewer: 2,
} as const;
export type ParticipantRole = (typeof ParticipantRole)[keyof typeof ParticipantRole];

export interface FormApprovalStepParticipantDto {
    id: number;
    participantSource: ParticipantSource;
    employeeId: number | null;
    employeeFullName: string | null;
    jobTitleId: number | null;
    jobTitleNameVn: string | null;
    participantRole: ParticipantRole;
    sortOrder: number;
}

export interface FormApprovalStepDto {
    id: number;
    stepOrder: number;
    nameVn: string;
    nameJp: string | null;
    stepType: StepType;
    orgUnitScope: OrgUnitScope;
    orgUnitId: number | null;
    orgUnitNameVn: string | null;
    approverMode: ApproverMode;
    requireSignature: boolean;
    allowSendBack: boolean;
    allowAddApprover: boolean;
    participants: FormApprovalStepParticipantDto[];
}

export interface FormRouteDto {
    id: number;
    nameVn: string;
    nameJp: string | null;
    sortOrder: number;
    minValue: number | null;
    maxValue: number | null;
    classValue: string | null;
    isDefault: boolean;
    steps: FormApprovalStepDto[];
}

// Replace* — KHÔNG có Id ở cấp Step/Participant (luôn xoá-tất-tạo-lại mỗi lần lưu route, workflow-
// module.md §3.2). Chỉ FormRoute có Id (nullable = route mới) vì WorkflowRequests.FormRouteId (Pha
// 3B) sẽ là FK thật trỏ vào đây.
export interface ReplaceFormApprovalStepParticipantItemDto {
    participantSource: ParticipantSource;
    employeeId: number | null;
    jobTitleId: number | null;
    participantRole: ParticipantRole;
}

export interface ReplaceFormApprovalStepItemDto {
    nameVn: string;
    nameJp: string | null;
    stepType: StepType;
    orgUnitScope: OrgUnitScope;
    orgUnitId: number | null;
    approverMode: ApproverMode;
    requireSignature: boolean;
    allowSendBack: boolean;
    allowAddApprover: boolean;
    participants: ReplaceFormApprovalStepParticipantItemDto[];
}

export interface ReplaceFormRouteItemDto {
    id: number | null;
    nameVn: string;
    nameJp: string | null;
    minValue: number | null;
    maxValue: number | null;
    classValue: string | null;
    isDefault: boolean;
    steps: ReplaceFormApprovalStepItemDto[];
}
