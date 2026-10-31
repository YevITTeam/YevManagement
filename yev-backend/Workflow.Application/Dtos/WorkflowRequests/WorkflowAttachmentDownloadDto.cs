namespace Workflow.Application.Dtos.WorkflowRequests
{
    // Internal result for streaming via PhysicalFile; binary, so not wrapped in ApiResponse<T>.
    public class WorkflowAttachmentDownloadDto
    {
        public string PhysicalPath { get; set; } = null!;
        public string ContentType { get; set; } = null!;
        public string OriginalFileName { get; set; } = null!;
    }
}
