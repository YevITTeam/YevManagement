export interface JobTitleDto {
    id: number;
    code: string;
    name: string;
    rankOrder: number;
    // JobTitleTerminalLevel: 0=None, 1=DepartmentManager, 2=WorkshopManager, 3=GeneralDirector.
    terminalLevel: number;
    // true only for "Line Leader"; holders act only on their own line.
    // Read-only, not part of create/update payloads.
    isLineScoped?: boolean;
}

// Read-only preview of the auto-resolved approval chain.
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
