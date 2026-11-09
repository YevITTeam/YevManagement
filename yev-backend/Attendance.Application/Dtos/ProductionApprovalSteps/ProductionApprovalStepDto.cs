namespace Attendance.Application.Dtos.ProductionApprovalSteps
{
    public class ProductionApprovalStepDto
    {
        public int Id { get; set; }
        public int DepartmentId { get; set; }
        public int StepOrder { get; set; }
        public int JobTitleId { get; set; }
        public string JobTitleCode { get; set; } = null!;
        public string JobTitleName { get; set; } = null!;
        public int RankOrder { get; set; }
        public bool RequiresSignature { get; set; }
        public bool IsResponsible { get; set; }

        // JobTitleTerminalLevel; unlike DepartmentApprovalStepDto this single chain mixes None and terminal levels.
        public int TerminalLevel { get; set; }

        // True only for Line Leader, whose candidates are the title's holders on the form's line.
        public bool IsLineScoped { get; set; }
    }
}
