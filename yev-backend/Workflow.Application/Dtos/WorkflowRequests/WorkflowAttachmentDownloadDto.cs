namespace Workflow.Application.Dtos.WorkflowRequests
{
    // Kết quả nội bộ cho Controller stream file vật lý về client (PhysicalFile) — không đi qua
    // ApiResponse<T> như phần còn lại của module vì đây là nhị phân, không phải JSON (workflow-module.md
    // §6 "Đính kèm").
    public class WorkflowAttachmentDownloadDto
    {
        public string PhysicalPath { get; set; } = null!;
        public string ContentType { get; set; } = null!;
        public string OriginalFileName { get; set; } = null!;
    }
}
