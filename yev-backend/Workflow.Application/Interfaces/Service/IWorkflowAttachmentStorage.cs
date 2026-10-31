namespace Workflow.Application.Interfaces.Service
{
    // Keeps the storage root (from appsettings) in Infrastructure, out of the Application layer.
    public interface IWorkflowAttachmentStorage
    {
        Task<(string StoredFileName, string RelativePath)> SaveAsync(int workflowRequestId, Stream content, string originalFileName);

        void Delete(string relativePath);

        string GetPhysicalPath(string relativePath);
    }
}
