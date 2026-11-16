namespace Attendance.Application.Dtos.GroupApprovalSteps
{
    public class GroupApprovalStepMemberDto
    {
        public int EmployeeId { get; set; }
        public string EmployeeCode { get; set; } = null!;
        public string LastName { get; set; } = null!;
        public string FirstName { get; set; } = null!;
        public string? GroupNameVn { get; set; }
        public bool ReceivesMail { get; set; }
    }

    public class GroupApprovalStepDto
    {
        public int Id { get; set; }
        public int GroupId { get; set; }
        public int StepOrder { get; set; }
        public int JobTitleId { get; set; }
        public string JobTitleCode { get; set; } = null!;
        public string JobTitleName { get; set; } = null!;
        public int RankOrder { get; set; }
        public bool RequiresSignature { get; set; }
        public bool IsResponsible { get; set; }
        public bool CanResubmit { get; set; }
        public bool ResubmitSkipsIntermediate { get; set; }

        // Always None here; kept so the FE shares display logic with DepartmentApprovalStepDto.
        public int TerminalLevel { get; set; }

        public List<GroupApprovalStepMemberDto> Members { get; set; } = new();
    }
}
