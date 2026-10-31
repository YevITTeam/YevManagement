namespace Attendance.Application.Dtos.ProductionEmployeeImports
{
    public class ProductionEmployeeAccumulationResultDto
    {
        // Employees whose file "OT month" differed from the system; each got one adjustment row in EmployeeAccumulationHistory.
        public int AdjustedCount { get; set; }

        public int UnchangedCount { get; set; }

        public int SkippedCount { get; set; }
        public List<ProductionEmployeeAccumulationSkippedRowDto> SkippedRows { get; set; } = new();

        // Can be negative when the system total exceeded the file.
        public decimal TotalDeltaHours { get; set; }

        public int AdjustedYearCount { get; set; }
        public decimal TotalDeltaYearHours { get; set; }
    }

    public class ProductionEmployeeAccumulationSkippedRowDto
    {
        public string? EmployeeCode { get; set; }
        public string Reason { get; set; } = null!;
    }
}
