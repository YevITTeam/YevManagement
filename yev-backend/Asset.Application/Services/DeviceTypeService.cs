using Asset.Application.Dtos.DeviceTypes;
using Asset.Application.Interfaces.Service;
using Asset.Domain.Entities;
using Asset.Domain.Enums;
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
                query.OrderBy(x => x.Id),
                pageIndex,
                pageSize,
                x => new DeviceTypeDto
                {
                    Id = x.Id,
                    TypeCode = x.TypeCode,
                    TypeName = x.TypeName,
                    ServerCheckCategory = x.ServerCheckCategory,
                    RequiresQrScan = x.RequiresQrScan,
                    IncludedInInventory = x.IncludedInInventory,
                    // Duplicated ternary (not the extension method) because this is an Expression<Func<>>
                    // translated by EF into SQL — same reason DeviceService.StatusText inlines it (§1.4 asset-module.md).
                    ServerCheckCategoryText = x.ServerCheckCategory == (int)ServerCheckCategory.Server ? "Server"
                        : x.ServerCheckCategory == (int)ServerCheckCategory.Network ? "Network"
                        : x.ServerCheckCategory == (int)ServerCheckCategory.Ups ? "UPS"
                        : null
                }
            );
        }

        public async Task<List<DeviceTypeDto>> GetAllActiveAsync()
        {
            var types = await _unitOfWork.DeviceTypes.SelectAsync(
                predicate: x => !x.IsDeleted,
                selector: x => new DeviceTypeDto
                {
                    Id = x.Id,
                    TypeCode = x.TypeCode,
                    TypeName = x.TypeName,
                    ServerCheckCategory = x.ServerCheckCategory,
                    RequiresQrScan = x.RequiresQrScan,
                    IncludedInInventory = x.IncludedInInventory,
                    ServerCheckCategoryText = x.ServerCheckCategory == (int)ServerCheckCategory.Server ? "Server"
                        : x.ServerCheckCategory == (int)ServerCheckCategory.Network ? "Network"
                        : x.ServerCheckCategory == (int)ServerCheckCategory.Ups ? "UPS"
                        : null
                }
            );
            return types.OrderBy(x => x.Id).ToList();
        }

        public async Task<DeviceTypeDto> GetByIdAsync(int id)
        {
            var deviceType = (await _unitOfWork.DeviceTypes.GetByIdAsync(id)).OrThrowNotFound("Loại thiết bị", id);

            return MapToDto(deviceType);
        }

        public async Task<DeviceTypeDto> CreateAsync(CreateDeviceTypeDto request)
        {
            var exists = await _unitOfWork.DeviceTypes.FirstOrDefaultAsync(x => x.TypeCode == request.TypeCode);
            exists.ThrowIfDuplicateCode("Mã loại thiết bị", request.TypeCode, x => x.IsDeleted);

            var newType = new DeviceType
            {
                TypeCode = request.TypeCode,
                TypeName = request.TypeName,
                ServerCheckCategory = request.ServerCheckCategory,
                RequiresQrScan = request.RequiresQrScan,
                IncludedInInventory = request.IncludedInInventory,
                IsDeleted = false
            };

            await _unitOfWork.DeviceTypes.AddAsync(newType);
            await _unitOfWork.SaveChangesAsync();

            return MapToDto(newType);
        }

        public async Task UpdateAsync(UpdateDeviceTypeDto request)
        {
            var deviceType = (await _unitOfWork.DeviceTypes.GetByIdAsync(request.Id)).OrThrowNotFound("Loại thiết bị", request.Id);

            var exists = await _unitOfWork.DeviceTypes.FirstOrDefaultAsync(
                x => x.TypeCode == request.TypeCode && x.Id != request.Id);
            exists.ThrowIfDuplicateCode("Mã loại thiết bị", request.TypeCode, x => x.IsDeleted);

            deviceType.TypeCode = request.TypeCode;
            deviceType.TypeName = request.TypeName;
            deviceType.ServerCheckCategory = request.ServerCheckCategory;
            deviceType.RequiresQrScan = request.RequiresQrScan;
            deviceType.IncludedInInventory = request.IncludedInInventory;

            _unitOfWork.DeviceTypes.Update(deviceType);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task DeleteAsync(int id)
        {
            var deviceType = (await _unitOfWork.DeviceTypes.GetByIdAsync(id)).OrThrowNotFound("Loại thiết bị", id);

            deviceType.IsDeleted = true;

            _unitOfWork.DeviceTypes.Update(deviceType);
            await _unitOfWork.SaveChangesAsync();
        }

        private static DeviceTypeDto MapToDto(DeviceType deviceType) => new()
        {
            Id = deviceType.Id,
            TypeCode = deviceType.TypeCode,
            TypeName = deviceType.TypeName,
            ServerCheckCategory = deviceType.ServerCheckCategory,
            RequiresQrScan = deviceType.RequiresQrScan,
            IncludedInInventory = deviceType.IncludedInInventory,
            ServerCheckCategoryText = deviceType.ServerCheckCategory?.GetServerCheckCategoryText()
        };
    }
}
