using Asset.Application.Dtos.AppReleases;
using Shared.Application.Wrapper;

namespace Asset.Application.Interfaces.Service
{
    public interface IAppReleaseService
    {
        // Bản mới nhất (!IsDeleted, VersionCode lớn nhất) — null nếu chưa có bản nào. Dùng cho endpoint
        // anonymous /latest mà app Flutter gọi trước khi đăng nhập.
        Task<AppReleaseDto?> GetLatestAsync();

        Task<PagedResponse<AppReleaseDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword);

        Task<AppReleaseDto> CreateAsync(CreateAppReleaseDto request);

        Task UpdateAsync(UpdateAppReleaseDto request);

        Task DeleteAsync(int id);
    }
}
