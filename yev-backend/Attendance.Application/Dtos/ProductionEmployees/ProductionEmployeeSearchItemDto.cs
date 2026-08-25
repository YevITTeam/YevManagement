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
    }
}
