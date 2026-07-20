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

            // Transfer all currently assigned IPs: old device -> new device (Device now supports
            // multiple IPs at once, there's no more "primary IP" concept). Any IP already held by
            // the new device that isn't in the old device's IP set is released back to Available
            // first, since one IP cannot be assigned to multiple devices.
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

            // Transfer emails: change the DeviceId of each DeviceEmail row to the new device
            // (2026-07-11). Email is not a shared resource like IP (no unique constraint), so it's
            // enough to just re-point DeviceId — no need to remove the new device's existing emails.
            // If the Email content exactly matches a row the new device already has, drop the old
            // row instead (avoid duplication).
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

            // Transfer role/usage-position data from the old device to the new device (2026-07-16,
            // added Group/Department): BranchId/Manager/IsOutsourced/IsUseUsb/GroupId/DepartmentId —
            // this data is tied to the position/user, not a physical attribute of the device. Do NOT
            // copy DeviceTypeId/SupplierId/PurchaseDate/ExpirationDate/DepreciationMonths (each
            // physical device has its own purchase date/supplier/type/depreciation, not representative
            // of the other device), nor Id/DeviceCode/DeviceName/SerialNumber/Note/DeviceConfiguration
            // (keep the new device's own values). Status is not copied directly since it has its own
            // calculation logic below.
            newDevice!.BranchId = oldDevice.BranchId;
            newDevice.Manager = oldDevice.Manager;
            newDevice.IsOutsourced = oldDevice.IsOutsourced;
            newDevice.IsUseUsb = oldDevice.IsUseUsb;
            newDevice.GroupId = oldDevice.GroupId;
            newDevice.DepartmentId = oldDevice.DepartmentId;

            // Transfer installed software: change the DeviceId of each DeviceSoftware row to the new
            // device. If the new device already has that software installed (duplicate composite key
            // DeviceId+SoftwareId), keep the new device's record and delete the old one to avoid a key
            // conflict.
            var oldSoftwares = await _unitOfWork.DeviceSoftwares.FindAsync(x => x.DeviceId == oldDevice!.Id);
            var newSoftwareIds = (await _unitOfWork.DeviceSoftwares.FindAsync(x => x.DeviceId == newDevice!.Id))
                .Select(x => x.SoftwareId)
                .ToHashSet();

            foreach (var deviceSoftware in oldSoftwares)
            {
                // DeviceId is part of the composite primary key (DeviceId, SoftwareId), so EF Core
                // does not allow modifying it directly then Update — must delete the old row and add
                // a new one (keeping InstallDate/LicenseKey) to "transfer" the record to the new device.
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

            // Old device: move to "Pending Use" status, unless it has already expired, in which case
            // move it directly to "Pending Liquidation" (same IsExpired formula as the device-list report).
            var today = TimeHelper.GetCurrentUtcTime().Date;
            var isExpired = oldDevice!.ExpirationDate.HasValue && oldDevice.ExpirationDate.Value.Date < today;
            oldDevice.Status = isExpired ? (int)DeviceStatus.PendingLiquidation : (int)DeviceStatus.PendingUse;
            _unitOfWork.Devices.Update(oldDevice);

            // New device: move directly to "In Use" since it has received the old device's IP + software.
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
