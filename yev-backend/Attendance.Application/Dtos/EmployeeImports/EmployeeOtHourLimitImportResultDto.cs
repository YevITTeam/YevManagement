namespace Attendance.Application.Dtos.EmployeeImports
{
    // Applied directly without Preview/Confirm: it only updates 2 nullable fields on existing employees.
    public class EmployeeOtHourLimitImportResultDto
    {
        public int UpdatedCount { get; set; }

        public int SkippedCount { get; set; }

        public List<EmployeeOtHourLimitImportRowResultDto> Rows { get; set; } = new();
    }

    public class EmployeeOtHourLimitImportRowResultDto
    {
        public int RowNumber { get; set; }

        public string EmployeeCode { get; set; } = null!;

        public bool Success { get; set; }

        public string? Error { get; set; }

        // Null = cell left empty, which keeps the existing override (does not clear it).
        public decimal? MonthlyLimit { get; set; }

        public decimal? YearlyLimit { get; set; }
    }
}
