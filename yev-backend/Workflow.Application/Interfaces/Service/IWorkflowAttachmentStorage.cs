namespace Workflow.Application.Interfaces.Service
{
    // Trừu tượng hoá việc ghi/xoá file vật lý trên đĩa (workflow-module.md §3.3 WorkflowAttachments
    // "file nằm trên đĩa") — tách khỏi WorkflowRequestService để Application không tự quyết định thư
    // mục gốc lưu trữ (đọc từ appsettings, thuộc về Infrastructure). Mirror pattern IEmailService/
    // IEmailTemplateRenderer: interface ở Application, implementation ở Infrastructure.
    public interface IWorkflowAttachmentStorage
    {
        Task<(string StoredFileName, string RelativePath)> SaveAsync(int workflowRequestId, Stream content, string originalFileName);

        void Delete(string relativePath);

        string GetPhysicalPath(string relativePath);
    }
}
