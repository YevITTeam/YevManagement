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

        // Có ăn hay không (chỉ có ý nghĩa khi IsEligibleForMeal=true) — xem OtFormEmployee.DidEat.
        public bool DidEat { get; set; }

        // Dropped from the form by an approver (see docs/attendance-module.md — Loại nhân viên khỏi đơn).
        // Rows with IsRemoved = true are STILL returned here on purpose so the detail screen can show
        // an audit trail of who was dropped and why — the FE is what filters them out of the printed
        // PDF and of the "đang tăng ca" list. They are excluded from NumberOfEmployee and never
        // accumulate OT hours.
        public bool IsRemoved { get; set; }
        public string? RemovedByUserName { get; set; }
        public string? RemovedByFullName { get; set; }
        public int? RemovedAtLevel { get; set; }
        public DateTime? RemovedAt { get; set; }
        public string? RemoveReason { get; set; }
    }
}
