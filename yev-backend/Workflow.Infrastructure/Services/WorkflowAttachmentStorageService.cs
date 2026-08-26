using Microsoft.Extensions.Configuration;
using Workflow.Application.Interfaces.Service;

namespace Workflow.Infrastructure.Services
{
    // Lưu file đính kèm trên đĩa cục bộ của máy chạy CompanySystem.HostApi (workflow-module.md §3.3
    // WorkflowAttachments "file nằm trên đĩa") — chưa hỗ trợ multi-instance/network share, đủ dùng cho
    // 1 server hiện tại (Pha 4B, 2026-08-26 §10). Thư mục gốc cấu hình qua appsettings
    // AppSettings:WorkflowAttachmentStoragePath; nếu để trống, mặc định "App_Data/WorkflowAttachments"
    // tính từ AppContext.BaseDirectory (thư mục build output — production nên trỏ ra 1 đường dẫn tuyệt
    // đối bên ngoài thư mục build để không mất file khi redeploy).
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
            var physicalPath = Path.Combine(_rootPath, relativePath);

            Directory.CreateDirectory(Path.GetDirectoryName(physicalPath)!);
            await using (var fileStream = File.Create(physicalPath))
            {
                await content.CopyToAsync(fileStream);
            }

            return (storedFileName, relativePath);
        }

        public void Delete(string relativePath)
        {
            var physicalPath = Path.Combine(_rootPath, relativePath);
            if (File.Exists(physicalPath))
                File.Delete(physicalPath);
        }

        public string GetPhysicalPath(string relativePath) => Path.Combine(_rootPath, relativePath);
    }
}
