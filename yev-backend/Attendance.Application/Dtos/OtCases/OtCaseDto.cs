namespace Attendance.Application.Dtos.OtCases
{
    public class OtCaseDto
    {
        public int Id { get; set; }
        public string Code { get; set; } = null!;
        public string? Description { get; set; }
        public string? DescriptionJp { get; set; }
        public bool RequireSignature { get; set; }

        // JobTitleTerminalLevel: the final level a form using this case must reach.
        public int RequiredApprovalLevel { get; set; }
    }
}
