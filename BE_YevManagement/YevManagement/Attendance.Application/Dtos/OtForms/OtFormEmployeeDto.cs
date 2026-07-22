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

        // Snapshot of the employee's accumulation AS OF when this row was added to the form (frozen,
        // NOT the employee's current live accumulation — see OtFormEmployee.MonthToDate/YearToDate,
        // fixed 2026-07-21: was a live join before, which made old/completed forms show today's
        // accumulation instead of what justified this form's approval level at the time).
        public decimal MonthToDate { get; set; }
        public decimal YearToDate { get; set; }

        // Only eligible for a meal ticket when actual OT hours (EndTime - StartTime) > 2 hours —
        // precomputed so the FE doesn't have to subtract the times itself (see docs/attendance-module.md).
        public bool IsEligibleForMeal { get; set; }
    }
}
