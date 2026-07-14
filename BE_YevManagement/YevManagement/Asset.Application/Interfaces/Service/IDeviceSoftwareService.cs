using Asset.Application.Dtos.DeviceSoftwares;
using System;
using System.Collections.Generic;
using System.Text;

namespace Asset.Application.Interfaces.Service
{
    public interface IDeviceSoftwareService
    {
        Task<List<DeviceSoftwareDto>> GetByDeviceIdAsync(int deviceId);
        Task<DeviceSoftwareDto> CreateAsync(CreateDeviceSoftwareDto request);
        Task UpdateAsync(UpdateDeviceSoftwareDto request);
        Task DeleteAsync(int deviceId, int softwareId);
        Task<List<SoftwarePickerDto>> GetPickerListAsync(int deviceId);
        Task<List<DeviceSoftwareDto>> SyncAsync(SyncDeviceSoftwareDto request);
    }
}
