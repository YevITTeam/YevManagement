using System.ComponentModel.DataAnnotations;

namespace Attendance.Application.Dtos.ProductionApprovalSteps
{
    public class ReplaceProductionApprovalStepItemDto
    {
        [Required]
        public int JobTitleId { get; set; }

        public bool RequiresSignature { get; set; }
        public bool IsResponsible { get; set; }
    }

    // Replaces the whole production chain of a Department; array order is StepOrder, empty array clears it.
    public class ReplaceProductionApprovalStepsDto
    {
        [Required]
        public List<ReplaceProductionApprovalStepItemDto> Steps { get; set; } = new();
    }
}
