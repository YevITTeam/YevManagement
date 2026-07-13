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

        public async Task<PagedResponse<DeviceGroupDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword, int? departmentId = null)
        {
            var query = _unitOfWork.DeviceGroups.GetQueryable(false, x => x.Department).Where(x => !x.IsDeleted);

            if (departmentId.HasValue)
            {
                query = query.Where(x => x.DepartmentId == departmentId.Value);
            }

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                query = query.Where(x => x.GroupCode.Contains(keyword) || x.GroupName.Contains(keyword));
            }

            return await _unitOfWork.DeviceGroups.ToPagedResponseAsync(
                query.OrderBy(x => x.Department.DepartmentCode).ThenBy(x => x.GroupCode),
                pageIndex,
                pageSize,
                x => new DeviceGroupDto
                {
                    Id = x.Id,
                    GroupCode = x.GroupCode,
                    GroupName = x.GroupName,
                    DepartmentId = x.DepartmentId,
                    DepartmentName = x.Department.DepartmentName
                }
            );
        }

        // departmentId: dùng cho dropdown "Nhóm" phụ thuộc "Bộ phận" đã chọn trên form Device
        // (FE gọi GET /api/DeviceGroup/all?departmentId=X sau khi người dùng chọn Bộ phận).
        public async Task<List<DeviceGroupDto>> GetAllActiveAsync(int? departmentId = null)
        {
            var groups = await _unitOfWork.DeviceGroups.SelectAsync(
                predicate: x => !x.IsDeleted && (!departmentId.HasValue || x.DepartmentId == departmentId.Value),
                selector: x => new DeviceGroupDto
                {
                    Id = x.Id,
                    GroupCode = x.GroupCode,
                    GroupName = x.GroupName,
                    DepartmentId = x.DepartmentId,
                    DepartmentName = x.Department.DepartmentName
                }
            );
            return groups.OrderBy(x => x.GroupName).ToList();
        }

        public async Task<DeviceGroupDto> GetByIdAsync(int id)
        {
            var group = await _unitOfWork.DeviceGroups.FirstOrDefaultAsync(x => x.Id == id, x => x.Department);
            group.OrThrowNotFound("Nhóm", id);

            return new DeviceGroupDto
            {
                Id = group!.Id,
                GroupCode = group.GroupCode,
                GroupName = group.GroupName,
                DepartmentId = group.DepartmentId,
                DepartmentName = group.Department.DepartmentName
            };
        }

        public async Task<DeviceGroupDto> CreateAsync(CreateDeviceGroupDto request)
        {
            var department = await ValidateDepartmentIdAsync(request.DepartmentId);

            var exists = await _unitOfWork.DeviceGroups.FirstOrDefaultAsync(
                x => x.DepartmentId == request.DepartmentId && x.GroupCode == request.GroupCode && !x.IsDeleted);
            if (exists != null) throw new DomainException($"Mã nhóm '{request.GroupCode}' đã tồn tại trong bộ phận '{department.DepartmentName}'.");

            var newGroup = new DeviceGroup
            {
                DepartmentId = request.DepartmentId,
                GroupCode = request.GroupCode,
                GroupName = request.GroupName,
                IsDeleted = false
            };

            await _unitOfWork.DeviceGroups.AddAsync(newGroup);
            await _unitOfWork.SaveChangesAsync();

            return new DeviceGroupDto
            {
                Id = newGroup.Id,
                GroupCode = newGroup.GroupCode,
                GroupName = newGroup.GroupName,
                DepartmentId = newGroup.DepartmentId,
                DepartmentName = department.DepartmentName
            };
        }

        public async Task UpdateAsync(UpdateDeviceGroupDto request)
        {
            var group = await _unitOfWork.DeviceGroups.GetByIdAsync(request.Id);
            group.OrThrowNotFound("Nhóm", request.Id);

            var department = await ValidateDepartmentIdAsync(request.DepartmentId);

            if (group!.DepartmentId != request.DepartmentId || group.GroupCode != request.GroupCode)
            {
                var exists = await _unitOfWork.DeviceGroups.FirstOrDefaultAsync(
                    x => x.DepartmentId == request.DepartmentId && x.GroupCode == request.GroupCode && !x.IsDeleted && x.Id != request.Id);
                if (exists != null) throw new DomainException($"Mã nhóm '{request.GroupCode}' đã tồn tại trong bộ phận '{department.DepartmentName}'.");
            }

            group.DepartmentId = request.DepartmentId;
            group.GroupCode = request.GroupCode;
            group.GroupName = request.GroupName;

            _unitOfWork.DeviceGroups.Update(group);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task DeleteAsync(int id)
        {
            var group = await _unitOfWork.DeviceGroups.GetByIdAsync(id);
            group.OrThrowNotFound("Nhóm", id);

            group!.IsDeleted = true;

            _unitOfWork.DeviceGroups.Update(group);
            await _unitOfWork.SaveChangesAsync();
        }

        private async Task<DeviceDepartment> ValidateDepartmentIdAsync(int departmentId)
        {
            var department = await _unitOfWork.DeviceDepartments.FirstOrDefaultAsync(x => x.Id == departmentId && !x.IsDeleted);
            department.OrThrowNotFound("Bộ phận", departmentId);
            return department!;
        }
    }
}
