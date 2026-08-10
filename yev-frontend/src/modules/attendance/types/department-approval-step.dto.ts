// Cây duyệt cấu hình tay theo từng Bộ phận — CHỈ chứa 3 cấp duyệt CUỐI (Manager/Factory
// Manager/Director, terminalLevel != 0). 3 cấp trung gian cấu hình ở GroupApprovalStep theo từng
// Nhóm con thay vì ở đây (2026-08-08) — xem docs/docs-be/attendance-module.md §Cây chức vụ. Quản lý
// kiểu "thay nguyên danh sách" — không có Create/Update/Delete từng dòng riêng.
export interface DepartmentApprovalStepDto {
    id: number;
    departmentId: number;
    stepOrder: number;
    jobTitleId: number;
    jobTitleCode: string;
    jobTitleName: string;
    rankOrder: number;
    requiresSignature: boolean;
    // JobTitleTerminalLevel — luôn khác 0 (None) cho bước ở đây: 1=DepartmentManager,
    // 2=WorkshopManager, 3=GeneralDirector.
    terminalLevel: number;
}

// Payload PUT /by-department/{departmentId} — thứ tự phần tử trong mảng chính là StepOrder.
export interface ReplaceDepartmentApprovalStepItem {
    jobTitleId: number;
    requiresSignature: boolean;
}
