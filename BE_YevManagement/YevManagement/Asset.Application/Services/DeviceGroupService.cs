using Asset.Application.Dtos.DeviceGroups;
using Asset.Application.Interfaces.Service;
using Asset.Domain.Entities;
using Shared.Application.Abstractions;
using Shared.Application.Services;
using Shared.Application.Wrapper;
using Shared.Core.Exceptions;

namespace Asset.Application.Services
{
    public class DeviceGroupService : BaseService<IAssetUnitOfWork>, IDeviceGroupService
    {
        public DeviceGroupService(IAssetUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<PagedResponse<DeviceGroupDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword)
        {
            var query = _unitOfWork.DeviceGroups.GetQueryable(false).Where(x => !x.IsDeleted);

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                query = query.Where(x => x.GroupCode.Contains(keyword) || x.GroupName.Contains(keyword));
            }

            return await _unitOfWork.DeviceGroups.ToPagedResponseAsync(
                query.OrderBy(x => x.GroupCode),
                pageIndex,
                pageSize,
                x => new DeviceGroupDto { Id = x.Id, GroupCode = x.GroupCode, GroupName = x.GroupName }
            );
        }

        public async Task<List<DeviceGroupDto>> GetAllActiveAsync()
        {
            var groups = await _unitOfWork.DeviceGroups.SelectAsync(
                predicate: x => !x.IsDeleted,
                selector: x => new DeviceGroupDto { Id = x.Id, GroupCode = x.GroupCode, GroupName = x.GroupName }
            );
            return groups.OrderBy(x => x.GroupName).ToList();
        }

        public async Task<DeviceGroupDto> GetByIdAsync(int id)
        {
            var group = await _unitOfWork.DeviceGroups.GetByIdAsync(id);
            group.OrThrowNotFound("Nhóm", id);

            return new DeviceGroupDto { Id = group.Id, GroupCode = group.GroupCode, GroupName = group.GroupName };
        }

        public async Task<DeviceGroupDto> CreateAsync(CreateDeviceGroupDto request)
        {
            var exists = await _unitOfWork.DeviceGroups.FirstOrDefaultAsync(x => x.GroupCode == request.GroupCode && !x.IsDeleted);
            if (exists != null) throw new DomainException($"Mã nhóm '{request.GroupCode}' đã tồn tại.");

            var newGroup = new DeviceGroup
            {
                GroupCode = request.GroupCode,
                GroupName = request.GroupName,
                IsDeleted = false
            };

            await _unitOfWork.DeviceGroups.AddAsync(newGroup);
            await _unitOfWork.SaveChangesAsync();

            return new DeviceGroupDto { Id = newGroup.Id, GroupCode = newGroup.GroupCode, GroupName = newGroup.GroupName };
        }

        public async Task UpdateAsync(UpdateDeviceGroupDto request)
        {
            var group = await _unitOfWork.DeviceGroups.GetByIdAsync(request.Id);
            group.OrThrowNotFound("Nhóm", request.Id);

            if (group.GroupCode != request.GroupCode)
            {
                var exists = await _unitOfWork.DeviceGroups.FirstOrDefaultAsync(x => x.GroupCode == request.GroupCode && !x.IsDeleted);
                if (exists != null) throw new DomainException($"Mã nhóm '{request.GroupCode}' đã tồn tại.");
            }

            group.GroupCode = request.GroupCode;
            group.GroupName = request.GroupName;

            _unitOfWork.DeviceGroups.Update(group);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task DeleteAsync(int id)
        {
            var group = await _unitOfWork.DeviceGroups.GetByIdAsync(id);
            group.OrThrowNotFound("Nhóm", id);

            group.IsDeleted = true;

            _unitOfWork.DeviceGroups.Update(group);
            await _unitOfWork.SaveChangesAsync();
        }
    }
}
