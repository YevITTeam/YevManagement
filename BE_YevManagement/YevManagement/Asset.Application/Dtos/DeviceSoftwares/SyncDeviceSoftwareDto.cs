using System.ComponentModel.DataAnnotations;

namespace Asset.Application.Dtos.DeviceSoftwares
{
    public class SyncDeviceSoftwareDto
    {
        [Required(ErrorMessage = "Thiết bị không được để trống")]
        public int DeviceId { get; set; }

        public List<DeviceSoftwareSyncItemDto> Items { get; set; } = new();
    }

    public class DeviceSoftwareSyncItemDto
    {
        [Required(ErrorMessage = "Phần mềm không được để trống")]
        public int SoftwareId { get; set; }

        public DateTime? InstallDate { get; set; }
        public string? LicenseKey { get; set; }
    }
}
