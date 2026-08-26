namespace Workflow.Application.Dtos.WorkflowRequests
{
    public class WorkflowAttachmentDto
    {
        public int Id { get; set; }
        public string OriginalFileName { get; set; } = null!;
        public string ContentType { get; set; } = null!;
        public long FileSizeBytes { get; set; }
        public int UploadedByEmployeeId { get; set; }
        public string UploadedByEmployeeName { get; set; } = null!;
        public DateTime UploadedAt { get; set; }
    }
}
