namespace Attendance.Application.Dtos.OtForms
{
    public class OtFormApprovalStepCandidateDto
    {
        public int EmployeeId { get; set; }
        public string UserName { get; set; } = null!;
        public string FullName { get; set; } = null!;
    }

    // Chuỗi bước duyệt đã snapshot lúc tạo đơn (2026-08-07, Giai đoạn 3.1) — xem OtForm.ApprovalSteps.
    public class OtFormApprovalStepDto
    {
        public int Id { get; set; }
        public int StepOrder { get; set; }
        public string JobTitleCodeSnapshot { get; set; } = null!;
        public string JobTitleNameSnapshot { get; set; } = null!;
        public bool RequiresSignatureSnapshot { get; set; }
        public bool IsResponsibleSnapshot { get; set; }

        // Enum Attendance.Domain.Enums.JobTitleTerminalLevel.
        public int TerminalLevelSnapshot { get; set; }

        // Enum Attendance.Domain.Enums.OtFormApprovalStepStatus.
        public int Status { get; set; }

        public List<OtFormApprovalStepCandidateDto> Candidates { get; set; } = new();
    }
}
