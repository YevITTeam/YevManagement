export interface UserApprovalScopeDto {
    id: number;
    userName: string;
    // Tên thật, tra từ Identity — thêm 2026-07-17, có thể null nếu tài khoản chưa có FullName. FE luôn
    // hiển thị userFullName ?? userName (cùng convention createdByFullName/approverFullName ở OtForm).
    userFullName: string | null;
    // ScopeType (docs/attendance-api-fe.md §2): 0=Group, 1=Department.
    scopeType: number;
    scopeId: number;
    scopeName: string;
    // ApprovalLevel — 0=Submitter, 1=DepartmentManager, 2=WorkshopManager, 4=GroupHead (mới 2026-07-17).
    approvalLevel: number;
}

export interface CreateUserApprovalScopeDto {
    userName: string;
    scopeType: number;
    scopeId: number;
    approvalLevel: number;
}
