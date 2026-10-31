namespace Workflow.Application.Dtos.EmployeeSignatures
{
    public class EmployeeSignatureDto
    {
        public int EmployeeId { get; set; }

        // Serialized as base64 by System.Text.Json.
        public byte[] SignatureImage { get; set; } = null!;

        public DateTime UpdatedAt { get; set; }
    }
}
