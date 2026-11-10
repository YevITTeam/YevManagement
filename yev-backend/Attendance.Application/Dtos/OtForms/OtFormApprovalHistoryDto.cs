namespace Attendance.Application.Dtos.OtForms
{
    public class OtFormApprovalHistoryDto
    {
        public string ApproverUserName { get; set; } = null!;

        // Snapshot of the full name from JWT at signing time — null if the account has no FullName in Identity (FE falls back to ApproverUserName).
        public string? ApproverFullName { get; set; }

        // Set when the approver acted by delegation: the delegator they covered (falls back to the user name on the FE).
        public string? OnBehalfOfUserName { get; set; }
        public string? OnBehalfOfFullName { get; set; }

        public int StepOrder { get; set; }
        public string JobTitleNameSnapshot { get; set; } = null!;

        // Enum Attendance.Domain.Enums.ApprovalAction.
        public int Action { get; set; }
        public string? Comment { get; set; }
        public bool HasSignature { get; set; }
        public byte[]? SignatureImage { get; set; }
        public bool IsPaperApproval { get; set; }
        public DateTime ActionAt { get; set; }
    }
}
