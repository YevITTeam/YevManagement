namespace Asset.Application.Dtos.AuditTrails
{
    public class AuditTrailDto
    {
        public long Id { get; set; }
        public string TableName { get; set; } = null!;
        public int RecordId { get; set; }
        /// <summary>Readable name of the affected object (device code, IP address...).</summary>
        public string? RecordName { get; set; }
        /// <summary>Number of records this row represents (> 1 for a grouped bulk operation).</summary>
        public int AffectedCount { get; set; }
        public string Action { get; set; } = null!;
        public string? OldValues { get; set; }
        public string? NewValues { get; set; }
        public string ChangedBy { get; set; } = null!;
        public DateTime ChangedAt { get; set; }
    }
}
