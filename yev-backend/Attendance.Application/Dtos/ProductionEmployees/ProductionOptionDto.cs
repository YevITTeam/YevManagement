namespace Attendance.Application.Dtos.ProductionEmployees
{
    // Dùng chung cho 3 dropdown lọc (Line/Team/Nhóm ca) ở màn "Theo chuyền" — cùng shape đơn giản
    // Id/Code/Name, không cần 3 DTO riêng.
    public class ProductionOptionDto
    {
        public int Id { get; set; }
        public string Code { get; set; } = null!;
        public string? NameVn { get; set; }
    }
}
