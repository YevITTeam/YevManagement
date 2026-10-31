namespace Attendance.Application.Dtos.OtFormBatches
{
    public class OtFormBatchDto
    {
        public int Id { get; set; }

        public int TerminalLevel { get; set; }

        // Only for DepartmentManager; other levels are company-wide (DepartmentId = null).
        public int? DepartmentId { get; set; }

        // Department name for DepartmentManager, otherwise the JobTitle name (JobTitle has no Jp name).
        public string ScopeNameVn { get; set; } = null!;
        public string? ScopeNameJp { get; set; }

        public DateOnly BatchDate { get; set; }

        // Enum Attendance.Domain.Enums.OtFormBatchStatus.
        public int Status { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime? ProcessedAt { get; set; }
        public string? ProcessedByUserName { get; set; }
        public string? ProcessedByFullName { get; set; }

        // Only forms still Pending; ones resolved individually outside the batch are excluded.
        public List<OtFormBatchItemDto> OtForms { get; set; } = new();
    }
}
