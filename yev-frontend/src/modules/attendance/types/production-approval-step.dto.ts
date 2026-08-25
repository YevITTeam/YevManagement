export interface ProductionApprovalStepDto {
    id: number;
    departmentId: number;
    stepOrder: number;
    jobTitleId: number;
    jobTitleCode: string;
    jobTitleName: string;
    rankOrder: number;
    requiresSignature: boolean;
    terminalLevel: number;
}

export interface ReplaceProductionApprovalStepItem {
    jobTitleId: number;
    requiresSignature: boolean;
}
