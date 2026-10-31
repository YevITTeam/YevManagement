namespace Attendance.Application.Dtos.OtForms
{
    public class OtFormEmployeeDto
    {
        public int EmployeeId { get; set; }
        public string EmployeeCode { get; set; } = null!;
        public string FullName { get; set; } = null!;
        public TimeOnly StartTime { get; set; }
        public TimeOnly EndTime { get; set; }
        public string? NoteVn { get; set; }
        public string? NoteJp { get; set; }

        // Accumulation up to the form's date plus its own hours: live incl. other pending forms until Completed,
        // then the actual figure frozen at sign-off.
        public decimal MonthToDate { get; set; }
        public decimal YearToDate { get; set; }

        // Live (not snapshotted like MonthToDate/YearToDate) so the edit screen warns against the employee's own limit. Null = global default.
        public decimal? CustomMonthlyOtHourLimit { get; set; }
        public decimal? CustomYearlyOtHourLimit { get; set; }

        // MealTicketType (0=None/1=Secondary/2=Main), computed from the current AttendanceSetting.
        public int MealTicketType { get; set; }

        // Raw hours minus MealBreakDeductionHours when DidEat (never in the early window); the only figure to display/sum.
        public decimal ActualHours { get; set; }

        // Affects ActualHours/MealTicketType, except in the early window where it is ignored.
        public bool DidEat { get; set; }

        // Removed rows are still returned for the audit trail; the FE hides them from the PDF and active list.
        // Excluded from NumberOfEmployee and never accumulate OT hours.
        public bool IsRemoved { get; set; }
        public string? RemovedByUserName { get; set; }
        public string? RemovedByFullName { get; set; }
        public int? RemovedAtLevel { get; set; }
        public DateTime? RemovedAt { get; set; }
        public string? RemoveReason { get; set; }

        // Snapshot from ProductionEmployee; production-line forms only, null for group forms.
        public string? CongDoanSnapshot { get; set; }
        public string? TaskNameSnapshot { get; set; }
        public string? BlockCodeSnapshot { get; set; }
        public string? TeamCodeSnapshot { get; set; }
        public string? ShiftTeamCodeSnapshot { get; set; }
    }
}
