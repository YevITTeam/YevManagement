export interface EmployeeDto {
    id: number;
    code: string;
    firstName: string;
    lastName: string;
    // Tài khoản AD của chính nhân viên (nullable) — dùng để liên kết người tạo đơn OT với đúng Employee
    // (docs §3.5).
    userName: string | null;
    // Giờ OT lũy kế THẬT (docs/attendance-api-fe.md §3.5) — BE tính trực tiếp từ ledger theo đúng
    // tháng/năm THỰC TẾ hôm nay mỗi lần đọc, không lưu cache nữa (2026-08-19). Dùng cảnh báo vượt
    // 25h/tháng hoặc 300h/năm.
    monthToDate: number;
    yearToDate: number;
    // Lũy kế DỰ KIẾN = thực tế + các đơn khác đang chờ duyệt (chưa Completed/Rejected) của người này
    // (2026-08-06) — dùng cảnh báo hạn mức lúc TẠO đơn mới thay cho monthToDate/yearToDate. CHỈ có ý
    // nghĩa khi lấy từ getEmployeesByGroup (scope theo ngày trên đơn đang tạo) — nơi khác trả về 0.
    projectedMonthToDate: number;
    projectedYearToDate: number;
    // Nullable (2026-08-08): Trưởng phòng dùng departmentId thay vì groupId (không thuộc Bộ phận cụ
    // thể nào); Trưởng Xưởng/Giám đốc cả 2 đều null (dùng chung toàn công ty) — xem
    // docs/attendance-api-fe.md §Cây chức vụ.
    groupId: number | null;
    groupNameVn: string | null;
    departmentId: number | null;
    departmentNameVn: string | null;

    // Chức vụ hiện tại (cây Chức vụ) — null nếu chưa được gán (xem docs/attendance-api-fe.md §Cây chức vụ).
    jobTitleId: number | null;
    jobTitleName: string | null;
}
