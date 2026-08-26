namespace Attendance.Application.Dtos.ProductionEmployees
{
    // 1 dòng kết quả tìm kiếm cho màn "Theo chuyền" khi tạo đơn OT — chỉ trả về người ĐÃ resolve đủ
    // EmployeeId (bảng ProductionEmployees chỉ chứa dòng đã resolve đủ theo policy nạp, xem
    // ProductionEmployee.cs) nên luôn chọn được thẳng vào đơn.
    public class ProductionEmployeeSearchItemDto
    {
        public int EmployeeId { get; set; }
        public string EmployeeCode { get; set; } = null!;
        public string FullName { get; set; } = null!;
        public string? CongDoan { get; set; }
        public string? TaskName { get; set; }
        public string? BlockCode { get; set; }
        public string? TeamCode { get; set; }
        public string? ShiftTeamCode { get; set; }
        public string? ShiftTeamNameVn { get; set; }
        public bool IsLeader { get; set; }

        // Lũy kế DỰ KIẾN (thực tế + đơn khác đang chờ duyệt), scope theo ngày/tháng/năm của `date` query
        // param — mirror EmployeeDto.ProjectedDayToDate/MonthToDate/YearToDate (2026-08-26), dùng để cảnh
        // báo vượt AttendanceSetting.DailyOtHourLimit/MonthlyOtHourLimit/YearlyOtHourLimit NGAY lúc chọn
        // người ở màn "Theo chuyền" — trước đây bảng này không có cảnh báo gì (thiếu sót so với bảng
        // "Theo Nhóm"). Chỉ có ý nghĩa khi `date` được truyền, xem ProductionEmployeeService.SearchAsync.
        public decimal ProjectedDayToDate { get; set; }
        public decimal ProjectedMonthToDate { get; set; }
        public decimal ProjectedYearToDate { get; set; }

        // Giới hạn giờ OT/tháng/năm RIÊNG cho người này — null = dùng mặc định chung (2026-08-26, mirror
        // EmployeeDto.CustomMonthlyOtHourLimit/CustomYearlyOtHourLimit, xem Employee.cs).
        public decimal? CustomMonthlyOtHourLimit { get; set; }
        public decimal? CustomYearlyOtHourLimit { get; set; }
    }
}
