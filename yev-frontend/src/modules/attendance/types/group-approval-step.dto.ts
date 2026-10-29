// Cây duyệt cấu hình tay theo từng Nhóm (2026-08-08) — CHỈ chứa 3 cấp trung gian dưới Manager
// (Staff/Group Leader/Team Leader, terminalLevel=0/None). 3 cấp cuối vẫn cấu hình ở
// DepartmentApprovalStep theo Bộ phận — xem docs/docs-be/attendance-module.md §Cây chức vụ. Quản lý
// kiểu "thay nguyên danh sách" — không có Create/Update/Delete từng dòng riêng (mirror
// department-approval-step.dto.ts).
export interface GroupApprovalStepDto {
    id: number;
    groupId: number;
    stepOrder: number;
    jobTitleId: number;
    jobTitleCode: string;
    jobTitleName: string;
    rankOrder: number;
    requiresSignature: boolean;
    // "Người chịu trách nhiệm" trên form in — Admin tự đánh dấu tường minh tối đa 1 bước/Nhóm.
    isResponsible: boolean;
    // Holders of this step may edit and re-sign a form after a Manager signed it.
    canResubmit: boolean;
    // JobTitleTerminalLevel — luôn = 0 (None) cho bước ở đây.
    terminalLevel: number;
}

// A Team Leader of another Group (same Department) who approves this Group's Team Leader step.
export interface GroupBorrowedApproverDto {
    employeeId: number;
    employeeCode: string;
    lastName: string;
    firstName: string;
    groupNameVn: string | null;
    groupNameJp: string | null;
}

// approvers = already borrowed; candidates = Team Leaders of the other Groups in the same Department.
export interface GroupBorrowedApproversDto {
    approvers: GroupBorrowedApproverDto[];
    candidates: GroupBorrowedApproverDto[];
}

// A Team Leader of another Group (same Department) who approves this Group's Team Leader step.
export interface GroupBorrowedApproverDto {
    employeeId: number;
    employeeCode: string;
    lastName: string;
    firstName: string;
    groupNameVn: string | null;
    groupNameJp: string | null;
}

// approvers = already borrowed; candidates = Team Leaders of the other Groups in the same Department.
export interface GroupBorrowedApproversDto {
    approvers: GroupBorrowedApproverDto[];
    candidates: GroupBorrowedApproverDto[];
}

// Payload PUT /by-group/{groupId} — thứ tự phần tử trong mảng chính là StepOrder.
export interface ReplaceGroupApprovalStepItem {
    jobTitleId: number;
    requiresSignature: boolean;
    isResponsible: boolean;
    canResubmit: boolean;
}
