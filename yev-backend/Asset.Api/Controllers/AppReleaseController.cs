using Asset.Application.Dtos.AppReleases;
using Asset.Application.Interfaces.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Shared.Application.Authorization;
using Shared.Application.Wrapper;

namespace Asset.Api.Controllers
{
    // Quản lý bản cập nhật app Flutter "YEV Scan" (asset-module.md §1.23). ApkUrl vẫn chỉ là string —
    // Upload() bên dưới chỉ SINH RA link (không đổi schema): FE tải file .apk lên, nhận về link nội bộ
    // rồi tự điền vào ô apkUrl như link dán tay bình thường; vẫn có thể dán link ngoài (Drive...) thay vì
    // upload.
    public class AppReleaseController : BaseController
    {
        private readonly IAppReleaseService _appReleaseService;
        private readonly IAppReleaseFileStorage _fileStorage;

        public AppReleaseController(IAppReleaseService appReleaseService, IAppReleaseFileStorage fileStorage)
        {
            _appReleaseService = appReleaseService;
            _fileStorage = fileStorage;
        }

        // App gọi endpoint này TRƯỚC khi đăng nhập (kiểm tra cập nhật lúc mở app) — bề mặt
        // [AllowAnonymous] tiếp theo của hệ thống, cùng nhóm với UserSignatureController/OtFormController.
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

        // 300MB đủ cho APK thực tế (Kestrel mặc định giới hạn body ~30MB). Chỉ nhận đúng đuôi .apk.
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

        // Trả file nhị phân trực tiếp, KHÔNG bọc ApiResponse<T> (rule CLAUDE.md §3.4-1 chỉ áp dụng cho
        // JSON) — để app Flutter tải file bằng URL thuần. [AllowAnonymous] vì app gọi GetLatest() trước
        // khi đăng nhập rồi tải thẳng file này (cùng bề mặt anonymous với GetLatest).
        [AllowAnonymous]
        [HttpGet("download/{fileName}")]
        public IActionResult DownloadApk(string fileName)
        {
            // Chỉ nhận tên file thuần (GUID + đuôi do chính UploadApk sinh ra) — Path.GetFileName chặn
            // path traversal (vd "../../web.config").
            var safeFileName = Path.GetFileName(fileName);
            var physicalPath = _fileStorage.GetPhysicalPath(safeFileName);

            if (!System.IO.File.Exists(physicalPath))
                return NotFound();

            return PhysicalFile(physicalPath, "application/vnd.android.package-archive", safeFileName);
        }
    }
}
