namespace Attendance.Application.Dtos.OtCases
{
    public class OtCaseDto
    {
        public int Id { get; set; }
        public string Code { get; set; } = null!;
        public string? Description { get; set; }
        public bool RequireSignature { get; set; }

        // Enum Attendance.Domain.Enums.JobTitleTerminalLevel — the FINAL level an OtForm using this OtCase
        // must reach (2026-08-07, Giai đoạn 3.1 — thay ApprovalLevel cũ, value int 1/2/3 trùng nhau).
        public int RequiredApprovalLevel { get; set; }
    }
}
