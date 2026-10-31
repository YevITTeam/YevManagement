namespace Attendance.Application.Dtos.ProductionEmployeeImports
{
    // Soft-deleted on Confirm, so it disappears from the production-line picker.
    public class ProductionEmployeeRemovedRowDto
    {
        public string EmployeeCode { get; set; } = null!;
        public string FullName { get; set; } = null!;
    }
}
