using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.GroupApprovalStepCoordinators
{
    // Replaces the whole list; empty clears it. Each EmployeeId must belong to this Group.
    public class ReplaceGroupApprovalStepCoordinatorsDto
    {
        [Required]
        public List<int> EmployeeIds { get; set; } = new();
    }
}
