namespace Attendance.Application.Dtos.DepartmentApprovalSteps
{
    public class DepartmentApprovalStepDto
    {
        public int Id { get; set; }
        public int DepartmentId { get; set; }
        public int StepOrder { get; set; }
        public int JobTitleId { get; set; }
        public string JobTitleCode { get; set; } = null!;
        public string JobTitleName { get; set; } = null!;
        public int RankOrder { get; set; }
        public bool RequiresSignature { get; set; }

        // JobTitleTerminalLevel; never None here (intermediate levels live in GroupApprovalStep).
        public int TerminalLevel { get; set; }
    }
}
