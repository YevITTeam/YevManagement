namespace Attendance.Application.Dtos.Employees
{
    // Query of the employee grid, reused by the "export filtered" buttons of the import dialogs.
    public class EmployeeExportFilterDto
    {
        public string? Keyword { get; set; }
        public int? DepartmentId { get; set; }
        public int? GroupId { get; set; }
        public int? WorkshopId { get; set; }
        public int? ProductionLineId { get; set; }
        public int? TeamId { get; set; }
        public int? ShiftTeamId { get; set; }
        public string? CongDoan { get; set; }
    }

    public class EmployeeExportRowDto
    {
        public string Code { get; set; } = null!;
        public string FullName { get; set; } = null!;
        public string? UserName { get; set; }
        public string? DepartmentCode { get; set; }
        public string? DepartmentNameVn { get; set; }
        public string? GroupCode { get; set; }
        public string? GroupNameVn { get; set; }
        public string? JobTitleCode { get; set; }
        public int TerminalLevel { get; set; }
        public decimal? CustomMonthlyOtHourLimit { get; set; }
        public decimal? CustomYearlyOtHourLimit { get; set; }
        // Ledger hours of the requested month, and of the year up to that month (opening balance included).
        public decimal MonthHours { get; set; }
        public decimal YearHours { get; set; }
        public string? LineCode { get; set; }
        public string? TeamCode { get; set; }
        public string? ShiftTeamCode { get; set; }
        public string? CongDoan { get; set; }
        public string? TaskName { get; set; }
    }
}
