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

        // Loại phiếu ăn (0=None/1=Secondary/2=Main, xem Attendance.Domain.Enums.MealTicketType) —
        // precomputed theo AttendanceSetting hiện hành, thay cho IsEligibleForMeal cũ (redesign 3 bậc
        // 2026-08-26, xem OtFormService.CalculateMealTicketType).
        public int MealTicketType { get; set; }

        // Giờ OT thực tính (2026-08-26) — raw (EndTime-StartTime), trừ MealBreakDeductionHours nếu
        // DidEat=true (trừ ca khớp đúng khung sớm — không bao giờ trừ). Đây là số DUY NHẤT nên
        // hiển thị/cộng làm "giờ OT của người này" — xem OtFormService.CalculateOtHours.
        public decimal ActualHours { get; set; }

        // Có ăn hay không — xem OtFormEmployee.DidEat. Vẫn ảnh hưởng ActualHours/MealTicketType bất kể
        // giá trị nào, TRỪ ca khớp đúng khung sớm (luôn bỏ qua DidEat).
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

        // Snapshot ProductionEmployee lúc thêm vào đơn — chỉ có giá trị khi OtForm.IsProductionForm =
        // true (đơn "theo chuyền"), null cho đơn "theo Nhóm" — xem OtFormEmployee.CongDoanSnapshot.
        public string? CongDoanSnapshot { get; set; }
        public string? TaskNameSnapshot { get; set; }
        public string? BlockCodeSnapshot { get; set; }
        public string? TeamCodeSnapshot { get; set; }
        public string? ShiftTeamCodeSnapshot { get; set; }
    }
}
