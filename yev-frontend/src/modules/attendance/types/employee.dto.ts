export interface EmployeeDto {
    id: number;
    code: string;
    firstName: string;
    lastName: string;
    // Tài khoản AD của chính nhân viên (nullable) — dùng cho "Lũy kế của tôi" (docs §3.5/§3.6).
    userName: string | null;
    // Giờ OT lũy kế (docs/attendance-api-fe.md §3.5) — dùng cảnh báo TH3 vượt 25h/tháng hoặc 300h/năm.
    monthToDate: number;
    yearToDate: number;
    // Tháng/năm mà monthToDate/yearToDate đang phản ánh — BE tự stamp, rollover tự động theo tháng/năm.
    accumulationYear: number;
    accumulationMonth: number;
    // Lũy kế DỰ KIẾN = thực tế + các đơn khác đang chờ duyệt (chưa Completed/Rejected) của người này
    // (2026-08-06) — dùng cảnh báo hạn mức lúc TẠO đơn mới thay cho monthToDate/yearToDate, để thấy
    // được cả những đơn khác đang treo chưa duyệt.
    projectedMonthToDate: number;
    projectedYearToDate: number;
    groupId: number;
    groupNameVn: string;

    // Chức vụ hiện tại (cây Chức vụ) — null nếu chưa được gán (xem docs/attendance-api-fe.md §Cây chức vụ).
    jobTitleId: number | null;
    jobTitleName: string | null;
}

// Body PATCH /api/Employee/{id}/adjust-accumulation — docs §3.6, cả 2 field bắt buộc >= 0.
export interface AdjustEmployeeAccumulationDto {
    monthToDate: number;
    yearToDate: number;
}
