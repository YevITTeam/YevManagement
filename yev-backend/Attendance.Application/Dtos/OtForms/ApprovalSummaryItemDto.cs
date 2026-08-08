namespace Attendance.Application.Dtos.OtForms
{
    // Bản rút gọn của OtFormApprovalHistory dùng cho danh sách (list) — bỏ Comment/SignatureImage
    // để nhẹ, xem đầy đủ qua GET /{id} (approvalHistories).
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
