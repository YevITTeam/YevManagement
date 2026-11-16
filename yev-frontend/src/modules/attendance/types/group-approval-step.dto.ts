export interface GroupApprovalStepMemberDto {
    employeeId: number;
    employeeCode: string;
    lastName: string;
    firstName: string;
    groupNameVn: string | null;
    // Everyone on the level may approve; only these people are mailed.
    receivesMail: boolean;
}

// Only the intermediate levels; terminal levels live in DepartmentApprovalStep.
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
    members: GroupApprovalStepMemberDto[];
    // People on this step may edit and re-sign a form after a Manager signed or rejected it.
    canResubmit: boolean;
    // With canResubmit: re-submission goes straight to the Manager, group steps re-signed with the current time.
    resubmitSkipsIntermediate: boolean;
    // JobTitleTerminalLevel, always 0 (None) here.
    terminalLevel: number;
}

export interface GroupBorrowedApproverDto {
    employeeId: number;
    jobTitleId: number | null;
    jobTitleName: string | null;
    employeeCode: string;
    lastName: string;
    firstName: string;
    groupNameVn: string | null;
    groupNameJp: string | null;
}

// candidates = everyone in the Department with an account; the source of the level pickers.
export interface GroupBorrowedApproversDto {
    candidates: GroupBorrowedApproverDto[];
    creatorMustSign: boolean;
    // Office forms: the edit right climbs with the approvals instead of staying with the creator.
    stepwiseEdit: boolean;
}

// Array order is the StepOrder.
export interface ReplaceGroupApprovalStepItem {
    jobTitleId: number;
    requiresSignature: boolean;
    isResponsible: boolean;
    canResubmit: boolean;
    resubmitSkipsIntermediate: boolean;
    members: { employeeId: number; receivesMail: boolean }[];
}

export interface ReplaceGroupApprovalTree {
    steps: ReplaceGroupApprovalStepItem[];
    creatorMustSign: boolean;
    stepwiseEdit: boolean;
}

export interface ApplyGroupLevelMember {
    employeeId: number;
    jobTitleId: number;
    receivesMail: boolean;
    groupIds: number[];
}

export interface ApplyGroupLevelMemberResult {
    appliedCount: number;
    skippedGroupNames: string[];
    onOtherLevelGroupNames: string[];
}
