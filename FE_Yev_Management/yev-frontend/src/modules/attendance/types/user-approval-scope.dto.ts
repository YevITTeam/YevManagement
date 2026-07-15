export interface UserApprovalScopeDto {
    id: number;
    userName: string;
    // ScopeType (docs/attendance-api-fe.md §2): 0=Group, 1=Department.
    scopeType: number;
    scopeId: number;
    scopeName: string;
    // ApprovalLevel — chỉ dùng 1=DepartmentManager hoặc 2=WorkshopManager (Tổng Giám Đốc không tạo dòng này).
    approvalLevel: number;
}

export interface CreateUserApprovalScopeDto {
    userName: string;
    scopeType: number;
    scopeId: number;
    approvalLevel: number;
}
