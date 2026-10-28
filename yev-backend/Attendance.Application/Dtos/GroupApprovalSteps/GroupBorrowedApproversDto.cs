using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.GroupApprovalSteps
{
    public class GroupBorrowedApproverDto
    {
        public int EmployeeId { get; set; }
        public string EmployeeCode { get; set; } = null!;
        public string LastName { get; set; } = null!;
        public string FirstName { get; set; } = null!;
        public string? GroupNameVn { get; set; }
        public string? GroupNameJp { get; set; }
    }

    // Approvers = already borrowed; Candidates = Team Leaders of the other Groups in the same Department.
    public class GroupBorrowedApproversDto
    {
        public List<GroupBorrowedApproverDto> Approvers { get; set; } = new();
        public List<GroupBorrowedApproverDto> Candidates { get; set; } = new();
    }

    public class ReplaceGroupBorrowedApproversDto
    {
        [Required]
        public List<int> EmployeeIds { get; set; } = new();
    }
}
