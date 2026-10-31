// Only the 3 terminal levels (Manager/Factory Manager/Director); intermediate levels live in GroupApprovalStep.
// Replace-whole-list API, no per-row CRUD.
export interface DepartmentApprovalStepDto {
    id: number;
    departmentId: number;
    stepOrder: number;
    jobTitleId: number;
    jobTitleCode: string;
    jobTitleName: string;
    rankOrder: number;
    requiresSignature: boolean;
    // JobTitleTerminalLevel, never 0 here: 1=DepartmentManager, 2=WorkshopManager, 3=GeneralDirector.
    terminalLevel: number;
}

import type { DepartmentDto } from "./department.dto";

// canManage = Admin or department coordinator; otherwise only groupIds inside it are the caller's, read-only above.
export interface ApprovalTreeDepartmentDto extends DepartmentDto {
    canManage: boolean;
    groupIds: number[];
}

// Array order is the StepOrder.
export interface ReplaceDepartmentApprovalStepItem {
    jobTitleId: number;
    requiresSignature: boolean;
}
