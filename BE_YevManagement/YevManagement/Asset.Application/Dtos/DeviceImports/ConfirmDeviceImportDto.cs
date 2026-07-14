using System.ComponentModel.DataAnnotations;

namespace Asset.Application.Dtos.DeviceImports
{
    public class ConfirmDeviceImportDto
    {
        [Required(ErrorMessage = "Danh sách thiết bị cần import không được để trống")]
        [MinLength(1, ErrorMessage = "Danh sách thiết bị cần import không được để trống")]
        public List<DeviceImportRowDto> Rows { get; set; } = new();
    }
}
