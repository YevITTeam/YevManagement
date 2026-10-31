using Asset.Application.Interfaces.Service;
using Microsoft.Extensions.Configuration;

namespace Asset.Infrastructure.Services
{
    // Local disk only (single server, no multi-instance). Production should set AppSettings:AppReleaseStoragePath
    // outside the build folder so files survive redeploys.
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
