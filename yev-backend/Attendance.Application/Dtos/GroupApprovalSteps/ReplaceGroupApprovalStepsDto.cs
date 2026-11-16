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

        [Required]
        public List<ReplaceGroupApprovalStepMemberDto> Members { get; set; } = new();
    }

    public class ReplaceGroupApprovalStepMemberDto
    {
        [Required]
        public int EmployeeId { get; set; }

        public bool ReceivesMail { get; set; }
    }

    // Replaces the whole list; element order is StepOrder. Empty clears the Group's tree.
    public class ReplaceGroupApprovalStepsDto
    {
        [Required]
        public List<ReplaceGroupApprovalStepItemDto> Steps { get; set; } = new();

        public bool CreatorMustSign { get; set; }

        public bool StepwiseEdit { get; set; }
    }
}
