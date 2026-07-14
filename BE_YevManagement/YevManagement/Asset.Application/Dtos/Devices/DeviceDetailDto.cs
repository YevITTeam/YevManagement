using Asset.Application.Dtos.DeviceConfigurations;
using Asset.Application.Dtos.DeviceSoftwares;

namespace Asset.Application.Dtos.Devices
{
    public class DeviceDetailDto
    {
        public DeviceDto Device { get; set; } = null!;
        public DeviceConfigurationDto? Configuration { get; set; }
        public List<DeviceSoftwareDto> Softwares { get; set; } = new();
    }
}
