namespace Workflow.Application.Dtos.EmployeeSignatures
{
    public class EmployeeSignatureDto
    {
        public int EmployeeId { get; set; }

        // System.Text.Json tự serialize byte[] thành chuỗi base64.
        public byte[] SignatureImage { get; set; } = null!;

        public DateTime UpdatedAt { get; set; }
    }
}
