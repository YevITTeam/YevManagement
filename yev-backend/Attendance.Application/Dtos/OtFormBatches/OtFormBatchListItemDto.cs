namespace Attendance.Application.Dtos.OtFormBatches
{
    public class OtFormBatchListItemDto
    {
        public int Id { get; set; }

        public int TerminalLevel { get; set; }

        // Only for DepartmentManager (see OtFormBatchDto).
        public int? DepartmentId { get; set; }

        public string ScopeNameVn { get; set; } = null!;
        public string? ScopeNameJp { get; set; }

        public DateOnly BatchDate { get; set; }

        // Enum Attendance.Domain.Enums.OtFormBatchStatus.
        public int Status { get; set; }

        // Only member forms still Pending; forms resolved individually outside the batch are excluded.
        public int FormCount { get; set; }
        public int EmployeeCount { get; set; }
        public decimal TotalHour { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime? ProcessedAt { get; set; }
        public string? ProcessedByFullName { get; set; }
    }
}
