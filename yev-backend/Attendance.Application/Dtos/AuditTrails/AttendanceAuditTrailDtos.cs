namespace Attendance.Application.Dtos.AuditTrails
{
    // Same shape as Asset's AuditTrailDto so the FE list/diff components are shared.
    public class AttendanceAuditTrailDto
    {
        public long Id { get; set; }
        public string TableName { get; set; } = null!;
        public int RecordId { get; set; }
        public string? RecordName { get; set; }
        public int AffectedCount { get; set; }
        public string Action { get; set; } = null!;
        public string? OldValues { get; set; }
        public string? NewValues { get; set; }
        public string ChangedBy { get; set; } = null!;
        public DateTime ChangedAt { get; set; }
    }

    public class AttendanceAuditTrailFilterRequest
    {
        public int PageIndex { get; set; } = 1;
        public int PageSize { get; set; } = 50;
        public string? TableName { get; set; }
        public int? RecordId { get; set; }
        public string? RecordName { get; set; }
        public string? Action { get; set; }
        public string? ChangedBy { get; set; }
        public DateTime? FromDate { get; set; }
        public DateTime? ToDate { get; set; }
    }

    public class AttendanceMailLogDto
    {
        public long Id { get; set; }
        public string? RecipientUserName { get; set; }
        public string? ToEmail { get; set; }
        public string Subject { get; set; } = null!;
        public int Status { get; set; }
        public int Attempts { get; set; }
        public string? LastError { get; set; }
        public string RequestedBy { get; set; } = null!;
        public DateTime CreatedAt { get; set; }
        public DateTime? SentAt { get; set; }
    }

    public class AttendanceMailLogFilterRequest
    {
        public int PageIndex { get; set; } = 1;
        public int PageSize { get; set; } = 50;
        // Contains-match on recipient username, email address or subject.
        public string? Keyword { get; set; }
        public int? Status { get; set; }
        public DateTime? FromDate { get; set; }
        public DateTime? ToDate { get; set; }
    }
}
