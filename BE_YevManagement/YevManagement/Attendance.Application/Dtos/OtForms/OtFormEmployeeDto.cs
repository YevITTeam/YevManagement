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

        // The employee's CURRENT accumulation (live, not a snapshot) — so the approver can check it
        // against the TH3 thresholds (>25h/month, >300h/year) directly on the form detail screen,
        // without calling the Employee API separately.
        public decimal MonthToDate { get; set; }
        public decimal YearToDate { get; set; }

        // Only eligible for a meal ticket when actual OT hours (EndTime - StartTime) > 2 hours —
        // precomputed so the FE doesn't have to subtract the times itself (see docs/attendance-module.md).
        public bool IsEligibleForMeal { get; set; }
    }
}
