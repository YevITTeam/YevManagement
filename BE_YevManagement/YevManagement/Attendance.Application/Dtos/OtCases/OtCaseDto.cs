namespace Attendance.Application.Dtos.OtCases
{
    public class OtCaseDto
    {
        public int Id { get; set; }
        public string Code { get; set; } = null!;
        public string? Description { get; set; }
        public bool RequireSignature { get; set; }

        // Enum Attendance.Domain.Enums.ApprovalLevel — the FINAL level an OtForm using this OtCase must reach.
        public int RequiredApprovalLevel { get; set; }
    }
}
