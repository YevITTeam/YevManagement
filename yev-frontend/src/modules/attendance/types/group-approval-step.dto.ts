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

// Someone from elsewhere in the Department lent to this Group: creates its forms and approves steps matching their title.
export interface GroupBorrowedApproverDto {
    employeeId: number;
    jobTitleId: number | null;
    employeeCode: string;
    lastName: string;
    firstName: string;
    groupNameVn: string | null;
    groupNameJp: string | null;
}

// approvers = already lent; candidates = everyone else in the Department with an account, outside this Group.
export interface GroupBorrowedApproversDto {
    approvers: GroupBorrowedApproverDto[];
    candidates: GroupBorrowedApproverDto[];
}

// Array order is the StepOrder.
export interface ReplaceGroupApprovalStepItem {
    jobTitleId: number;
    requiresSignature: boolean;
    isResponsible: boolean;
    canResubmit: boolean;
    resubmitSkipsIntermediate: boolean;
}
