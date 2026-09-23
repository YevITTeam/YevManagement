using Asset.Application.Interfaces.Service;
using Microsoft.Extensions.Configuration;

namespace Asset.Infrastructure.Services
{
    // Lưu file .apk trên đĩa cục bộ của máy chạy CompanySystem.HostApi (asset-module.md §1.23) — mirror
    // Workflow.Infrastructure.Services.WorkflowAttachmentStorageService, chưa hỗ trợ multi-instance/network
    // share, đủ dùng cho 1 server hiện tại. Thư mục gốc cấu hình qua appsettings
    // AppSettings:AppReleaseStoragePath; nếu để trống, mặc định "App_Data/AppReleaseFiles" tính từ
    // AppContext.BaseDirectory (production nên trỏ ra đường dẫn tuyệt đối bên ngoài thư mục build để
    // không mất file khi redeploy).
    public class AppReleaseFileStorageService : IAppReleaseFileStorage
    {
        private readonly string _rootPath;

        public AppReleaseFileStorageService(IConfiguration configuration)
        {
            var configured = configuration["AppSettings:AppReleaseStoragePath"];
            var relativeOrAbsolute = string.IsNullOrWhiteSpace(configured) ? "App_Data/AppReleaseFiles" : configured;
            _rootPath = Path.IsPathRooted(relativeOrAbsolute) ? relativeOrAbsolute : Path.Combine(AppContext.BaseDirectory, relativeOrAbsolute);
        }

        public async Task<string> SaveAsync(Stream content, string originalFileName)
        {
            var ext = Path.GetExtension(originalFileName);
            var storedFileName = $"{Guid.NewGuid():N}{ext}";

            Directory.CreateDirectory(_rootPath);
            var physicalPath = Path.Combine(_rootPath, storedFileName);
            await using (var fileStream = File.Create(physicalPath))
            {
                await content.CopyToAsync(fileStream);
            }

            return storedFileName;
        }

        public string GetPhysicalPath(string storedFileName) => Path.Combine(_rootPath, storedFileName);
    }
}
