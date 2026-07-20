namespace Attendance.Application.Dtos.OtForms
{
    // Bản rút gọn của OtFormApprovalHistory dùng cho danh sách (list) — bỏ Comment/SignatureImage
    // để nhẹ, xem đầy đủ qua GET /{id} (approvalHistories).
    public class ApprovalSummaryItemDto
    {
        // Enum Attendance.Domain.Enums.ApprovalLevel.
        public int ApprovalLevel { get; set; }
        public string ApproverUserName { get; set; } = null!;
        public string? ApproverFullName { get; set; }

        // Enum Attendance.Domain.Enums.ApprovalAction.
        public int Action { get; set; }
        public DateTime ActionAt { get; set; }
    }
}
