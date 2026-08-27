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
    // true CHỈ cho "Line Leader" — ai giữ lấy thẳng từ ProductionEmployee.IsLeader khi import, không
    // gán tay được nữa (2026-08-27, xem attendance-module.md).
    isLineScoped: boolean;
}

export interface ReplaceProductionApprovalStepItem {
    jobTitleId: number;
    requiresSignature: boolean;
    isResponsible: boolean;
}
