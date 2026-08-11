// Người được Admin CHỈ ĐỊNH TAY phụ trách cấu hình Cây duyệt của 1 Bộ phận (2026-08-11, sửa
// 2026-08-11b: khoá theo employeeId, chỉ chọn được nhân viên thuộc đúng Bộ phận) — KHÔNG suy luận
// theo Chức vụ, xem docs/docs-be/attendance-module.md §Cây chức vụ, mục "Người phụ trách Cây duyệt".
// Quản lý kiểu "thay nguyên danh sách" — không có Create/Update/Delete từng dòng riêng.
export interface DepartmentApprovalStepCoordinatorDto {
    id: number;
    departmentId: number;
    employeeId: number;
    employeeCode: string;
    fullName: string;
    // null = nhân viên này CHƯA liên kết tài khoản đăng nhập (Employee.userName) — vẫn hợp lệ để gán,
    // nhưng quyền thao tác thật chỉ có hiệu lực SAU khi Admin liên kết tài khoản cho họ (tự động cấp
    // lúc đó, không cần thao tác gì thêm).
    userName: string | null;
}

// Payload PUT /by-department/{departmentId}.
export interface ReplaceDepartmentApprovalStepCoordinatorsDto {
    employeeIds: number[];
}
