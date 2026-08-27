export interface JobTitleDto {
    id: number;
    code: string;
    name: string;
    rankOrder: number;
    // JobTitleTerminalLevel (docs/attendance-api-fe.md) — 0=None, 1=DepartmentManager, 2=WorkshopManager, 3=GeneralDirector.
    terminalLevel: number;
    // true CHỈ cho "Line Leader" — ai giữ lấy thẳng từ ProductionEmployee.IsLeader khi import, không
    // gán tay được nữa (2026-08-27). Optional: chỉ BE trả về (đọc), không phải field user tự sửa được
    // qua form Chức vụ (Create/UpdateJobTitleDto không có field này) — payload tạo/sửa không cần gửi.
    isLineScoped?: boolean;
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
