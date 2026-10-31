using Asset.Application.Dtos.AppReleases;
using Asset.Application.Interfaces.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Asset.Api.Controllers
{
    // ApkUrl stays a plain string: Upload only produces an internal link the FE fills in; external links still work.
    public class AppReleaseController : BaseController
    {
        private readonly IAppReleaseService _appReleaseService;
        private readonly IAppReleaseFileStorage _fileStorage;

        public AppReleaseController(IAppReleaseService appReleaseService, IAppReleaseFileStorage fileStorage)
        {
            _appReleaseService = appReleaseService;
            _fileStorage = fileStorage;
        }

        // Called before login (update check on app start), hence anonymous.
        [AllowAnonymous]
        [HttpGet("latest")]
        public async Task<ActionResult<ApiResponse<AppReleaseDto?>>> GetLatest()
        {
            var result = await _appReleaseService.GetLatestAsync();
            return Success(result);
        }

        [RequirePermission("Asset.AppRelease.Manage")]
        [HttpGet("grid-list")]
        public async Task<ActionResult<ApiResponse<PagedResponse<AppReleaseDto>>>> GetPaged(
            [FromQuery] int pageIndex = 1, [FromQuery] int pageSize = 20, [FromQuery] string? keyword = null)
        {
            var result = await _appReleaseService.GetPagedAsync(pageIndex, pageSize, keyword);
            return Success(result);
        }

        [RequirePermission("Asset.AppRelease.Manage")]
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateAppReleaseDto request)
        {
            var result = await _appReleaseService.CreateAsync(request);
            return CreatedSuccess(nameof(GetPaged), new { }, result, "Thêm bản phát hành thành công.");
        }

        [RequirePermission("Asset.AppRelease.Manage")]
        [HttpPut("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Update(int id, [FromBody] UpdateAppReleaseDto request)
        {
            if (id != request.Id) return Fail<bool>("Id không khớp.");

            await _appReleaseService.UpdateAsync(request);
            return Success(true, "Cập nhật bản phát hành thành công.");
        }

        [RequirePermission("Asset.AppRelease.Manage")]
        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<bool>>> Delete(int id)
        {
            await _appReleaseService.DeleteAsync(id);
            return Success(true, "Xóa bản phát hành thành công.");
        }

        // Kestrel's default ~30MB body limit is too small for real APKs.
        [RequirePermission("Asset.AppRelease.Manage")]
        [RequestSizeLimit(300_000_000)]
        [HttpPost("upload")]
        public async Task<ActionResult<ApiResponse<string>>> UploadApk(IFormFile file)
        {
            if (file is null || file.Length == 0)
                return Fail<string>("Vui lòng chọn file .apk để tải lên.");

            if (!string.Equals(Path.GetExtension(file.FileName), ".apk", StringComparison.OrdinalIgnoreCase))
                return Fail<string>("Chỉ chấp nhận file .apk.");

            await using var stream = file.OpenReadStream();
            var storedFileName = await _fileStorage.SaveAsync(stream, file.FileName);

            var downloadUrl = $"{Request.Scheme}://{Request.Host}/api/AppRelease/download/{storedFileName}";
            return Success(downloadUrl, "Tải file lên thành công.");
        }

        // Raw file (not ApiResponse) so the app can download by plain URL; anonymous because it runs before login.
        [AllowAnonymous]
        [HttpGet("download/{fileName}")]
        public IActionResult DownloadApk(string fileName)
        {
            // Path.GetFileName blocks path traversal (e.g. "../../web.config").
            var safeFileName = Path.GetFileName(fileName);
            var physicalPath = _fileStorage.GetPhysicalPath(safeFileName);

            if (!System.IO.File.Exists(physicalPath))
                return NotFound();

            return PhysicalFile(physicalPath, "application/vnd.android.package-archive", safeFileName);
        }
    }
}
