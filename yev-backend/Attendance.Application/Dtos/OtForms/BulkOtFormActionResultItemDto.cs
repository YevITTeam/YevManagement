namespace Attendance.Application.Dtos.OtForms
{
    public class BulkOtFormActionResultItemDto
    {
        public int OtFormId { get; set; }

        public bool Success { get; set; }

        public string? Error { get; set; }
    }
}
