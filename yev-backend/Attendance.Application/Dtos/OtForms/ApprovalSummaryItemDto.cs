namespace Attendance.Application.Dtos.OtForms
{
    // Lightweight list version without Comment/SignatureImage; full data via GET /{id}.
    public class ApprovalSummaryItemDto
    {
        public int StepOrder { get; set; }
        public string JobTitleNameSnapshot { get; set; } = null!;
        public string ApproverUserName { get; set; } = null!;
        public string? ApproverFullName { get; set; }

        // Enum Attendance.Domain.Enums.ApprovalAction.
        public int Action { get; set; }
        public DateTime ActionAt { get; set; }
    }
}
