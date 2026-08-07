namespace Attendance.Application.Dtos.JobTitles
{
    public class ResolvedApprovalCandidateDto
    {
        public int EmployeeId { get; set; }
        public string UserName { get; set; } = null!;
        public string FullName { get; set; } = null!;
    }
}
