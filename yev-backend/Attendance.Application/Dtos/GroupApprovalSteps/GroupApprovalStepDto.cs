namespace Attendance.Application.Dtos.GroupApprovalSteps
{
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

        // Enum Attendance.Domain.Enums.JobTitleTerminalLevel — luôn = None (0) cho bước ở đây, giữ
        // lại field để FE dùng chung style hiển thị với DepartmentApprovalStepDto.
        public int TerminalLevel { get; set; }
    }
}
