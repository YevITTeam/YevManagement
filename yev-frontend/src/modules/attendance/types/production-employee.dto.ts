export interface ProductionEmployeeSearchItemDto {
    employeeId: number;
    employeeCode: string;
    fullName: string;
    congDoan: string | null;
    taskName: string | null;
    blockCode: string | null;
    teamCode: string | null;
    shiftTeamCode: string | null;
    shiftTeamNameVn: string | null;
    isLeader: boolean;
    // Lũy kế DỰ KIẾN (thực tế + đơn khác đang chờ duyệt), scope theo ngày trên đơn đang tạo — mirror
    // EmployeeDto.projectedDayToDate/projectedMonthToDate/projectedYearToDate (2026-08-26). Chỉ có ý
    // nghĩa khi gọi ProductionEmployeeApi.search kèm `date`.
    projectedDayToDate: number;
    projectedMonthToDate: number;
    projectedYearToDate: number;
    // Giới hạn giờ OT/tháng/năm RIÊNG cho người này — null = dùng mặc định chung (2026-08-26, mirror
    // EmployeeDto.customMonthlyOtHourLimit/customYearlyOtHourLimit).
    customMonthlyOtHourLimit: number | null;
    customYearlyOtHourLimit: number | null;
}

export interface ProductionOptionDto {
    id: number;
    code: string;
    nameVn: string | null;
}

// 1 dòng cho màn "Nhân viên dưới chuyền" (view riêng, đọc thẳng ProductionEmployees) — chỉ hiển thị,
// không có Sửa/Xoá (chỉnh qua import lại file Excel).
export interface ProductionEmployeeListItemDto {
    id: number;
    employeeId: number | null;
    employeeCode: string;
    fullName: string;
    congDoan: string | null;
    taskName: string | null;
    blockCode: string | null;
    teamCode: string | null;
    teamNameVn: string | null;
    shiftTeamCode: string | null;
    shiftTeamNameVn: string | null;
    isLeader: boolean;
    departmentNameVn: string | null;
    monthToDate: number;
    yearToDate: number;
}
