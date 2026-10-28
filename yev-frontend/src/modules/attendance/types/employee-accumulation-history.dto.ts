// Lịch sử lũy kế THẬT theo tháng (2026-08-11d) — ghi dần từ ledger EmployeeAccumulationHistory, KHÔNG
// có dữ liệu trước thời điểm tính năng này ra đời (không backfill). Khác Employee.monthToDate/yearToDate
// (bộ đếm SỐNG, bị ghi đè về 0 khi rollover) — đây là bản lưu lại 12 tháng của 1 năm bất kỳ.
export interface EmployeeAccumulationHistoryMonthDto {
    month: number;
    totalHours: number;
}

export interface EmployeeAccumulationHistoryYearDto {
    employeeId: number;
    employeeCode: string;
    employeeFullName: string;
    year: number;
    // Luôn đủ 12 phần tử (tháng 1..12), tháng chưa có đơn Hoàn tất nào = totalHours 0.
    months: EmployeeAccumulationHistoryMonthDto[];
    // = tổng months[].totalHours + initialBalanceHours — với năm CŨ (đã rollover) đây là nguồn DUY NHẤT để biết tổng giờ cả
    // năm, vì Employee.yearToDate chỉ còn phản ánh năm hiện tại.
    yearTotalHours: number;
    initialBalanceHours?: number;
}

// Giờ OT của 1 ngày — chỉ các ngày có đơn Hoàn tất; giờ nhập/chỉnh tay ở lũy kế tháng không thuộc ngày nào.
export interface EmployeeAccumulationDayDto {
    date: string; // yyyy-MM-dd
    hours: number;
}

// Sửa tay lũy kế 1 năm (Attendance.EmployeeAccumulation.Update): đặt lại giờ từng tháng + số dư đầu kỳ.
// Tổng cả năm = initialBalanceHours + tổng 12 tháng.
export interface UpdateEmployeeAccumulationDto {
    year: number;
    initialBalanceHours: number;
    months: EmployeeAccumulationHistoryMonthDto[];
}
