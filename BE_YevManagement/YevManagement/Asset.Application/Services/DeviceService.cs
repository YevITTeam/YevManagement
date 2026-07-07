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

        public async Task<PagedResponse<DeviceGridDto>> GetDevicesForGridAsync(DeviceFilterRequest request)
        {
            var query = _unitOfWork.Devices.GetQueryable(
                false,
                d => d.Branch,
                d => d.Supplier,
                d => d.DeviceType);

            query = query.Where(d => !d.IsDeleted);

            if (!string.IsNullOrWhiteSpace(request.DeviceCode))
            {
                query = query.Where(d => d.DeviceCode.StartsWith(request.DeviceCode));
            }

            if (!string.IsNullOrWhiteSpace(request.Manager))
            {
                query = query.Where(d => d.Manager.StartsWith(request.Manager));
            }

            if (!string.IsNullOrWhiteSpace(request.SupplierName))
            {
                query = query.Where(d => d.Supplier.SupplierName.StartsWith(request.SupplierName));
            }

            if (!string.IsNullOrWhiteSpace(request.PurchaseDate))
            {
                query = query.Where(d => d.PurchaseDate.ToString().Contains(request.PurchaseDate));
            }

            if (!string.IsNullOrWhiteSpace(request.Note))
            {
                query = query.Where(d => d.Note != null && d.Note.Contains(request.Note));
            }

            return await _unitOfWork.Devices.ToPagedResponseAsync(
                query.OrderByDescending(d => d.PurchaseDate),
                request.PageIndex,
                request.PageSize,
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
                    Manager = d.Manager,
                    Note = d.Note,
                    Email = d.Email,
                    Status = d.Status
                }
            );
        }
    }
}
