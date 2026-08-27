namespace Attendance.Application.Dtos.ProductionEmployees
{
    // 1 dòng cho màn "Nhân viên dưới chuyền" (view riêng, đọc thẳng bảng ProductionEmployees thay vì
    // Employees) — xem ProductionEmployeeController.GetPaged / docs §Import nhân sự dưới chuyền.
    // Chỉ hiển thị, không có thao tác Sửa/Xoá — chỉnh dữ liệu qua import lại file Excel.
    public class ProductionEmployeeListItemDto
    {
        public int Id { get; set; }
        public int? EmployeeId { get; set; }
        public string EmployeeCode { get; set; } = null!;
        public string FullName { get; set; } = null!;
        public string? CongDoan { get; set; }
        public string? TaskName { get; set; }
        public string? BlockCode { get; set; }
        public string? TeamCode { get; set; }
        public string? TeamNameVn { get; set; }
        public string? ShiftTeamCode { get; set; }
        public string? ShiftTeamNameVn { get; set; }
        public bool IsLeader { get; set; }
        public string? DepartmentNameVn { get; set; }
        public decimal MonthToDate { get; set; }
        public decimal YearToDate { get; set; }
    }
}
