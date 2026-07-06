using Asset.Application.Dtos.Devices;
using Asset.Application.Interfaces.Service;
using Shared.Application.Services;
using Shared.Application.Wrapper;

namespace Asset.Application.Services
{
    public class DeviceService : BaseService<IAssetUnitOfWork>, IDeviceService
    {
        public DeviceService(IAssetUnitOfWork unitOfWork) : base(unitOfWork)
        {
        }

        public async Task<PagedResponse<DeviceGridDto>> GetDevicesForGridAsync(int pageIndex, int pageSize)
        {
            var query = _unitOfWork.Devices.GetQueryable(
                false,
                d => d.Branch,
                d => d.Supplier,
                d => d.DeviceType);

            return await _unitOfWork.Devices.ToPagedResponseAsync(
                query.Where(d => !d.IsDeleted).OrderByDescending(d => d.PurchaseDate),
                pageIndex,
                pageSize,
                d => new DeviceGridDto
                {
                    Id = d.Id,
                    DeviceCode = d.DeviceCode,
                    DeviceName = d.DeviceName,
                    BranchName = d.Branch.BranchName,
                    SupplierName = d.Supplier.SupplierName,
                    DeviceTypeName = d.DeviceType.TypeName,
                    IpAddress = d.IpAddresses.Where(ip => !ip.IsDeleted).Select(ip => ip.IpAddress1).FirstOrDefault(),
                    PurchaseDate = d.PurchaseDate,
                    ExpirationDate = d.ExpirationDate,
                    Manager = d.Manager,
                    Note = d.Note,
                    Email = d.Email,
                    Status = d.Status
                }
            );
        }
    }
}
