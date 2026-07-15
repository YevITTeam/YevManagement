namespace Attendance.Application.Dtos.OtForms
{
    public class ApproveOtFormDto
    {
        public string? Comment { get; set; }

        // Bắt buộc nếu OtCase.RequireSignature = true (validate trong Service).
        public byte[]? SignatureImage { get; set; }
    }
}
