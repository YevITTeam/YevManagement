using Asset.Application.Dtos.DeviceConfigurations;
using System;
using System.Collections.Generic;
using System.Text;

namespace Asset.Application.Interfaces.Service
{
    public interface IDeviceConfigurationService
    {
        Task<DeviceConfigurationDto?> GetByDeviceIdAsync(int deviceId);
        Task<DeviceConfigurationDto> CreateAsync(CreateDeviceConfigurationDto request);
        Task UpdateAsync(UpdateDeviceConfigurationDto request);
        Task DeleteAsync(int id);
        Task<DeviceConfigurationInitialDto?> GetInitialByConfigIdAsync(int deviceConfigurationId);
        Task DeleteInitialAsync(int id);
        Task<List<DeviceConfigurationHistoryDto>> GetHistoryAsync(int deviceConfigurationId);
    }
}
