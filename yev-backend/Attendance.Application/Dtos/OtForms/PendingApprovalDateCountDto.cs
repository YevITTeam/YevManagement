namespace Attendance.Application.Dtos.OtForms
{
    // 1 ngày trong lịch mini ở màn Duyệt hàng loạt (2026-09-04) — xem
    // IOtFormService.GetPendingApprovalDatesAsync.
    public class PendingApprovalDateCountDto
    {
        public DateOnly Date { get; set; }
        public int Count { get; set; }
    }
}
