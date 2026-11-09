namespace Attendance.Application.Dtos.ProductionEmployees
{
    // Only people on the production roster (employees with a Line) are returned.
    public class ProductionEmployeeSearchItemDto
    {
        public int EmployeeId { get; set; }
        public string EmployeeCode { get; set; } = null!;
        public string FullName { get; set; } = null!;
        public string? CongDoan { get; set; }
        public string? TaskName { get; set; }
        public string? BlockCode { get; set; }
        public string? TeamCode { get; set; }
        public string? ShiftTeamCode { get; set; }
        public string? ShiftTeamNameVn { get; set; }
        public bool IsLeader { get; set; }

        // Projected totals (actual + other pending forms) for the `date` param, used to warn about OT limits on pick.
        // Meaningful only when `date` is passed.
        public decimal ProjectedDayToDate { get; set; }
        public decimal ProjectedMonthToDate { get; set; }
        public decimal ProjectedYearToDate { get; set; }

        // Per-employee OT limits; null means the global default applies.
        public decimal? CustomMonthlyOtHourLimit { get; set; }
        public decimal? CustomYearlyOtHourLimit { get; set; }
    }
}
