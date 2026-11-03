using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.GroupApprovalSteps
{
    public class GroupOtFormCreatorDto
    {
        public int EmployeeId { get; set; }
        public string EmployeeCode { get; set; } = null!;
        public string LastName { get; set; } = null!;
        public string FirstName { get; set; } = null!;
        public string? GroupNameVn { get; set; }
    }

    // Creators = already granted; Candidates = employees with an account in the same Department but outside this Group.
    public class GroupOtFormCreatorsDto
    {
        public List<GroupOtFormCreatorDto> Creators { get; set; } = new();
        public List<GroupOtFormCreatorDto> Candidates { get; set; } = new();
    }

    public class ReplaceGroupOtFormCreatorsDto
    {
        [Required]
        public List<int> EmployeeIds { get; set; } = new();
    }
}
