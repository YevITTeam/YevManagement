using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.GroupApprovalSteps
{
    public class GroupBorrowedApproverDto
    {
        public int EmployeeId { get; set; }
        public string EmployeeCode { get; set; } = null!;
        public string LastName { get; set; } = null!;
        public string FirstName { get; set; } = null!;
        public int? JobTitleId { get; set; }
        public string? JobTitleName { get; set; }
        public string? GroupNameVn { get; set; }
        public string? GroupNameJp { get; set; }
    }

    // Candidates = everyone in the Department with an account; the source of the level pickers.
    public class GroupBorrowedApproversDto
    {
        public List<GroupBorrowedApproverDto> Candidates { get; set; } = new();
        public bool CreatorMustSign { get; set; }
        public bool StepwiseEdit { get; set; }
    }

    // Adds one person to the same level of several Groups.
    public class ApplyGroupLevelMemberDto
    {
        [Required]
        public int EmployeeId { get; set; }

        [Required]
        public int? JobTitleId { get; set; }

        public bool ReceivesMail { get; set; } = true;

        [Required, MinLength(1)]
        public List<int> GroupIds { get; set; } = new();
    }

    public class ApplyGroupLevelMemberResultDto
    {
        public int AppliedCount { get; set; }

        // Groups whose tree has no such level.
        public List<string> SkippedGroupNames { get; set; } = new();

        // Groups where the person already sits on another level (one level per person per Group).
        public List<string> OnOtherLevelGroupNames { get; set; } = new();
    }
}
