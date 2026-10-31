using Asset.Application.Dtos.AppReleases;
using Shared.Application.Wrapper;

namespace Asset.Application.Interfaces.Service
{
    public interface IAppReleaseService
    {
        // Null when no release exists; backs the anonymous /latest endpoint called before login.
        Task<AppReleaseDto?> GetLatestAsync();

        Task<PagedResponse<AppReleaseDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword);

        Task<AppReleaseDto> CreateAsync(CreateAppReleaseDto request);

        Task UpdateAsync(UpdateAppReleaseDto request);

        Task DeleteAsync(int id);
    }
}
