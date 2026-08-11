// Người được Admin CHỈ ĐỊNH TAY phụ trách cấu hình Cây duyệt của 1 Nhóm (2026-08-11, sửa 2026-08-11b:
// khoá theo employeeId, chỉ chọn được nhân viên thuộc đúng Nhóm) — mirror
// DepartmentApprovalStepCoordinatorDto nhưng khoá theo groupId.
export interface GroupApprovalStepCoordinatorDto {
    id: number;
    groupId: number;
    employeeId: number;
    employeeCode: string;
    fullName: string;
    // null = chưa liên kết tài khoản đăng nhập — xem DepartmentApprovalStepCoordinatorDto.userName.
    userName: string | null;
}

// Payload PUT /by-group/{groupId}.
export interface ReplaceGroupApprovalStepCoordinatorsDto {
    employeeIds: number[];
}
