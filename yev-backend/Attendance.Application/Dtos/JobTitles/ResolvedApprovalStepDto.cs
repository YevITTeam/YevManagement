namespace Attendance.Application.Dtos.JobTitles
{
    public class ResolvedApprovalStepDto
    {
        public int StepOrder { get; set; }
        public int JobTitleId { get; set; }
        public string JobTitleCode { get; set; } = null!;
        public string JobTitleName { get; set; } = null!;
        public int RankOrder { get; set; }
        public bool RequiresSignature { get; set; }
        public bool IsResponsible { get; set; }

        // Enum Attendance.Domain.Enums.JobTitleTerminalLevel.
        public int TerminalLevel { get; set; }

        public List<ResolvedApprovalCandidateDto> Candidates { get; set; } = new();
    }
}
