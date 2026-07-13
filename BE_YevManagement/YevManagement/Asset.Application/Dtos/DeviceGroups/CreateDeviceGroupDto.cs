using System.ComponentModel.DataAnnotations;

namespace Asset.Application.Dtos.DeviceGroups
{
    public class CreateDeviceGroupDto
    {
        [Required(ErrorMessage = "Mã nhóm không được để trống")]
        public string GroupCode { get; set; } = null!;

        [Required(ErrorMessage = "Tên nhóm không được để trống")]
        public string GroupName { get; set; } = null!;
    }
}
