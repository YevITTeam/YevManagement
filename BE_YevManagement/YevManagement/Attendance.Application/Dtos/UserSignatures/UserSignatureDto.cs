namespace Attendance.Application.Dtos.UserSignatures
{
    public class UserSignatureDto
    {
        public string UserName { get; set; } = null!;

        // System.Text.Json automatically serializes byte[] as a base64 string.
        public byte[] SignatureImage { get; set; } = null!;

        public DateTime UpdatedAt { get; set; }
    }
}
