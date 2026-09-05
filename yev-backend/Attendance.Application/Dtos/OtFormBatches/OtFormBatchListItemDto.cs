namespace Attendance.Application.Dtos.OtFormBatches
{
    public class OtFormBatchListItemDto
    {
        public int Id { get; set; }

        // Enum Attendance.Domain.Enums.JobTitleTerminalLevel — cấp duyệt của batch này.
        public int TerminalLevel { get; set; }

        // Chỉ có giá trị khi TerminalLevel=DepartmentManager — xem OtFormBatchDto.
        public int? DepartmentId { get; set; }

        public string ScopeNameVn { get; set; } = null!;
        public string? ScopeNameJp { get; set; }

        public DateOnly BatchDate { get; set; }

        // Enum Attendance.Domain.Enums.OtFormBatchStatus.
        public int Status { get; set; }

        // Only counts member forms still Status==Pending (waiting for THIS batch) — a form resolved
        // individually outside the batch flow no longer counts here, see docs/attendance-module.md — §Đơn tổng.
        public int FormCount { get; set; }
        public int EmployeeCount { get; set; }
        public decimal TotalHour { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime? ProcessedAt { get; set; }
        public string? ProcessedByFullName { get; set; }
    }
}
