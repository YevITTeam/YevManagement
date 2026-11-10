namespace Attendance.Application.Dtos.OtForms
{
    public class OtFormPaperScanDto
    {
        public string FileName { get; set; } = null!;
        public string ContentType { get; set; } = null!;
        public string UploadedByUserName { get; set; } = null!;
        public string? UploadedByFullName { get; set; }
        public DateTime UploadedAt { get; set; }

        // Enum Attendance.Domain.Enums.OtFormPaperScanStatus.
        public int Status { get; set; }
        public string? ReviewedByFullName { get; set; }
        public DateTime? ReviewedAt { get; set; }
        public string? ReviewComment { get; set; }
    }
}
