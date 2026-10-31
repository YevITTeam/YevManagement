namespace Attendance.Application.Dtos.OtForms
{
    // One day in the batch-approval mini calendar.
    public class PendingApprovalDateCountDto
    {
        public DateOnly Date { get; set; }
        public int Count { get; set; }
    }
}
