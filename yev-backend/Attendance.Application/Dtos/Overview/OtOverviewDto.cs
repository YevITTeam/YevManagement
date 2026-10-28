namespace Attendance.Application.Dtos.Overview
{
    public class OtOverviewDto
    {
        public int Year { get; set; }
        public int Month { get; set; }
        public int EmployeeCount { get; set; }
        public decimal MonthlyLimit { get; set; }
        public decimal YearlyLimit { get; set; }

        // Ledger totals (include imported / hand-edited hours), unlike the by-day and by-unit figures below.
        public decimal MonthHours { get; set; }
        public decimal PreviousMonthHours { get; set; }

        public int FormsInApproval { get; set; }
        public int FormsCompleted { get; set; }
        public int FormsRejected { get; set; }

        public int OverMonthlyCount { get; set; }
        public int OverYearlyCount { get; set; }
        public int OverAnyCount { get; set; }
        public int NearLimitCount { get; set; }

        public List<OtOverviewDayDto> DailyHours { get; set; } = new();
        public List<OtOverviewMonthDto> MonthlyTrend { get; set; } = new();
        public List<OtOverviewUnitDto> ByDepartment { get; set; } = new();
        public List<OtOverviewUnitDto> ByWorkshop { get; set; } = new();
        public List<OtOverviewCaseDto> ByOtCase { get; set; } = new();
        public List<OtOverviewEmployeeRowDto> RiskEmployees { get; set; } = new();
    }

    public class OtOverviewDayDto
    {
        public DateOnly Date { get; set; }
        public decimal Hours { get; set; }
    }

    public class OtOverviewMonthDto
    {
        public int Month { get; set; }
        public decimal Hours { get; set; }
    }

    public class OtOverviewUnitDto
    {
        public int Id { get; set; }
        public string NameVn { get; set; } = null!;
        public string? NameJp { get; set; }
        public decimal Hours { get; set; }
        public int OverLimitCount { get; set; }
    }

    public class OtOverviewCaseDto
    {
        public string Code { get; set; } = null!;
        public int FormCount { get; set; }
        public decimal Hours { get; set; }
    }

    public class OtOverviewEmployeeRowDto
    {
        public int EmployeeId { get; set; }
        public string Code { get; set; } = null!;
        public string FullName { get; set; } = null!;
        public string? DepartmentNameVn { get; set; }
        public string? DepartmentNameJp { get; set; }
        public decimal MonthHours { get; set; }
        public decimal MonthlyLimit { get; set; }
        public decimal YearHours { get; set; }
        public decimal YearlyLimit { get; set; }
        public bool IsOverMonthly { get; set; }
        public bool IsOverYearly { get; set; }
    }
}
