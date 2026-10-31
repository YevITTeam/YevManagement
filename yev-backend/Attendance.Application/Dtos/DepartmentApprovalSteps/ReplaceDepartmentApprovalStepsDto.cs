using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.DepartmentApprovalSteps
{
    public class ReplaceDepartmentApprovalStepItemDto
    {
        [Required]
        public int JobTitleId { get; set; }

        public bool RequiresSignature { get; set; }
    }

    // Replaces the whole list; element order is StepOrder. Empty clears the Department's tree.
    public class ReplaceDepartmentApprovalStepsDto
    {
        [Required]
        public List<ReplaceDepartmentApprovalStepItemDto> Steps { get; set; } = new();
    }
}
