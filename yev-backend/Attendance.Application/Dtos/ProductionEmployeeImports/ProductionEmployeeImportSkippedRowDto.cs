namespace Attendance.Application.Dtos.ProductionEmployeeImports
{
    public class ProductionEmployeeImportSkippedRowDto
    {
        public int RowNumber { get; set; }
        public string? EmployeeCode { get; set; }
        public List<string> Errors { get; set; } = new();
    }
}
