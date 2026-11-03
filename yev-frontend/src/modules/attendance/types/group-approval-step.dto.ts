// Only the 3 intermediate levels (Staff/Group Leader/Team Leader); terminal levels live in DepartmentApprovalStep.
// Replace-whole-list API, no per-row CRUD.
export interface GroupApprovalStepDto {
    id: number;
    groupId: number;
    stepOrder: number;
    jobTitleId: number;
    jobTitleCode: string;
    jobTitleName: string;
    rankOrder: number;
    requiresSignature: boolean;
    // "Responsible person" on the printed form; at most one step per group.
    isResponsible: boolean;
    // Holders of this step may edit and re-sign a form after a Manager signed or rejected it.
    canResubmit: boolean;
    // With canResubmit: re-submission goes straight to the Manager, group steps re-signed with the current time.
    resubmitSkipsIntermediate: boolean;
    // JobTitleTerminalLevel, always 0 (None) here.
    terminalLevel: number;
}

// A Team Leader of another Group (same Department) who approves this Group's Team Leader step.
export interface GroupBorrowedApproverDto {
    employeeId: number;
    employeeCode: string;
    lastName: string;
    firstName: string;
    groupNameVn: string | null;
    groupNameJp: string | null;
}

// approvers = already borrowed; candidates = Team Leaders of the other Groups in the same Department.
export interface GroupBorrowedApproversDto {
    approvers: GroupBorrowedApproverDto[];
    candidates: GroupBorrowedApproverDto[];
}

// Someone outside the Group (same Department, has an account) allowed to create its office OT forms.
export interface GroupOtFormCreatorDto {
    employeeId: number;
    employeeCode: string;
    lastName: string;
    firstName: string;
    groupNameVn: string | null;
}

// creators = already granted; candidates = everyone else eligible.
export interface GroupOtFormCreatorsDto {
    creators: GroupOtFormCreatorDto[];
    candidates: GroupOtFormCreatorDto[];
}

// Array order is the StepOrder.
export interface ReplaceGroupApprovalStepItem {
    jobTitleId: number;
    requiresSignature: boolean;
    isResponsible: boolean;
    canResubmit: boolean;
    resubmitSkipsIntermediate: boolean;
}
