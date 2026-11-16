namespace Attendance.Application.Dtos.ProductionEmployees
{
    public class ProductionOptionDto
    {
        public int Id { get; set; }
        public string Code { get; set; } = null!;
        public string? NameVn { get; set; }
        // Task options only.
        public string? StaffKind { get; set; }
        public int? WorkshopId { get; set; }
    }
}
