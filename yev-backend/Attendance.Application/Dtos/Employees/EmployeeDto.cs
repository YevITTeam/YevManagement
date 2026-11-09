namespace Attendance.Application.Dtos.Employees
{
    public class EmployeeDto
    {
        public int Id { get; set; }
        public string Code { get; set; } = null!;
        public string FirstName { get; set; } = null!;
        public string LastName { get; set; } = null!;

        // The employee's own AD account (nullable) — used to adjust their own accumulation.
        public string? UserName { get; set; }

        // Computed from the EmployeeAccumulationHistory ledger on each read, not stored on Employee.
        public decimal MonthToDate { get; set; }
        public decimal YearToDate { get; set; }

        // Actual + other pending forms; only meaningful from GetByGroupIdAsync (scoped to the form's date), 0 elsewhere.
        public decimal ProjectedDayToDate { get; set; }
        public decimal ProjectedMonthToDate { get; set; }
        public decimal ProjectedYearToDate { get; set; }

        // Department Managers use DepartmentId instead; company-wide levels have both null.
        public int? GroupId { get; set; }
        public string? GroupNameVn { get; set; }
        public int? DepartmentId { get; set; }
        public string? DepartmentNameVn { get; set; }

        // Workshop of the employee's group (null for managers — they carry ApprovalScopes instead).
        public int? WorkshopId { get; set; }
        public string? WorkshopNameVn { get; set; }

        // (Workshop, Department) pairs a Department Manager approves for.
        public List<EmployeeApprovalScopeDto> ApprovalScopes { get; set; } = new();

        public int? JobTitleId { get; set; }
        public string? JobTitleName { get; set; }

        // Null = global default. No per-employee daily limit; daily is always global.
        public decimal? CustomMonthlyOtHourLimit { get; set; }
        public decimal? CustomYearlyOtHourLimit { get; set; }

        // Production fields, filled by the grid list only; ProductionLineId is null for people not on the roster.
        public int? ProductionLineId { get; set; }
        public string? LineCode { get; set; }
        public int? TeamId { get; set; }
        public string? TeamCode { get; set; }
        public int? ShiftTeamId { get; set; }
        public string? ShiftTeamCode { get; set; }
        public string? CongDoan { get; set; }
        public string? TaskName { get; set; }
    }
}
