export interface OtCaseDto {
    id: number;
    code: string;
    description: string | null;
    descriptionJp: string | null;
    requireSignature: boolean;
    // JobTitleTerminalLevel (docs/attendance-module.md §API) — chỉ 1/2/3 hợp lệ (DepartmentManager/
    // WorkshopManager/GeneralDirector).
    requiredApprovalLevel: number;
}
