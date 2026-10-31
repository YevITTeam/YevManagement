using Microsoft.Extensions.Configuration;
using Workflow.Application.Interfaces.Service;

namespace Workflow.Infrastructure.Services
{
    // Local disk only (single server, no network share). Default root under AppContext.BaseDirectory is lost on redeploy,
    // so production should set AppSettings:WorkflowAttachmentStoragePath to an absolute path outside the build folder.
    public class WorkflowAttachmentStorageService : IWorkflowAttachmentStorage
    {
        private readonly string _rootPath;

        public WorkflowAttachmentStorageService(IConfiguration configuration)
        {
            var configured = configuration["AppSettings:WorkflowAttachmentStoragePath"];
            var relativeOrAbsolute = string.IsNullOrWhiteSpace(configured) ? "App_Data/WorkflowAttachments" : configured;
            _rootPath = Path.IsPathRooted(relativeOrAbsolute) ? relativeOrAbsolute : Path.Combine(AppContext.BaseDirectory, relativeOrAbsolute);
        }

        public async Task<(string StoredFileName, string RelativePath)> SaveAsync(int workflowRequestId, Stream content, string originalFileName)
        {
            var ext = Path.GetExtension(originalFileName);
            var storedFileName = $"{Guid.NewGuid():N}{ext}";
            var relativePath = Path.Combine(workflowRequestId.ToString(), storedFileName);
            var physicalPath = ResolveContainedPath(relativePath);

            Directory.CreateDirectory(Path.GetDirectoryName(physicalPath)!);
            await using (var fileStream = File.Create(physicalPath))
            {
                await content.CopyToAsync(fileStream);
            }

            return (storedFileName, relativePath);
        }

        public void Delete(string relativePath)
        {
            var physicalPath = ResolveContainedPath(relativePath);
            if (File.Exists(physicalPath))
                File.Delete(physicalPath);
        }

        public string GetPhysicalPath(string relativePath) => ResolveContainedPath(relativePath);

        // Defense in depth: reject any relativePath that resolves outside the storage root (e.g. via "..").
        private string ResolveContainedPath(string relativePath)
        {
            var fullPath = Path.GetFullPath(Path.Combine(_rootPath, relativePath));
            var rootFullPath = Path.GetFullPath(_rootPath) + Path.DirectorySeparatorChar;
            if (!fullPath.StartsWith(rootFullPath, StringComparison.OrdinalIgnoreCase))
                throw new ArgumentException("Resolved path escapes the attachment storage root.", nameof(relativePath));
            return fullPath;
        }
    }
}
