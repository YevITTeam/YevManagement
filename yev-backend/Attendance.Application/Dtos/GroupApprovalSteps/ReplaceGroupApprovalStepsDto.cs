using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.GroupApprovalSteps
{
    public class ReplaceGroupApprovalStepItemDto
    {
        [Required]
        public int JobTitleId { get; set; }

        public bool RequiresSignature { get; set; }

        // At most one step may be true (validated in GroupApprovalStepService.ReplaceAsync).
        public bool IsResponsible { get; set; }

        public bool CanResubmit { get; set; }

        // Ignored unless CanResubmit.
        public bool ResubmitSkipsIntermediate { get; set; }
    }

    // Replaces the whole list; element order is StepOrder. Empty clears the Group's tree.
    public class ReplaceGroupApprovalStepsDto
    {
        [Required]
        public List<ReplaceGroupApprovalStepItemDto> Steps { get; set; } = new();
    }
}
