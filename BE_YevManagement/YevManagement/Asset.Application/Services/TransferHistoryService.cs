using Asset.Application.Dtos.TransferHistories;
using Asset.Application.Interfaces.Service;
using Asset.Domain.Entities;
using Asset.Domain.Enums;
using Shared.Application.Services;
using Shared.Application.Abstractions;
using Shared.Application.Helper;
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

            // Chuyển toàn bộ IP đang gắn: máy cũ -> máy mới (Device giờ hỗ trợ nhiều IP cùng lúc,
            // không còn khái niệm "IP chính"). IP nào máy mới đang giữ sẵn mà không nằm trong tập
            // IP của máy cũ thì gỡ về Available trước, vì 1 IP không được gắn trên nhiều thiết bị.
            var oldIps = await _unitOfWork.IpAddresses.FindAsync(x => x.DeviceId == oldDevice!.Id && !x.IsDeleted);
            var oldIpIds = oldIps.Select(x => x.Id).ToHashSet();

            var newDeviceCurrentIps = await _unitOfWork.IpAddresses.FindAsync(x => x.DeviceId == newDevice!.Id && !x.IsDeleted);
            foreach (var ip in newDeviceCurrentIps.Where(x => !oldIpIds.Contains(x.Id)))
            {
                ip.DeviceId = null;
                ip.Status = (int)IpAddressStatus.Available;
                _unitOfWork.IpAddresses.Update(ip);
            }

            foreach (var ip in oldIps)
            {
                ip.DeviceId = newDevice!.Id;
                ip.Status = (int)IpAddressStatus.Assigned;
                _unitOfWork.IpAddresses.Update(ip);
            }

            // Chuyển email: đổi DeviceId của từng dòng DeviceEmail sang máy mới (2026-07-11).
            // Email không phải tài nguyên dùng chung như IP (không có ràng buộc unique), nên chỉ
            // cần re-point DeviceId, không cần gỡ email hiện có của máy mới. Nếu trùng đúng nội
            // dung Email với 1 dòng máy mới đã có sẵn thì bỏ dòng cũ (tránh nhân đôi).
            var oldEmails = await _unitOfWork.DeviceEmails.FindAsync(x => x.DeviceId == oldDevice.Id && !x.IsDeleted);
            var newDeviceEmailTexts = (await _unitOfWork.DeviceEmails.FindAsync(x => x.DeviceId == newDevice!.Id && !x.IsDeleted))
                .Select(x => x.Email)
                .ToHashSet();

            foreach (var email in oldEmails)
            {
                if (newDeviceEmailTexts.Contains(email.Email))
                {
                    email.IsDeleted = true;
                }
                else
                {
                    email.DeviceId = newDevice!.Id;
                }
                _unitOfWork.DeviceEmails.Update(email);
            }

            // Chuyển dữ liệu vai trò/vị trí sử dụng của máy cũ sang máy mới (2026-07-11, chốt lại
            // lần 2 theo quyết định người dùng): CHỈ BranchId/Manager/IsOutsourced/IsUseUsb — đây là
            // dữ liệu gắn theo vị trí/người dùng, không phải thuộc tính vật lý của thiết bị. KHÔNG
            // copy DeviceTypeId/SupplierId/PurchaseDate/ExpirationDate/DepreciationMonths (mỗi máy
            // vật lý có ngày mua/nhà cung cấp/loại/khấu hao riêng, không đại diện cho máy kia), cũng
            // như Id/DeviceCode/DeviceName/SerialNumber/Note/DeviceConfiguration (giữ nguyên của máy
            // mới). Status không copy trực tiếp vì đã có logic tính riêng bên dưới.
            newDevice!.BranchId = oldDevice.BranchId;
            newDevice.Manager = oldDevice.Manager;
            newDevice.IsOutsourced = oldDevice.IsOutsourced;
            newDevice.IsUseUsb = oldDevice.IsUseUsb;

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
            var today = TimeHelper.GetCurrentUtcTime().Date;
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
                TransferDate = TimeHelper.GetCurrentUtcTime(),
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
