export interface OtCaseDto {
    id: number;
    code: string;
    description: string | null;
    requireSignature: boolean;
    // JobTitleTerminalLevel (docs/attendance-api-fe.md §2) — chỉ 1/2/3 hợp lệ (DepartmentManager/
    // WorkshopManager/GeneralDirector).
    requiredApprovalLevel: number;
}
