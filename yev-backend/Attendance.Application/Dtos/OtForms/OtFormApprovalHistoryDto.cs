namespace Attendance.Application.Dtos.OtForms
{
    public class OtFormApprovalHistoryDto
    {
        public string ApproverUserName { get; set; } = null!;

        // Snapshot of the full name from JWT at signing time — null if the account has no FullName in Identity (FE falls back to ApproverUserName).
        public string? ApproverFullName { get; set; }

        // Enum Attendance.Domain.Enums.ApprovalLevel.
        public int ApprovalLevel { get; set; }

        // Enum Attendance.Domain.Enums.ApprovalAction.
        public int Action { get; set; }
        public string? Comment { get; set; }
        public bool HasSignature { get; set; }
        public byte[]? SignatureImage { get; set; }
        public DateTime ActionAt { get; set; }
    }
}
