namespace Workflow.Application.Dtos.EmployeeSignatures
{
    // Returned to the anonymous confirmation page: only enough to recognize the signature, nothing more.
    public class SignatureConfirmationPreviewDto
    {
        public string EmployeeFullName { get; set; } = null!;

        public byte[] SignatureImage { get; set; } = null!;

        public DateTime ExpiresAt { get; set; }
    }
}
