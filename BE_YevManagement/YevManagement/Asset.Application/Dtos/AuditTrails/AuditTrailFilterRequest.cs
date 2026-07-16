namespace Asset.Application.Dtos.AuditTrails
{
    public class AuditTrailFilterRequest
    {
        public int PageIndex { get; set; } = 1;
        public int PageSize { get; set; } = 50;

        public string? TableName { get; set; }
        public int? RecordId { get; set; }
        public string? Action { get; set; }
        public string? ChangedBy { get; set; }
        public DateTime? FromDate { get; set; }
        public DateTime? ToDate { get; set; }
    }
}
