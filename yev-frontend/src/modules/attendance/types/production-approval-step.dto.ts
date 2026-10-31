export interface ProductionApprovalStepDto {
    id: number;
    departmentId: number;
    stepOrder: number;
    jobTitleId: number;
    jobTitleCode: string;
    jobTitleName: string;
    rankOrder: number;
    requiresSignature: boolean;
    isResponsible: boolean;
    terminalLevel: number;
    // true only for "Line Leader"; holders come from ProductionEmployee.IsLeader on import.
    isLineScoped: boolean;
}

export interface ReplaceProductionApprovalStepItem {
    jobTitleId: number;
    requiresSignature: boolean;
    isResponsible: boolean;
}
