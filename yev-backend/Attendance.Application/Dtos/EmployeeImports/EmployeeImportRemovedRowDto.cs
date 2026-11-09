namespace Attendance.Application.Dtos.EmployeeImports
{
    public class EmployeeImportRemovedRowDto
    {
        public string EmployeeCode { get; set; } = null!;
        public string FullName { get; set; } = null!;
        public string? LineCode { get; set; }
    }
}
