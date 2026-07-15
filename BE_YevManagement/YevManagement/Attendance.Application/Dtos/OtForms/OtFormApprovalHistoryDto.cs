namespace Attendance.Application.Dtos.OtForms
{
    public class OtFormApprovalHistoryDto
    {
        public string ApproverUserName { get; set; } = null!;

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
