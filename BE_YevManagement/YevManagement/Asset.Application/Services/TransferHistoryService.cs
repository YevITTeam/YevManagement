using Asset.Application.Dtos.TransferHistories;
using Asset.Application.Interfaces.Service;
using Asset.Domain.Entities;
using Asset.Domain.Enums;
using Shared.Application.Services;
using Shared.Application.Abstractions;
using Shared.Core.Exceptions;

namespace Asset.Application.Services
{
    public class TransferHistoryService : BaseService<IAssetUnitOfWork>, ITransferHistoryService
    {
        public TransferHistoryService(IAssetUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<TransferHistoryDto> TransferAsync(CreateTransferHistoryDto request)
        {
            if (request.OldDeviceId == request.NewDeviceId)
                throw new DomainException("Thiết bị cũ và thiết bị mới không được trùng nhau.");

            var oldDevice = await _unitOfWork.Devices.GetByIdAsync(request.OldDeviceId);
            oldDevice.OrThrowNotFound("Thiết bị cũ", request.OldDeviceId);

            var newDevice = await _unitOfWork.Devices.GetByIdAsync(request.NewDeviceId);
            newDevice.OrThrowNotFound("Thiết bị mới", request.NewDeviceId);

            // Chuyển IP chính: máy cũ -> máy mới. Nếu máy mới đang có sẵn 1 IP khác thì gỡ về
            // Available trước, vì 1 IP không được gắn trên nhiều thiết bị cùng lúc.
            var oldIp = await _unitOfWork.IpAddresses.FirstOrDefaultAsync(x => x.DeviceId == oldDevice!.Id && !x.IsDeleted);
            if (oldIp != null)
            {
                var newDeviceCurrentIp = await _unitOfWork.IpAddresses.FirstOrDefaultAsync(x => x.DeviceId == newDevice!.Id && !x.IsDeleted);
                if (newDeviceCurrentIp != null && newDeviceCurrentIp.Id != oldIp.Id)
                {
                    newDeviceCurrentIp.DeviceId = null;
                    newDeviceCurrentIp.Status = (int)IpAddressStatus.Available;
                    _unitOfWork.IpAddresses.Update(newDeviceCurrentIp);
                }

                oldIp.DeviceId = newDevice!.Id;
                oldIp.Status = (int)IpAddressStatus.Assigned;
                _unitOfWork.IpAddresses.Update(oldIp);
            }

            // Chuyển phần mềm cài: đổi DeviceId của từng dòng DeviceSoftware sang máy mới.
            // Nếu máy mới đã cài sẵn phần mềm đó rồi (trùng khoá kép DeviceId+SoftwareId) thì
            // giữ nguyên bản ghi bên máy mới, xoá bản ghi cũ để tránh trùng khoá.
            var oldSoftwares = await _unitOfWork.DeviceSoftwares.FindAsync(x => x.DeviceId == oldDevice!.Id);
            var newSoftwareIds = (await _unitOfWork.DeviceSoftwares.FindAsync(x => x.DeviceId == newDevice!.Id))
                .Select(x => x.SoftwareId)
                .ToHashSet();

            foreach (var deviceSoftware in oldSoftwares)
            {
                // DeviceId là 1 phần của khoá chính kép (DeviceId, SoftwareId) nên EF Core
                // không cho phép sửa trực tiếp rồi Update — phải xoá dòng cũ, thêm dòng mới
                // (giữ nguyên InstallDate/LicenseKey) để "chuyển" bản ghi sang máy mới.
                _unitOfWork.DeviceSoftwares.Delete(deviceSoftware);

                if (!newSoftwareIds.Contains(deviceSoftware.SoftwareId))
                {
                    await _unitOfWork.DeviceSoftwares.AddAsync(new DeviceSoftware
                    {
                        DeviceId = newDevice!.Id,
                        SoftwareId = deviceSoftware.SoftwareId,
                        InstallDate = deviceSoftware.InstallDate,
                        LicenseKey = deviceSoftware.LicenseKey
                    });
                }
            }

            // Máy cũ: chuyển trạng thái "Chờ sử dụng", trừ khi đã hết hạn sử dụng thì
            // chuyển thẳng "Chờ thanh lý" (cùng công thức IsExpired ở báo cáo device-list).
            var today = DateTime.UtcNow.Date;
            var isExpired = oldDevice!.ExpirationDate.HasValue && oldDevice.ExpirationDate.Value.Date < today;
            oldDevice.Status = isExpired ? (int)DeviceStatus.PendingLiquidation : (int)DeviceStatus.PendingUse;
            _unitOfWork.Devices.Update(oldDevice);

            // Máy mới: chuyển thẳng "Đang sử dụng" vì đã tiếp nhận IP + phần mềm của máy cũ.
            newDevice!.Status = (int)DeviceStatus.InUse;
            _unitOfWork.Devices.Update(newDevice);

            var transferHistory = new TransferHistory
            {
                OldDeviceId = oldDevice.Id,
                NewDeviceId = newDevice!.Id,
                TransferDate = DateTime.UtcNow,
                Note = request.Note
            };

            await _unitOfWork.TransferHistories.AddAsync(transferHistory);
            await _unitOfWork.SaveChangesAsync();

            return new TransferHistoryDto
            {
                Id = transferHistory.Id,
                OldDeviceId = oldDevice.Id,
                OldDeviceCode = oldDevice.DeviceCode,
                OldDeviceName = oldDevice.DeviceName,
                NewDeviceId = newDevice.Id,
                NewDeviceCode = newDevice.DeviceCode,
                NewDeviceName = newDevice.DeviceName,
                TransferDate = transferHistory.TransferDate,
                Note = transferHistory.Note
            };
        }

        public async Task<List<TransferHistoryDto>> GetByDeviceIdAsync(int deviceId)
        {
            var query = _unitOfWork.TransferHistories
                .GetQueryable(false, x => x.OldDevice, x => x.NewDevice)
                .Where(x => x.OldDeviceId == deviceId || x.NewDeviceId == deviceId)
                .OrderByDescending(x => x.TransferDate);

            return await _unitOfWork.TransferHistories.ToListAsync(
                query,
                x => new TransferHistoryDto
                {
                    Id = x.Id,
                    OldDeviceId = x.OldDeviceId,
                    OldDeviceCode = x.OldDevice.DeviceCode,
                    OldDeviceName = x.OldDevice.DeviceName,
                    NewDeviceId = x.NewDeviceId,
                    NewDeviceCode = x.NewDevice.DeviceCode,
                    NewDeviceName = x.NewDevice.DeviceName,
                    TransferDate = x.TransferDate,
                    Note = x.Note
                });
        }
    }
}
