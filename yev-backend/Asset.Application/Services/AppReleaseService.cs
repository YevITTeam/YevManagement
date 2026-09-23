using Asset.Application.Dtos.AppReleases;
using Asset.Application.Interfaces.Service;
using Asset.Domain.Entities;
using Shared.Application.Services;
using Shared.Application.Wrapper;
using Shared.Core.Exceptions;

namespace Asset.Application.Services
{
    public class AppReleaseService : BaseService<IAssetUnitOfWork>, IAppReleaseService
    {
        public AppReleaseService(IAssetUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<AppReleaseDto?> GetLatestAsync()
        {
            var query = _unitOfWork.AppReleases.GetQueryable(false).Where(x => !x.IsDeleted);

            // Selector phải là Expression<Func<>> để EF dịch sang SQL — không được truyền method group/
            // helper gọi lồng (vd `x => ToDto(x)`), sẽ ném "could not be translated" lúc chạy. Inline
            // projection trực tiếp, cùng pattern mọi service khác trong Asset (vd BranchService).
            var latest = await _unitOfWork.AppReleases.ToListAsync(
                query.OrderByDescending(x => x.VersionCode).Take(1),
                x => new AppReleaseDto
                {
                    Id = x.Id,
                    VersionCode = x.VersionCode,
                    VersionName = x.VersionName,
                    MinVersionCode = x.MinVersionCode,
                    ApkUrl = x.ApkUrl,
                    Changelog = x.Changelog
                }
            );

            return latest.FirstOrDefault();
        }

        public async Task<PagedResponse<AppReleaseDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword)
        {
            var query = _unitOfWork.AppReleases.GetQueryable(false).Where(x => !x.IsDeleted);

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                query = query.Where(x => x.VersionName.Contains(keyword));
            }

            return await _unitOfWork.AppReleases.ToPagedResponseAsync(
                query.OrderByDescending(x => x.VersionCode),
                pageIndex,
                pageSize,
                x => new AppReleaseDto
                {
                    Id = x.Id,
                    VersionCode = x.VersionCode,
                    VersionName = x.VersionName,
                    MinVersionCode = x.MinVersionCode,
                    ApkUrl = x.ApkUrl,
                    Changelog = x.Changelog
                }
            );
        }

        public async Task<AppReleaseDto> CreateAsync(CreateAppReleaseDto request)
        {
            var exists = await _unitOfWork.AppReleases.FirstOrDefaultAsync(x => x.VersionCode == request.VersionCode);
            exists.ThrowIfDuplicateCode("Version code", request.VersionCode.ToString(), x => x.IsDeleted);

            var newRelease = new AppRelease
            {
                VersionCode = request.VersionCode,
                VersionName = request.VersionName,
                MinVersionCode = request.MinVersionCode,
                ApkUrl = request.ApkUrl,
                Changelog = request.Changelog,
                IsDeleted = false
            };

            await _unitOfWork.AppReleases.AddAsync(newRelease);
            await _unitOfWork.SaveChangesAsync();

            return new AppReleaseDto
            {
                Id = newRelease.Id,
                VersionCode = newRelease.VersionCode,
                VersionName = newRelease.VersionName,
                MinVersionCode = newRelease.MinVersionCode,
                ApkUrl = newRelease.ApkUrl,
                Changelog = newRelease.Changelog
            };
        }

        public async Task UpdateAsync(UpdateAppReleaseDto request)
        {
            var release = (await _unitOfWork.AppReleases.GetByIdAsync(request.Id)).OrThrowNotFound("Bản phát hành", request.Id);

            var exists = await _unitOfWork.AppReleases.FirstOrDefaultAsync(
                x => x.VersionCode == request.VersionCode && x.Id != request.Id);
            exists.ThrowIfDuplicateCode("Version code", request.VersionCode.ToString(), x => x.IsDeleted);

            release.VersionCode = request.VersionCode;
            release.VersionName = request.VersionName;
            release.MinVersionCode = request.MinVersionCode;
            release.ApkUrl = request.ApkUrl;
            release.Changelog = request.Changelog;

            _unitOfWork.AppReleases.Update(release);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task DeleteAsync(int id)
        {
            var release = (await _unitOfWork.AppReleases.GetByIdAsync(id)).OrThrowNotFound("Bản phát hành", id);

            release.IsDeleted = true;

            _unitOfWork.AppReleases.Update(release);
            await _unitOfWork.SaveChangesAsync();
        }
    }
}
