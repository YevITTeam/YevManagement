using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.DepartmentApprovalStepCoordinators
{
    // Replaces the whole list; empty clears it. Each EmployeeId must belong to this Department (directly or via a child Group).
    public class ReplaceDepartmentApprovalStepCoordinatorsDto
    {
        [Required]
        public List<int> EmployeeIds { get; set; } = new();
    }
}
