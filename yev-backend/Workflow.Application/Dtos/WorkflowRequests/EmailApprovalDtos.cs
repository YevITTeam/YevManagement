using System.ComponentModel.DataAnnotations;

namespace Workflow.Application.Dtos.WorkflowRequests
{
    // No OnBehalfOfEmployeeId (no delegation via email) and no signature upload: the signature comes from
    // EmployeeSignatures when the step requires one.
    public class EmailApproveRequestDto
    {
        public string? Comment { get; set; }
    }

    public class EmailRejectRequestDto
    {
        [Required(ErrorMessage = "Lý do từ chối là bắt buộc.")]
        public string Comment { get; set; } = null!;
    }
}
