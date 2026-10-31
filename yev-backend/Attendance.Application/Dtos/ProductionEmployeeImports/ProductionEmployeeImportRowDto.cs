namespace Attendance.Application.Dtos.ProductionEmployeeImports
{
    // Shared by Preview (server fills Resolved*/Is*/Errors), Confirm (server re-resolves from scratch)
    // and ApplyAccumulation (only EmployeeCode + OtMonthHours are used).
    public class ProductionEmployeeImportRowDto
    {
        public int RowNumber { get; set; }

        public string? EmployeeCode { get; set; }
        public string? LastName { get; set; }
        public string? FirstName { get; set; }
        public string? CongDoan { get; set; }
        public string? TaskName { get; set; }
        public string? BlockCode { get; set; }
        public string? TeamCode { get; set; }
        public string? ShiftTeamCode { get; set; }
        public bool IsLeader { get; set; }

        // Display only during Confirm; written solely by the separate ApplyAccumulation step.
        public decimal? OtMonthHours { get; set; }
        public decimal? OtYearHours { get; set; }

        public int? ResolvedProductionLineId { get; set; }
        public int? ResolvedTeamId { get; set; }
        public int? ResolvedShiftTeamId { get; set; }

        public bool IsNewEmployee { get; set; }
        public bool IsNewProductionEmployee { get; set; }
        public bool IsUpdatedProductionEmployee { get; set; }

        public bool IsValid { get; set; }
        public List<string> Errors { get; set; } = new();
    }
}
