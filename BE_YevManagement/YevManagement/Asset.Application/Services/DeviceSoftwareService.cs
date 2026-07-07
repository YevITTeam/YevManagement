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
    }
}
