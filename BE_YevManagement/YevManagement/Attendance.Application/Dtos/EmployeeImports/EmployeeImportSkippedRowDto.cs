namespace Attendance.Application.Dtos.EmployeeImports
{
    // 1 row skipped (not imported) at the Confirm step due to remaining validation errors — the
    // rest of the rows are still created normally, not blocking the whole batch (same behavior as
    // DeviceImportService in the Asset module).
    public class EmployeeImportSkippedRowDto
    {
        public int RowNumber { get; set; }
        public string? EmployeeCode { get; set; }
        public List<string> Errors { get; set; } = new();
    }
}
