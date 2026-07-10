using System.ComponentModel.DataAnnotations;

namespace Asset.Application.Dtos.DeviceConfigurationImports
{
    public class ConfirmDeviceConfigurationImportDto
    {
        [Required(ErrorMessage = "Danh sách thiết bị cần import không được để trống")]
        [MinLength(1, ErrorMessage = "Danh sách thiết bị cần import không được để trống")]
        public List<DeviceConfigurationImportRowDto> Rows { get; set; } = new();
    }
}
