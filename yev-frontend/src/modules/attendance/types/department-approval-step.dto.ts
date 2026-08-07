// Cây duyệt cấu hình tay theo từng Phòng ban (2026-08-06) — xem docs/docs-be/attendance-module.md
// §Cây chức vụ. Quản lý kiểu "thay nguyên danh sách" — không có Create/Update/Delete từng dòng riêng.
export interface DepartmentApprovalStepDto {
    id: number;
    departmentId: number;
    stepOrder: number;
    jobTitleId: number;
    jobTitleCode: string;
    jobTitleName: string;
    rankOrder: number;
    requiresSignature: boolean;
    // "Người chịu trách nhiệm" trên form in — Admin tự đánh dấu tường minh tối đa 1 bước/Phòng ban
    // (2026-08-07). Chưa wiring vào OtForm thật (xem attendance-module.md §Cây chức vụ).
    isResponsible: boolean;
    // JobTitleTerminalLevel — 0=None, 1=DepartmentManager, 2=WorkshopManager, 3=GeneralDirector.
    terminalLevel: number;
}

// Payload PUT /by-department/{departmentId} — thứ tự phần tử trong mảng chính là StepOrder.
export interface ReplaceDepartmentApprovalStepItem {
    jobTitleId: number;
    requiresSignature: boolean;
    isResponsible: boolean;
}
