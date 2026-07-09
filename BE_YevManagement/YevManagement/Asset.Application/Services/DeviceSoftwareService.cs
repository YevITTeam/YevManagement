using Asset.Application.Dtos.DeviceSoftwares;
using Asset.Application.Interfaces.Service;
using Asset.Domain.Entities;
using Shared.Application.Abstractions;
using Shared.Application.Services;
using Shared.Core.Exceptions;
using System;
using System.Collections.Generic;
using System.Text;

namespace Asset.Application.Services
{
    public class DeviceSoftwareService : BaseService<IAssetUnitOfWork>, IDeviceSoftwareService
    {
        public DeviceSoftwareService(IAssetUnitOfWork unitOfWork) : base(unitOfWork) { }

        public async Task<List<DeviceSoftwareDto>> GetByDeviceIdAsync(int deviceId)
        {
            var query = _unitOfWork.DeviceSoftwares.GetQueryable(false, ds => ds.Software);

            var result = await _unitOfWork.DeviceSoftwares.SelectAsync(
                predicate: ds => ds.DeviceId == deviceId,
                selector: ds => new DeviceSoftwareDto
                {
                    DeviceId = ds.DeviceId,
                    SoftwareId = ds.SoftwareId,
                    SoftwareName = ds.Software.SoftwareName,
                    InstallDate = ds.InstallDate,
                    LicenseKey = ds.LicenseKey
                }
            );

            return result.OrderByDescending(x => x.InstallDate).ToList();
        }

        public async Task<DeviceSoftwareDto> CreateAsync(CreateDeviceSoftwareDto request)
        {
            var exists = await _unitOfWork.DeviceSoftwares.FirstOrDefaultAsync(
                x => x.DeviceId == request.DeviceId && x.SoftwareId == request.SoftwareId);

            if (exists != null)
                throw new DomainException("Phần mềm này đã được cài đặt trên thiết bị.");

            var newDeviceSoftware = new DeviceSoftware
            {
                DeviceId = request.DeviceId,
                SoftwareId = request.SoftwareId,
                InstallDate = request.InstallDate,
                LicenseKey = request.LicenseKey
            };

            await _unitOfWork.DeviceSoftwares.AddAsync(newDeviceSoftware);
            await _unitOfWork.SaveChangesAsync();

            return new DeviceSoftwareDto
            {
                DeviceId = newDeviceSoftware.DeviceId,
                SoftwareId = newDeviceSoftware.SoftwareId,
                InstallDate = newDeviceSoftware.InstallDate,
                LicenseKey = newDeviceSoftware.LicenseKey
            };
        }

        public async Task UpdateAsync(UpdateDeviceSoftwareDto request)
        {
            var deviceSoftware = await _unitOfWork.DeviceSoftwares.FirstOrDefaultAsync(
                x => x.DeviceId == request.DeviceId && x.SoftwareId == request.SoftwareId);

            if (deviceSoftware == null)
                throw new NotFoundException("Cài đặt phần mềm", $"{request.DeviceId}-{request.SoftwareId}");

            deviceSoftware.InstallDate = request.InstallDate;
            deviceSoftware.LicenseKey = request.LicenseKey;

            _unitOfWork.DeviceSoftwares.Update(deviceSoftware);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task DeleteAsync(int deviceId, int softwareId)
        {
            var deviceSoftware = await _unitOfWork.DeviceSoftwares.FirstOrDefaultAsync(
                x => x.DeviceId == deviceId && x.SoftwareId == softwareId);

            if (deviceSoftware == null)
                throw new NotFoundException("Cài đặt phần mềm", $"{deviceId}-{softwareId}");

            _unitOfWork.DeviceSoftwares.Delete(deviceSoftware);
            await _unitOfWork.SaveChangesAsync();
        }

        public async Task<List<SoftwarePickerDto>> GetPickerListAsync(int deviceId)
        {
            var device = await _unitOfWork.Devices.GetByIdAsync(deviceId);
            device.OrThrowNotFound("Thiết bị", deviceId);

            var installedIds = (await _unitOfWork.DeviceSoftwares.FindAsync(x => x.DeviceId == deviceId))
                .Select(x => x.SoftwareId)
                .ToHashSet();

            var result = await _unitOfWork.Softwares.SelectAsync(
                predicate: s => !s.IsDeleted,
                selector: s => new SoftwarePickerDto
                {
                    SoftwareId = s.Id,
                    SoftwareCode = s.SoftwareCode,
                    SoftwareName = s.SoftwareName,
                    IsSelected = installedIds.Contains(s.Id)
                });

            return result
                .OrderByDescending(x => x.IsSelected)
                .ThenBy(x => x.SoftwareName)
                .ToList();
        }

        public async Task<List<DeviceSoftwareDto>> SyncAsync(SyncDeviceSoftwareDto request)
        {
            var device = await _unitOfWork.Devices.GetByIdAsync(request.DeviceId);
            device.OrThrowNotFound("Thiết bị", request.DeviceId);

            if (request.Items.Select(x => x.SoftwareId).Distinct().Count() != request.Items.Count)
                throw new DomainException("Danh sách phần mềm chọn bị trùng lặp.");

            var selectedIds = request.Items.Select(x => x.SoftwareId).ToHashSet();

            if (selectedIds.Count > 0)
            {
                var validIds = (await _unitOfWork.Softwares.FindAsync(s => !s.IsDeleted && selectedIds.Contains(s.Id)))
                    .Select(s => s.Id)
                    .ToHashSet();

                if (validIds.Count != selectedIds.Count)
                    throw new DomainException("Danh sách phần mềm chọn không hợp lệ.");
            }

            var current = await _unitOfWork.DeviceSoftwares.FindAsync(x => x.DeviceId == request.DeviceId);
            var currentIds = current.Select(x => x.SoftwareId).ToHashSet();

            var toRemove = current.Where(x => !selectedIds.Contains(x.SoftwareId)).ToList();
            if (toRemove.Count > 0)
                _unitOfWork.DeviceSoftwares.RemoveRange(toRemove);

            var toAdd = request.Items.Where(x => !currentIds.Contains(x.SoftwareId)).ToList();
            if (toAdd.Count > 0)
            {
                var newEntities = toAdd.Select(item => new DeviceSoftware
                {
                    DeviceId = request.DeviceId,
                    SoftwareId = item.SoftwareId,
                    InstallDate = item.InstallDate ?? DateTime.UtcNow,
                    LicenseKey = item.LicenseKey
                });
                await _unitOfWork.DeviceSoftwares.AddRangeAsync(newEntities);
            }

            await _unitOfWork.SaveChangesAsync();

            return await GetByDeviceIdAsync(request.DeviceId);
        }
    }
}
