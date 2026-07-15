namespace Attendance.Application.Dtos.UserSignatures
{
    public class UserSignatureDto
    {
        public string UserName { get; set; } = null!;

        // System.Text.Json tự serialize byte[] thành chuỗi base64.
        public byte[] SignatureImage { get; set; } = null!;

        public DateTime UpdatedAt { get; set; }
    }
}
