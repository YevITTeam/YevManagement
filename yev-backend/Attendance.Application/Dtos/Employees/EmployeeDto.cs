namespace Attendance.Application.Dtos.Employees
{
    public class EmployeeDto
    {
        public int Id { get; set; }
        public string Code { get; set; } = null!;
        public string FirstName { get; set; } = null!;
        public string LastName { get; set; } = null!;

        // The employee's own AD account (nullable) — used to adjust their own accumulation.
        public string? UserName { get; set; }

        // Lũy kế THẬT tính tới tháng/năm thực tế hiện tại — tính trực tiếp từ EmployeeAccumulationHistory
        // (ledger) mỗi lần đọc, KHÔNG lưu trên Employee nữa (2026-08-19, xem
        // docs/docs-be/attendance-module.md §Lũy kế — bỏ cache trên Employee).
        public decimal MonthToDate { get; set; }
        public decimal YearToDate { get; set; }

        // Lũy kế DỰ KIẾN — thực tế + các đơn khác đang chờ duyệt (chưa Completed/Rejected) của người
        // này, tính trực tiếp từ OtFormEmployee/OtForm (không lưu ở đâu cả). CHỈ được set có ý nghĩa bởi
        // EmployeeService.GetByGroupIdAsync (màn Tạo đơn OT, scope theo NGÀY TRÊN ĐƠN đang tạo, không
        // phải hôm nay thực tế) — mọi endpoint khác để mặc định 0, không dùng tới field này.
        public decimal ProjectedDayToDate { get; set; }
        public decimal ProjectedMonthToDate { get; set; }
        public decimal ProjectedYearToDate { get; set; }

        // Nullable (2026-08-08) — Trưởng phòng dùng DepartmentId thay vì GroupId (không thuộc Bộ phận
        // cụ thể nào); Trưởng Xưởng/Giám đốc cả 2 đều null (dùng chung toàn công ty) — xem
        // docs/docs-be/attendance-module.md §Cây chức vụ.
        public int? GroupId { get; set; }
        public string? GroupNameVn { get; set; }
        public int? DepartmentId { get; set; }
        public string? DepartmentNameVn { get; set; }

        // Workshop of the employee's group (null for managers — they carry ApprovalScopes instead).
        public int? WorkshopId { get; set; }
        public string? WorkshopNameVn { get; set; }

        // (Workshop, Department) pairs a Department Manager approves for.
        public List<EmployeeApprovalScopeDto> ApprovalScopes { get; set; } = new();

        // Chức vụ hiện tại (cây Chức vụ) — null nếu chưa được gán.
        public int? JobTitleId { get; set; }
        public string? JobTitleName { get; set; }

        // Giới hạn giờ OT/tháng/năm RIÊNG cho người này — null = dùng mặc định chung
        // (AttendanceSettingDto.MonthlyOtHourLimit/YearlyOtHourLimit). Không có Ngày riêng — Ngày luôn
        // dùng chung 1 mốc cho mọi người (2026-08-26, xem Employee.cs).
        public decimal? CustomMonthlyOtHourLimit { get; set; }
        public decimal? CustomYearlyOtHourLimit { get; set; }
    }
}
