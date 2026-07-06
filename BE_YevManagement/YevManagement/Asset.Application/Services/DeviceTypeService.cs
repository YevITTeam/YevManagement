using Asset.Application.Dtos.DeviceTypes;
using Asset.Application.Interfaces.Service;
using Asset.Domain.Entities;
using Shared.Application.Services;
using Shared.Application.Wrapper;
using Shared.Core.Exceptions;

namespace Asset.Application.Services
{
    public class DeviceTypeService : BaseService<IAssetUnitOfWork>, IDeviceTypeService
    {
        public DeviceTypeService(IAssetUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<PagedResponse<DeviceTypeDto>> GetPagedAsync(int pageIndex, int pageSize, string? keyword)
        {
            var query = _unitOfWork.DeviceTypes.GetQueryable(false).Where(x => !x.IsDeleted);

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                query = query.Where(x => x.TypeCode.Contains(keyword) || x.TypeName.Contains(keyword));
            }

            return await _unitOfWork.DeviceTypes.ToPagedResponseAsync(
                query.OrderBy(x => x.TypeCode),
                pageIndex,
                pageSize,
                x => new DeviceTypeDto { Id = x.Id, TypeCode = x.TypeCode, TypeName = x.TypeName }
            );
        }

        public async Task<List<DeviceTypeDto>> GetAllActiveAsync()
        {
            var types = await _unitOfWork.DeviceTypes.SelectAsync(
                predicate: x => !x.IsDeleted,
                selector: x => new DeviceTypeDto { Id = x.Id, TypeCode = x.TypeCode, TypeName = x.TypeName }
            );
            return types.OrderBy(x => x.TypeName).ToList();
        }

        public async Task<DeviceTypeDto> GetByIdAsync(int id)
        {
            var deviceType = await _unitOfWork.DeviceTypes.GetByIdAsync(id);
            deviceType.OrThrowNotFound("Loại thiết bị", id);

            return new DeviceTypeDto { Id = deviceType.Id, TypeCode = deviceType.TypeCode, TypeName = deviceType.TypeName };
        }

        public async Task<DeviceTypeDto> CreateAsync(CreateDeviceTypeDto request)
        {
            var exists = await _unitOfWork.DeviceTypes.FirstOrDefaultAsync(x => x.TypeCode == request.TypeCode && !x.IsDeleted);
            if (exists != null) throw new DomainException($"Mã loại thiết bị '{request.TypeCode}' đã tồn tại.");

            var newType = new DeviceType
            {
                TypeCode = request.TypeCode,
                TypeName = request.TypeName,
                IsDeleted = false
            };

            await _unitOfWork.DeviceTypes.AddAsync(newType);
            await _unitOfWork.SaveChangesAsync();

            return new DeviceTypeDto { Id = newType.Id, TypeCode = newType.TypeCode, TypeName = newType.TypeName };
        }

        public async Task UpdateAsync(UpdateDeviceTypeDto request)
        {
            var deviceType = await _unitOfWork.DeviceTypes.GetByIdAsync(request.Id);
            deviceType.OrThrowNotFound("Loại thiết bị", request.Id);

            if (deviceType.TypeCode != request.TypeCode)
            {
                var exists = await _unitOfWork.DeviceTypes.FirstOrDefaultAsync(x => x.TypeCode == request.TypeCode && !x.IsDeleted);
                if (exists != null) throw new DomainException($"Mã loại thiết bị '{request.TypeCode}' đã tồn tại.");
            }

            deviceType.TypeCode = request.TypeCode;
            deviceType.TypeName = request.TypeName;

            _unitOfWork.DeviceTypes.Update(deviceType);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task DeleteAsync(int id)
        {
            var deviceType = await _unitOfWork.DeviceTypes.GetByIdAsync(id);
            deviceType.OrThrowNotFound("Loại thiết bị", id);

            deviceType.IsDeleted = true;

            _unitOfWork.DeviceTypes.Update(deviceType);
            await _unitOfWork.SaveChangesAsync();
        }
    }
}