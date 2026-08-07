export interface JobTitleDto {
    id: number;
    code: string;
    name: string;
    rankOrder: number;
    // JobTitleTerminalLevel (docs/attendance-api-fe.md) — 0=None, 1=DepartmentManager, 2=WorkshopManager, 3=GeneralDirector.
    terminalLevel: number;
}

// GET /api/JobTitle/resolve-chain — xem trước chuỗi duyệt tự động (Giai đoạn 2, đọc-only, chưa wiring
// vào OtForm thật — xem docs/docs-be/attendance-module.md §Cây chức vụ).
export interface ResolvedApprovalCandidateDto {
    employeeId: number;
    userName: string;
    fullName: string;
}

export interface ResolvedApprovalStepDto {
    stepOrder: number;
    jobTitleCode: string;
    jobTitleName: string;
    rankOrder: number;
    requiresSignature: boolean;
    isResponsible: boolean;
    terminalLevel: number;
    candidates: ResolvedApprovalCandidateDto[];
}

export interface ResolveApprovalChainResultDto {
    isComplete: boolean;
    steps: ResolvedApprovalStepDto[];
    warning: string | null;
}
