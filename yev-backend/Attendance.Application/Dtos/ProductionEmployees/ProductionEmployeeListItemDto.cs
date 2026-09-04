namespace Attendance.Application.Dtos.ProductionEmployees
{
    // 1 dòng cho màn "Nhân viên dưới chuyền" (view riêng, đọc thẳng bảng ProductionEmployees thay vì
    // Employees) — xem ProductionEmployeeController.GetPaged / docs §Import nhân sự dưới chuyền. Nguồn
    // chính vẫn là Import Excel; ProductionLineId/TeamId/ShiftTeamId (2026-09-04) thêm để FE tự chọn
    // sẵn đúng giá trị hiện tại khi mở form sửa nhanh (UpdateProductionEmployeeDto).
    public class ProductionEmployeeListItemDto
    {
        public int Id { get; set; }
        public int? EmployeeId { get; set; }
        public string EmployeeCode { get; set; } = null!;
        public string FullName { get; set; } = null!;
        public string? CongDoan { get; set; }
        public string? TaskName { get; set; }
        public string? BlockCode { get; set; }
        public int? ProductionLineId { get; set; }
        public string? TeamCode { get; set; }
        public string? TeamNameVn { get; set; }
        public int? TeamId { get; set; }
        public string? ShiftTeamCode { get; set; }
        public string? ShiftTeamNameVn { get; set; }
        public int? ShiftTeamId { get; set; }
        public bool IsLeader { get; set; }
        public string? DepartmentNameVn { get; set; }
        public decimal MonthToDate { get; set; }
        public decimal YearToDate { get; set; }
    }
}
